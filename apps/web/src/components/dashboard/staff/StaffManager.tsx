"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { QueryFailure } from "@/components/ui/QueryFailure";
import { trpc } from "@/trpc/client";

export function StaffManager() {
  const nameId = useId();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const staff = trpc.staff.list.useQuery();
  const addMember = trpc.staff.create.useMutation({
    onSuccess: (member) => {
      utils.staff.list.setData(undefined, (data) =>
        data?.hasBusiness
          ? { ...data, members: [...data.members, member] }
          : data,
      );
      setName("");
      setMessage(`${member.name} מופיע כעת בדף ההזמנות.`);
      void utils.staff.list.invalidate();
    },
  });

  function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2 || addMember.isPending) return;
    setMessage("");
    addMember.mutate({ name: name.trim() });
  }

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
        aria-labelledby="new-staff-heading"
        className="grid gap-4 rounded-xl border border-line bg-surface-raised p-4 sm:p-5"
      >
        <div>
          <h2 id="new-staff-heading" className="text-lg font-semibold">
            הוספת איש צוות
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            לכל איש צוות יש יומן משלו. כולם חולקים את השירותים, שעות הפעילות
            והחסימות של העסק.
          </p>
        </div>
        <form
          onSubmit={submitMember}
          className="grid items-end gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="grid gap-1.5">
            <label htmlFor={nameId} className="text-sm font-semibold">
              שם לתצוגה
            </label>
            <input
              id={nameId}
              type="text"
              dir="auto"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (addMember.isError) addMember.reset();
              }}
              required
              minLength={2}
              maxLength={80}
              readOnly={addMember.isPending}
              aria-invalid={addMember.isError}
              aria-describedby={
                addMember.isError ? `${nameId}-error` : undefined
              }
              className="min-h-11 w-full rounded-lg border border-control bg-surface-raised px-3 text-base"
            />
          </div>
          <button
            type="submit"
            disabled={addMember.isPending || name.trim().length < 2}
            className="action-primary"
          >
            {addMember.isPending ? "מוסיפים…" : "הוספה לצוות"}
          </button>
        </form>
        {addMember.error && (
          <p
            id={`${nameId}-error`}
            role="alert"
            className="text-sm text-danger"
          >
            {addMember.error.message}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success"
          >
            {message}
          </p>
        )}
      </section>
      <section
        aria-labelledby="staff-list-heading"
        className="rounded-xl border border-line bg-surface-raised p-4 sm:p-5"
      >
        <h2 id="staff-list-heading" className="mb-3 text-lg font-semibold">
          יומנים פתוחים להזמנה
        </h2>
        <ul className="divide-y divide-line">
          <li className="py-2.5">
            <p className="font-semibold">יומן העסק</p>
            <p className="text-sm text-ink-muted">
              היומן הכללי שכבר משמש להזמנות
            </p>
          </li>
          {staff.data.members.map((member) => (
            <li
              key={member.id}
              className="py-2.5 text-start font-semibold [overflow-wrap:anywhere]"
            >
              <bdi>{member.name}</bdi>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
