export type ActivityKind =
  | "joined"
  | "quit_started"
  | "relapse"
  | "milestone"
  | "sos"
  | "sos_resolved";

export type ActivityItem = {
  id: string;
  occurredAt: Date;
  actorId: string;
  actorName: string;
  kind: ActivityKind;
  milestoneDays?: number;
  note?: string | null;
};

export function buildActivity(args: {
  members: { user_id: string; joined_at: string; display_name: string }[];
  events: { id: string; user_id: string; type: string; occurred_at: string }[];
  stars: { id: string; user_id: string; kind: string; awarded_at: string }[];
  sos?: {
    id: string;
    user_id: string;
    note: string | null;
    created_at: string;
    resolved_at: string | null;
  }[];
}): ActivityItem[] {
  const nameOf = new Map(args.members.map((m) => [m.user_id, m.display_name]));
  const items: ActivityItem[] = [];

  for (const m of args.members) {
    items.push({
      id: `j-${m.user_id}`,
      occurredAt: new Date(m.joined_at),
      actorId: m.user_id,
      actorName: m.display_name,
      kind: "joined",
    });
  }

  for (const e of args.events) {
    items.push({
      id: `e-${e.id}`,
      occurredAt: new Date(e.occurred_at),
      actorId: e.user_id,
      actorName: nameOf.get(e.user_id) ?? "—",
      kind: e.type === "quit" ? "quit_started" : "relapse",
    });
  }

  for (const s of args.stars) {
    const match = /^milestone_(\d+)d$/.exec(s.kind);
    if (!match) continue;
    items.push({
      id: `s-${s.id}`,
      occurredAt: new Date(s.awarded_at),
      actorId: s.user_id,
      actorName: nameOf.get(s.user_id) ?? "—",
      kind: "milestone",
      milestoneDays: Number(match[1]),
    });
  }

  for (const signal of args.sos ?? []) {
    items.push({
      id: `sos-${signal.id}`,
      occurredAt: new Date(signal.created_at),
      actorId: signal.user_id,
      actorName: nameOf.get(signal.user_id) ?? "—",
      kind: "sos",
      note: signal.note,
    });
    if (signal.resolved_at) {
      items.push({
        id: `sos-r-${signal.id}`,
        occurredAt: new Date(signal.resolved_at),
        actorId: signal.user_id,
        actorName: nameOf.get(signal.user_id) ?? "—",
        kind: "sos_resolved",
      });
    }
  }

  items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return items.slice(0, 20);
}

export function describeActivity(item: ActivityItem): string {
  switch (item.kind) {
    case "joined":
      return `${item.actorName} joined`;
    case "quit_started":
      return `${item.actorName} started a streak`;
    case "relapse":
      return `${item.actorName} restarted`;
    case "milestone":
      return `${item.actorName} hit ${item.milestoneDays} days ⭐`;
    case "sos":
      return item.note
        ? `🆘 ${item.actorName}: "${item.note}"`
        : `🆘 ${item.actorName} needs support`;
    case "sos_resolved":
      return `✅ ${item.actorName} is OK now`;
  }
}

export function timeAgo(then: Date, now = new Date()): string {
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
