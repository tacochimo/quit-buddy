"use client";

import { useState } from "react";
import {
  DEFAULT_PERSONA,
  PERSONA_ORDER,
  PERSONAS,
  type PersonaId,
} from "@/lib/personas";

export function PersonaPicker({
  name = "coach_persona",
  defaultValue,
  label = "Pick your AI companion",
  hint,
}: {
  name?: string;
  defaultValue?: string;
  label?: string;
  hint?: string;
}) {
  const initial = (defaultValue ?? DEFAULT_PERSONA) as PersonaId;
  const [selected, setSelected] = useState<PersonaId>(
    initial in PERSONAS ? initial : DEFAULT_PERSONA,
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium">{label}</span>
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
      <input type="hidden" name={name} value={selected} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PERSONA_ORDER.map((id) => {
          const p = PERSONAS[id];
          const isActive = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition ${
                isActive
                  ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30"
                  : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
              }`}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="text-xs text-neutral-500">{p.tagline}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
