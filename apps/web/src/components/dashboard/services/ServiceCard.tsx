"use client";

import { useState } from "react";
import type { ServiceRow } from "@/trpc/types";
import { formatPrice } from "@/lib/format";

interface ServiceCardProps {
  service: ServiceRow;
  onEdit: (service: ServiceRow) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export function ServiceCard({
  service,
  onEdit,
  onDelete,
  isDeleting,
}: ServiceCardProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-soft transition-all duration-300 hover:border-owner/40">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold tracking-tight text-ink">
            {service.name}
          </h3>
          {service.description && (
            <p className="text-sm leading-6 text-ink-muted">
              {service.description}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-owner-soft px-3 py-1 text-sm font-semibold text-owner">
          {formatPrice(service.priceCents, service.currency)}
        </span>
      </div>

      <div className="flex items-center justify-end gap-3">
        {confirming ? (
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="text-ink-muted">למחוק?</span>
            <button
              type="button"
              onClick={() => onDelete(service.id)}
              disabled={isDeleting}
              className="cursor-pointer font-medium text-client transition-colors hover:underline disabled:opacity-60"
            >
              {isDeleting ? "מוחק…" : "כן, מחק"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="cursor-pointer text-ink-muted transition-colors hover:text-ink"
            >
              ביטול
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(service)}
              className="cursor-pointer rounded-full px-3 py-1 text-sm font-medium text-ink-muted transition-colors hover:bg-line hover:text-ink"
            >
              עריכה
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="cursor-pointer rounded-full px-3 py-1 text-sm font-medium text-client transition-colors hover:bg-client-soft"
            >
              מחיקה
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
