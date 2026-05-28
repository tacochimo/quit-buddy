"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "I'm craving right now",
  "I had a slip",
  "Why is this so hard?",
  "Pump me up",
];

export function CoachChat({
  initialMessages,
  disabled,
}: {
  initialMessages: Msg[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<{ user: string; assistant: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const visible: Msg[] = pending
    ? [
        ...initialMessages,
        { id: "p-u", role: "user", content: pending.user },
        { id: "p-a", role: "assistant", content: pending.assistant },
      ]
    : initialMessages;

  // Smooth scroll only on send/initial; auto (no animation) during streaming
  // so each token doesn't trigger a new animation that fights the next one.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: pending ? "auto" : "smooth",
    });
  }, [visible.length, pending?.assistant, pending]);

  // Autosize the textarea up to ~5 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || disabled) return;

    setError(null);
    setErrorCode(null);
    setInput("");
    setPending({ user: trimmed, assistant: "" });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/coach/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        const err = new Error(
          body.error ?? `Request failed (${response.status})`,
        ) as Error & { code?: string };
        err.code = body.code;
        throw err;
      }
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setPending({ user: trimmed, assistant: accumulated });
      }

      // Stream done — server has persisted. Refresh inside a transition so
      // the optimistic pending UI stays mounted until the new RSC payload
      // arrives (no flicker between pending and committed messages).
      startTransition(() => {
        router.refresh();
        setPending(null);
      });
    } catch (e: unknown) {
      const aborted =
        (e as { name?: string }).name === "AbortError" ||
        controller.signal.aborted;
      if (aborted) {
        // User stopped. Server-side generation may still complete and persist
        // — refresh to pick it up.
        startTransition(() => {
          router.refresh();
          setPending(null);
        });
      } else {
        const errObj = e as Error & { code?: string };
        setError(errObj.message ?? String(e));
        setErrorCode(errObj.code ?? null);
        setInput(trimmed);
        setPending(null);
      }
    } finally {
      abortRef.current = null;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-neutral-200 bg-neutral-50/40 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
      >
        {visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center text-sm text-neutral-500">
            <p className="text-3xl">🤝</p>
            <p>Your private quit coach. Anything you share stays between us.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((m) => (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto rounded-br-sm bg-emerald-600 text-white"
                    : "mr-auto rounded-bl-sm bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                }`}
              >
                {m.content}
                {pending && m.id === "p-a" && !m.content && <Dots />}
                {pending && m.id === "p-a" && m.content && (
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-neutral-400 align-middle" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && errorCode === "free_limit_reached" ? (
        <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-700 dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">
            {error}
          </p>
          <Link
            href="/app/billing"
            className="inline-block self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Upgrade to Plus
          </Link>
        </div>
      ) : (
        error && <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {visible.length === 0 && !disabled && (
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || pending !== null}
          placeholder={
            disabled
              ? "Coach disabled"
              : "Type a message…  (Enter to send, Shift+Enter for newline)"
          }
          maxLength={1000}
          className="flex-1 resize-none rounded-3xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-5 dark:border-neutral-700 dark:bg-neutral-900"
        />
        {pending ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-full bg-neutral-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-900 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-1">
      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-neutral-400" />
      <span
        className="inline-block h-2 w-2 animate-bounce rounded-full bg-neutral-400"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="inline-block h-2 w-2 animate-bounce rounded-full bg-neutral-400"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}
