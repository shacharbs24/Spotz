"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { QueryFailure } from "@/components/ui/QueryFailure";
import { trpc } from "@/trpc/client";

const secondaryAction =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line px-3 text-sm font-semibold text-owner hover:bg-owner-soft disabled:cursor-not-allowed disabled:opacity-60";

export function StaffManager() {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const staff = trpc.staff.list.useQuery();
  const addMember = trpc.staff.create.useMutation({
    onSuccess: (member) => {
      utils.staff.list.setData(undefined, (data) => {
        if (
          !data?.hasBusiness ||
          data.members.some((person) => person.id === member.id)
        )
          return data;
        return { ...data, members: [...data.members, member] };
      });
      setName("");
      setMessage(`${member.name} מופיע כעת בדף ההזמנות.`);
      void utils.staff.list.invalidate();
    },
  });

  if (staff.isError) {
    return (
      <QueryFailure
        message="לא הצלחנו לטעון את רשימת הצוות."
        onRetry={() => void staff.refetch()}
        retrying={staff.isFetching}
      />
    );
  }
  if (!staff.data) {
    return (
      <p role="status" className="text-sm text-ink-muted">
        טוענים את רשימת הצוות…
      </p>
    );
  }
  if (!staff.data.hasBusiness) {
    return (
      <section className="grid justify-items-start gap-3 rounded-xl border border-line bg-surface-raised p-5">
        <h2 className="text-lg font-semibold">
          צריך להגדיר עסק לפני הוספת צוות
        </h2>
        <Link href="/dashboard/business" className="action-primary">
          לפרטי העסק
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <section
        aria-labelledby="staff-list-heading"
        className="rounded-xl border border-line bg-surface-raised p-4 sm:p-5"
      >
        <h2 id="staff-list-heading" className="mb-2 text-lg font-semibold">
          אנשי צוות בדף ההזמנות
        </h2>
        <ul className="divide-y divide-line">
          {staff.data.members.length === 0 ? (
            <EditableStaffName
              memberId={null}
              name={staff.data.ownerBookingName}
            />
          ) : (
            staff.data.members.map((member) => (
              <EditableStaffName
                key={member.id}
                memberId={member.id}
                name={member.name}
              />
            ))
          )}
        </ul>
      </section>

      <section
        aria-labelledby="new-staff-heading"
        className="grid gap-4 rounded-xl border border-line bg-surface-raised p-4 sm:p-5"
      >
        <div>
          <h2 id="new-staff-heading" className="text-lg font-semibold">
            הוספת איש צוות
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            לכל איש צוות יש יומן משלו. אפשר להגדיר לו שעות, חסימות ושירותים.
          </p>
        </div>
        <NameForm
          name={name}
          onChange={(value) => {
            setName(value);
            if (addMember.isError) addMember.reset();
          }}
          onSubmit={(value) => {
            setMessage("");
            addMember.mutate({ name: value });
          }}
          pending={addMember.isPending}
          error={addMember.error?.message}
          submitLabel={addMember.isPending ? "מוסיפים…" : "הוספה לצוות"}
        />
        {message && (
          <p
            role="status"
            className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success"
          >
            {message}
          </p>
        )}
      </section>
    </div>
  );
}

function EditableStaffName({
  memberId,
  name,
}: {
  memberId: string | null;
  name: string;
}) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const rename = trpc.staff.rename.useMutation({
    onSuccess: ({ name: updated }) => {
      utils.staff.list.setData(undefined, (data) => {
        if (!data?.hasBusiness) return data;
        return memberId === null
          ? { ...data, ownerBookingName: updated }
          : {
              ...data,
              members: data.members.map((member) =>
                member.id === memberId ? { ...member, name: updated } : member,
              ),
            };
      });
      setSaved(true);
      closeEditor();
      void utils.staff.list.invalidate();
    },
  });

  function closeEditor() {
    setDraft(null);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  return (
    <li className="grid gap-2 py-2">
      {draft === null ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-semibold [overflow-wrap:anywhere]">
              <bdi>{name}</bdi>
            </p>
            {memberId === null && (
              <p className="text-sm text-ink-muted">
                השם שיוצג ללקוחות כשאין אנשי צוות מוגדרים.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {memberId && (
              <Link
                href={`/dashboard/staff/${memberId}`}
                aria-label={`זמינות ושירותים עבור ${name}`}
                className={secondaryAction}
              >
                זמינות ושירותים
              </Link>
            )}
            <button
              type="button"
              ref={editButton}
              aria-label={`עריכת שם לתצוגה עבור ${name}`}
              onClick={() => {
                rename.reset();
                setSaved(false);
                setDraft(name);
              }}
              className={secondaryAction}
            >
              עריכת שם
            </button>
          </div>
        </div>
      ) : (
        <NameForm
          name={draft}
          onChange={(value) => {
            setDraft(value);
            if (rename.isError) rename.reset();
          }}
          onSubmit={(value) => rename.mutate({ memberId, name: value })}
          onCancel={closeEditor}
          pending={rename.isPending}
          error={rename.error?.message}
          submitLabel={rename.isPending ? "שומרים…" : "שמירת שם"}
        />
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          שם התצוגה עודכן.
        </p>
      )}
    </li>
  );
}

function NameForm({
  name,
  onChange,
  onSubmit,
  onCancel,
  pending,
  error,
  submitLabel,
}: {
  name: string;
  onChange: (name: string) => void;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
  pending: boolean;
  error?: string;
  submitLabel: string;
}) {
  const nameId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const editing = Boolean(onCancel);
  const trimmedName = name.trim();
  const saveDisabled =
    pending || trimmedName.length < 2 || trimmedName.length > 80;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!saveDisabled) onSubmit(trimmedName);
      }}
      className="grid items-end gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="grid gap-1.5">
        <label htmlFor={nameId} className="text-sm font-semibold">
          שם לתצוגה
        </label>
        <input
          id={nameId}
          ref={inputRef}
          type="text"
          dir="auto"
          value={name}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={2}
          maxLength={80}
          readOnly={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${nameId}-error` : undefined}
          className="min-h-11 w-full rounded-lg border border-control bg-surface-raised px-3 text-base"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saveDisabled}
          className="action-primary grow"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={secondaryAction}
          >
            ביטול
          </button>
        )}
      </div>
      {error && (
        <p
          id={`${nameId}-error`}
          role="alert"
          className="text-sm text-danger sm:col-span-full"
        >
          {error}
        </p>
      )}
    </form>
  );
}
