"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import type { BlockedPeriodRow } from "@/trpc/types";
import { Modal } from "@/components/ui/Modal";
import { QueryFailure } from "@/components/ui/QueryFailure";
import { BlockedPeriodForm } from "./BlockedPeriodForm";

export function BlockedPeriodsManager({
  staffMemberId,
}: {
  staffMemberId?: string;
}) {
  const utils = trpc.useUtils();
  const input = staffMemberId ? { staffMemberId } : undefined;
  const blocksQuery = trpc.blocks.getBlockedPeriods.useQuery(input);

  const deleteBlock = trpc.blocks.deleteBlockedPeriod.useMutation({
    onSuccess: () => {
      void utils.public.getAvailableDates.invalidate();
      void utils.public.getAvailableSlots.invalidate();
      return utils.blocks.getBlockedPeriods.invalidate(input);
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);

  const blocks = blocksQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          {blocks.length > 0
            ? `${blocks.length} חסימות פעילות`
            : "אין חסימות מתוכננות"}
        </p>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-owner px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
        >
          <span className="text-base leading-none">+</span>
          הוספת חסימה
        </button>
      </div>

      {blocksQuery.isLoading ? (
        <ListSkeleton />
      ) : blocksQuery.isError && !blocksQuery.data ? (
        <QueryFailure
          message="לא הצלחנו לטעון את החסימות."
          onRetry={() => void blocksQuery.refetch()}
          retrying={blocksQuery.isFetching}
        />
      ) : blocks.length === 0 ? (
        <EmptyState onAdd={() => setDialogOpen(true)} />
      ) : (
        <ul className="flex flex-col gap-3">
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              onDelete={() =>
                deleteBlock.mutate({ id: block.id, staffMemberId })
              }
              isDeleting={
                deleteBlock.isPending && deleteBlock.variables?.id === block.id
              }
            />
          ))}
        </ul>
      )}
      {deleteBlock.error && (
        <p role="alert" className="text-sm text-danger">
          {deleteBlock.error.message}
        </p>
      )}

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="חסימה חדשה"
      >
        <BlockedPeriodForm
          staffMemberId={staffMemberId}
          onClose={() => setDialogOpen(false)}
        />
      </Modal>
    </div>
  );
}

interface BlockCardProps {
  block: BlockedPeriodRow;
  onDelete: () => void;
  isDeleting: boolean;
}

function BlockCard({ block, onDelete, isDeleting }: BlockCardProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-raised p-4 shadow-soft">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-ink">{block.dateLabel}</span>
        <span className="text-sm text-ink-muted">
          {block.timeLabel}
          {block.reason ? ` · ${block.reason}` : ""}
        </span>
      </div>

      {confirming ? (
        <span className="inline-flex items-center gap-2 text-sm">
          <span className="text-ink-muted">למחוק?</span>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="cursor-pointer font-medium text-danger transition-colors hover:underline disabled:opacity-60"
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
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="cursor-pointer rounded-full px-3 py-1 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
        >
          מחיקה
        </button>
      )}
    </li>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-14 text-center">
      <p className="text-ink">אין חסימות מתוכננות.</p>
      <p className="max-w-sm text-sm text-ink-muted">
        חסמו ימי חופשה או שעות מסוימות כדי שלא יוצעו ללקוחות לקביעת תור.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="cursor-pointer rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
      >
        הוספת חסימה ראשונה
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border border-line bg-surface-raised p-4 shadow-soft"
        >
          <div className="flex flex-col gap-2">
            <div className="h-4 w-40 animate-pulse rounded bg-line" />
            <div className="h-3 w-24 animate-pulse rounded bg-line" />
          </div>
          <div className="h-7 w-16 animate-pulse rounded-full bg-line" />
        </div>
      ))}
    </div>
  );
}
