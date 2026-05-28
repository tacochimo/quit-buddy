import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RefCapture } from "./ref-capture";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app/home");

  return (
    <main className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <RefCapture />
      {/* HERO */}
      <section className="mx-auto max-w-3xl px-6 py-20 sm:py-28 text-center">
        <p className="mb-3 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          🚭 Quit Buddy
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Quit smoking with people who{" "}
          <span className="text-emerald-600 dark:text-emerald-400">know you</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
          Track your streak. Climb your private channel&apos;s leaderboard. Get
          a peer-SOS when cravings hit — and an AI coach in your pocket 24/7.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-full bg-emerald-600 px-8 py-3 font-semibold text-white transition hover:bg-emerald-700"
          >
            Get started — free
          </Link>
          <Link
            href="/login"
            className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            Sign in →
          </Link>
        </div>
        <p className="mt-6 text-xs text-neutral-500">
          Free. Email magic-link login. No password to remember.
        </p>
      </section>

      {/* PROBLEM */}
      <section className="bg-neutral-50 py-16 dark:bg-neutral-900/60">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Quitting alone is hard. Quitting with strangers isn&apos;t much better.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <Problem
              title="Public communities"
              body="Forums full of strangers. Easy to lurk, easy to ghost when you slip."
            />
            <Problem
              title="AI-coach-only apps"
              body="Helpful at 2am — but no one notices if you stop opening the app."
            />
            <Problem
              title="Solo trackers"
              body="A counter is nice. It isn't the same as your sister texting back."
            />
          </div>
        </div>
      </section>

      {/* DIFFERENTIATORS */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          What Quit Buddy does differently
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <Feature
            icon="👥"
            title="Private channels"
            body="Invite your spouse, sibling, or best friend by code. You see each other's streaks. No strangers, no noise."
          />
          <Feature
            icon="🆘"
            title="Channel-mate SOS"
            body="One tap broadcasts 'I'm struggling' to your channel. Everyone gets a push notification. Cheer back with 👏."
          />
          <Feature
            icon="🤝"
            title="AI coach + your people"
            body="A context-aware coach that knows your streak and your reasons — plus the actual humans in your channel."
          />
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section className="bg-neutral-50 py-20 dark:bg-neutral-900/60">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            See it in action
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-neutral-600 dark:text-neutral-400">
            Mobile-first PWA. Install to your home screen and it feels like a
            native app.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <PhoneShot src="/screenshots/home.svg" caption="Home — your streak, savings, and quick tools" />
            <PhoneShot src="/screenshots/channel.svg" caption="Channel — leaderboard, cheers, live activity" />
            <PhoneShot src="/screenshots/coach.svg" caption="Coach — AI chat that knows your context" />
          </div>
        </div>
      </section>

      {/* HEALTH HOOK */}
      <section className="bg-emerald-50 py-16 dark:bg-emerald-950/30">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Your body starts healing immediately
          </p>
          <p className="mt-4 text-xl sm:text-2xl">
            In <strong>20 minutes</strong> your heart rate normalizes. In{" "}
            <strong>1 year</strong>, your heart disease risk is cut in half. In{" "}
            <strong>5 years</strong>, your stroke risk matches a non-smoker&apos;s.
          </p>
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            See the full CDC-aligned recovery timeline inside the app.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-12 space-y-8">
          <Step
            num={1}
            title="Sign in with email"
            body="Magic link or 6-digit code. No password to remember. ~20 seconds."
          />
          <Step
            num={2}
            title="Set your quit date and reasons"
            body="Pick today (or back-date if you've already started). Tell us why — we'll resurface it when you're struggling."
          />
          <Step
            num={3}
            title="Create a channel and invite your people"
            body="Generate an invite code. Share it. Now you have a small group rooting for you, in real time."
          />
        </ol>
      </section>

      {/* FEATURE GRID */}
      <section className="bg-neutral-50 py-16 dark:bg-neutral-900/60">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Everything inside
          </h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <Bullet icon="🚭" text="Day counter and current streak" />
            <Bullet icon="💰" text="Money saved + cigs avoided" />
            <Bullet icon="⭐" text="Milestone stars at 1, 7, 30, 90, 180, 365, 730 days" />
            <Bullet icon="📈" text="CDC recovery timeline" />
            <Bullet icon="🌬" text="Box-breathing exercise for cravings" />
            <Bullet icon="📓" text="Craving journal with trigger patterns" />
            <Bullet icon="🎯" text="Savings goal with progress bar" />
            <Bullet icon="🏆" text="Channel leaderboard, sorted by streak" />
            <Bullet icon="👏" text="One-tap cheers to channel-mates" />
            <Bullet icon="🔔" text="Push notifications (PWA, install to home screen)" />
            <Bullet icon="🤝" text="AI coach with daily proactive nudges" />
            <Bullet icon="🆘" text="SOS button broadcasts to all your channels" />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Ready to quit with people in your corner?
        </h2>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Free, no ads, no upsells. Built because solo apps weren&apos;t enough.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-full bg-emerald-600 px-10 py-4 text-lg font-semibold text-white transition hover:bg-emerald-700"
        >
          Get started
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-neutral-200 py-10 text-center text-xs text-neutral-500 dark:border-neutral-800">
        <p>
          Quit Buddy · Private by default · Your channel data only goes to your
          channel-mates.
        </p>
        <p className="mt-2">
          Not medical advice. If you&apos;re in crisis, call or text{" "}
          <a
            className="underline hover:text-neutral-700"
            href="tel:988"
          >
            988
          </a>
          {" "}(US) or your local helpline.
        </p>
      </footer>
    </main>
  );
}

function Problem({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {body}
      </p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
      <p className="text-3xl">{icon}</p>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {body}
      </p>
    </div>
  );
}

function Step({
  num,
  title,
  body,
}: {
  num: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
        {num}
      </span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {body}
        </p>
      </div>
    </li>
  );
}

function PhoneShot({ src, caption }: { src: string; caption: string }) {
  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="overflow-hidden rounded-[2rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-xl dark:border-neutral-700">
        {/* SVGs render directly via img with default browser rendering */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption}
          className="block w-full max-w-[240px]"
          width={240}
          height={480}
        />
      </div>
      <figcaption className="text-center text-xs text-neutral-600 dark:text-neutral-400">
        {caption}
      </figcaption>
    </figure>
  );
}

function Bullet({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-sm dark:bg-neutral-950">
      <span className="text-lg">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
