"use client";

import { useState } from "react";

export function ShareButton({
  channelName,
  inviteCode,
}: {
  channelName: string;
  inviteCode: string;
}) {
  const [copied, setCopied] = useState(false);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/app/channels/join?code=${inviteCode}`
      : "";

  const shareText = `Join me on Quit Buddy in "${channelName}". Invite code: ${inviteCode}\n${inviteUrl}`;

  async function onShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Join "${channelName}" on Quit Buddy`,
          text: `Invite code: ${inviteCode}`,
          url: inviteUrl,
        });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={onShare}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
    >
      {copied ? "Copied!" : "Invite friends"}
    </button>
  );
}
