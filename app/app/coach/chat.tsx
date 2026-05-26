"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { sendCoachMessage } from "./actions";

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
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, addOptimistic] = useOptimistic<Msg[], string>(
    initialMessages,
    (state, userMsg) => [
      ...state,
      { id: `opt-${Date.now()}`, role: "user", content: userMsg },
    ],
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [optimistic.length, pending]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || disabled) return;
    setError(null);
    setInput("");
    startTransition(async () => {
      addOptimistic(trimmed);
      const result = await sendCoachMessage(trimmed);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-neutral-200 bg-neutral-50/40 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
      >
        {optimistic.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center text-sm text-neutral-500">
            <p className="text-3xl">🤝</p>
            <p>
              Your private quit coach. Anything you share stays between us.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {optimistic.map((m) => (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto rounded-br-sm bg-emerald-600 text-white"
                    : "mr-auto rounded-bl-sm bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                }`}
              >
                {m.content}
              </li>
            ))}
            {pending && (
              <li className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-sm shadow-sm dark:bg-neutral-800">
                <span className="inline-flex gap-1">
                  <Dot />
                  <Dot delay={150} />
                  <Dot delay={300} />
                </span>
              </li>
            )}
          </ul>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {optimistic.length === 0 && !disabled && (
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
          disabled={disabled || pending}
          placeholder={disabled ? "Coach disabled" : "Type a message…"}
          maxLength={1000}
          className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={disabled || pending || !input.trim()}
          className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="inline-block h-2 w-2 animate-bounce rounded-full bg-neutral-400"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
