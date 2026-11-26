"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshOwnerApproval() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="min-h-11 cursor-pointer self-start rounded-lg border border-line px-4 text-sm font-semibold text-owner hover:bg-owner-soft disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "בודקים…" : "בדיקת סטטוס האישור"}
    </button>
  );
}
