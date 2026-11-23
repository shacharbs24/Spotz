"use client";

export function QueryFailure({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3">
      <p role="alert" className="text-sm font-medium text-danger">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-danger bg-surface-raised px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        {retrying ? "טוען מחדש…" : "נסה שוב"}
      </button>
    </div>
  );
}
