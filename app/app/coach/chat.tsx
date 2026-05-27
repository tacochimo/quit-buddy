"use client";

import { useEffect, useRef, useState } from "react";
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
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<{ user: string; assistant: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible: Msg[] = pending
    ? [
        ...initialMessages,
        { id: "p-u", role: "user", content: pending.user },
        { id: "p-a", role: "assistant", content: pending.assistant },
      ]
    : initialMessages;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visible.length, pending?.assistant]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || disabled) return;

    setError(null);
    setInput("");
    setPending({ user: trimmed, assistant: "" });

    try {
      const response = await fetch("/api/coach/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${response.status})`);
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

      // Stream done — server has persisted; refresh to sync.
      setPending(null);
      router.refresh();
    } catch (e: unknown) {
      const msg = (e as Error).message ?? String(e);
      setError(msg);
      setInput(trimmed);
      setPending(null);
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

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

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
        className="mt-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || pending !== null}
          placeholder={disabled ? "Coach disabled" : "Type a message…"}
          maxLength={1000}
          className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={disabled || pending !== null || !input.trim()}
          className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Send
        </button>
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
