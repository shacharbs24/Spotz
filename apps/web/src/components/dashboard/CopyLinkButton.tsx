"use client";

import { useState } from "react";

/**
 * Copies the business's public booking link ({origin}/b/{slug}) to the
 * clipboard with brief "copied" feedback. Origin is read at click time so the
 * link matches whatever host the owner is on (local, ngrok, production).
 */
export function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/b/${slug}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission).
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
        copied
          ? "border-success/40 bg-success-soft text-success"
          : "border-line bg-surface-raised text-ink hover:border-owner/40 hover:text-owner"
      }`}
    >
      {copied ? (
        <>
          הועתק! <span aria-hidden="true">✅</span>
        </>
      ) : (
        <>
          <CopyIcon />
          העתק קישור לעסק
        </>
      )}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
