"use client";

import { useOptimistic, useTransition } from "react";
import { COMPANIONS } from "@/lib/companions";
import { setCompanion } from "./companion-actions";

export function CompanionPicker({ current }: { current: string | null }) {
  const [selected, setSelected] = useOptimistic(
    current,
    (_: string | null, next: string | null) => next,
  );
  const [, startTransition] = useTransition();

  function pick(id: string | null) {
    startTransition(async () => {
      setSelected(id);
      await setCompanion(id);
    });
  }

  return (
    <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <p className="font-semibold">Coach companion</p>
      <p className="mt-1 text-sm text-neutral-500">
        A small friend that sits with you in the chat. Optional, just for vibes.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-3">
        <Tile
          emoji=" "
          label="None"
          blurb="No companion"
          active={selected === null}
          onSelect={() => pick(null)}
        />
        {COMPANIONS.map((c) => (
          <Tile
            key={c.id}
            emoji={c.emoji}
            label={c.label}
            blurb={c.blurb}
            active={selected === c.id}
            onSelect={() => pick(c.id)}
          />
        ))}
      </div>
    </section>
  );
}

function Tile({
  emoji,
  label,
  blurb,
  active,
  onSelect,
}: {
  emoji: string;
  label: string;
  blurb: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition ${
        active
          ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
          : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500"
      }`}
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[10px] text-neutral-500">{blurb}</span>
    </button>
  );
}
