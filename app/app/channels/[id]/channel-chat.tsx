"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendChannelMessage } from "./actions";
import { timeAgo } from "@/lib/activity";

export type ChatMessage = {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

export function ChannelChat({
  channelId,
  currentUserId,
  messages,
}: {
  channelId: string;
  currentUserId: string;
  messages: ChatMessage[];
}) {
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change (new message in, or send).
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setError(null);
    setInput("");
    startTransition(async () => {
      const result = await sendChannelMessage(channelId, text);
      if (result?.error) {
        setError(result.error);
        setInput(text);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
        Chat
      </h2>

      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto bg-neutral-50/40 px-4 py-3 dark:bg-neutral-900/40"
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            No messages yet. Say hi to your channel.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m) => {
              const mine = m.user_id === currentUserId;
              return (
                <li
                  key={m.id}
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                >
                  <span className="px-2 text-xs text-neutral-500">
                    {mine ? "you" : m.display_name} ·{" "}
                    {timeAgo(new Date(m.created_at))}
                  </span>
                  <div
                    className={`mt-0.5 max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                      mine
                        ? "rounded-br-sm bg-emerald-600 text-white"
                        : "rounded-bl-sm bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                    }`}
                  >
                    {m.content}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-neutral-200 px-3 py-3 dark:border-neutral-800"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          maxLength={1000}
          placeholder="Message your channel…"
          className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {error && (
        <p className="border-t border-neutral-200 px-5 py-2 text-sm text-red-600 dark:border-neutral-800">
          {error}
        </p>
      )}
    </section>
  );
}
