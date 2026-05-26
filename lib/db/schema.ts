import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";

// Mirrors auth.users.id — we don't redefine auth.users (Supabase manages it).
// profiles.id has a FK to auth.users.id, enforced in SQL migration.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  quitDate: timestamp("quit_date", { withTimezone: true }),
  baselineCigsPerDay: integer("baseline_cigs_per_day"),
  costPerPack: numeric("cost_per_pack", { precision: 6, scale: 2 }),
  cigsPerPack: integer("cigs_per_pack").default(20),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  isPrivate: boolean("is_private").default(true).notNull(),
  maxMembers: integer("max_members").default(50).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const channelRoleEnum = pgEnum("channel_role", ["owner", "member"]);

export const channelMembers = pgTable(
  "channel_members",
  {
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: channelRoleEnum("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.channelId, t.userId] }),
  }),
);

export const streakEventTypeEnum = pgEnum("streak_event_type", [
  "quit",
  "relapse",
]);

// Append-only log. Current streak = now - latest "quit" event.
export const streakEvents = pgTable("streak_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  type: streakEventTypeEnum("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const stars = pgTable("stars", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id").references(() => channels.id, {
    onDelete: "cascade",
  }),
  // e.g. milestone_1d, milestone_7d, milestone_30d, rank_top, rank_top_weekly
  kind: text("kind").notNull(),
  awardedAt: timestamp("awarded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const reactions = pgTable("reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromUserId: uuid("from_user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  toUserId: uuid("to_user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
