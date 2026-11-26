"use client";

import { useState } from "react";
import { QueryFailure } from "@/components/ui/QueryFailure";
import { trpc } from "@/trpc/client";
import type { RouterOutputs } from "@/trpc/types";

type ApprovalData = RouterOutputs["admin"]["getOwnerApprovals"];
type Owner = ApprovalData["owners"][number];
const approvalDate = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function OwnerApprovals() {
  const query = trpc.admin.getOwnerApprovals.useQuery();
  return (
    <section className="grid gap-4" aria-labelledby="owner-approval-heading">
      <div>
        <h2
          id="owner-approval-heading"
          className="text-xl font-bold tracking-tight"
        >
          אישור בעלי עסקים
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          אשרו חשבון לאחר הסדרת החיוב. תאריך האישור נשמר למעקב אחר התשלומים.
        </p>
      </div>
      {query.isError && !query.data ? (
        <QueryFailure
          message="לא הצלחנו לטעון את בקשות האישור."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data ? (
        <ApprovalList data={query.data} />
      ) : (
        <p role="status" className="text-sm text-ink-muted">
          טוענים בקשות אישור…
        </p>
      )}
    </section>
  );
}

function ApprovalList({ data }: { data: ApprovalData }) {
  const utils = trpc.useUtils();
  const [updated, setUpdated] = useState(false);
  const approve = trpc.admin.approveOwner.useMutation({
    onSuccess: ({ approvedAt }, { ownerId }) => {
      utils.admin.getOwnerApprovals.setData(
        undefined,
        (current) =>
          current && {
            ...current,
            owners: current.owners.map((owner) =>
              owner.id === ownerId
                ? { ...owner, accessGranted: true, approvedAt }
                : owner,
            ),
          },
      );
      setUpdated(true);
      void utils.admin.getOwnerApprovals.invalidate();
    },
  });
  const waiting = data.owners.filter((owner) => !owner.accessGranted);
  const active = data.owners.filter((owner) => owner.accessGranted);

  return (
    <>
      <div className="grid gap-4 rounded-xl border border-line bg-surface-raised p-4 sm:p-5">
        <h3 className="text-base font-semibold">
          ממתינים לאישור ({waiting.length})
        </h3>
        {approve.error && (
          <p role="alert" className="text-sm text-danger">
            {approve.error.message}
          </p>
        )}
        {updated && (
          <p role="status" className="text-sm font-medium text-success">
            החשבון אושר ותאריך האישור נשמר.
          </p>
        )}
        {waiting.length ? (
          <ul className="divide-y divide-line">
            {waiting.map((owner) => (
              <OwnerRow key={owner.id} owner={owner}>
                <button
                  type="button"
                  className="action-primary justify-self-start whitespace-nowrap sm:justify-self-end"
                  disabled={approve.isPending}
                  onClick={() => {
                    setUpdated(false);
                    approve.mutate({ ownerId: owner.id });
                  }}
                >
                  {approve.isPending && approve.variables?.ownerId === owner.id
                    ? "מאשרים…"
                    : "אישור בעל העסק"}
                </button>
              </OwnerRow>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">אין כרגע בקשות ממתינות.</p>
        )}
      </div>

      <div className="grid gap-3 rounded-xl border border-line bg-surface-raised p-4 sm:p-5">
        <h3 className="text-base font-semibold">
          בעלי עסקים פעילים ({active.length})
        </h3>
        {active.length ? (
          <ul className="divide-y divide-line">
            {active.map((owner) => (
              <OwnerRow key={owner.id} owner={owner} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            בעלי עסקים שאושרו יופיעו כאן עם תאריך האישור.
          </p>
        )}
      </div>
      <ApprovalContact initialPhone={data.contactPhone} />
    </>
  );
}

function OwnerRow({
  owner,
  children,
}: {
  owner: Owner;
  children?: React.ReactNode;
}) {
  return (
    <li className="grid items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="font-semibold [overflow-wrap:anywhere]">
          <bdi>{owner.businessName || owner.fullName || owner.email}</bdi>
        </p>
        {(owner.businessName || owner.fullName) && (
          <p className="text-sm text-ink-muted [overflow-wrap:anywhere]">
            <bdi>{owner.email}</bdi>
          </p>
        )}
      </div>
      {owner.accessGranted ? (
        <div className="text-sm sm:text-end">
          <p className="text-ink-muted">תאריך אישור</p>
          {owner.approvedAt ? (
            <time dateTime={owner.approvedAt} className="font-semibold">
              {approvalDate.format(new Date(owner.approvedAt))}
            </time>
          ) : (
            <p className="text-ink-muted">גישה קיימת ללא תאריך מתועד</p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-muted sm:col-start-1 sm:row-start-2">
            נרשם ב־
            <time dateTime={owner.registeredAt}>
              {approvalDate.format(new Date(owner.registeredAt))}
            </time>
          </p>
          {children}
        </>
      )}
    </li>
  );
}

function ApprovalContact({ initialPhone }: { initialPhone: string | null }) {
  const utils = trpc.useUtils();
  const [phone, setPhone] = useState(
    initialPhone ? `0${initialPhone.slice(3)}` : "",
  );
  const save = trpc.admin.setOwnerApprovalContact.useMutation({
    onSuccess: ({ contactPhone }) => {
      utils.admin.getOwnerApprovals.setData(
        undefined,
        (current) => current && { ...current, contactPhone },
      );
      setPhone(`0${contactPhone.slice(3)}`);
    },
  });
  return (
    <form
      className="grid gap-3 rounded-xl border border-line bg-surface-raised p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (phone.trim() && !save.isPending) save.mutate({ phone });
      }}
    >
      <div>
        <h3 className="text-base font-semibold">מספר ליצירת קשר</h3>
        <p className="mt-1 text-sm text-ink-muted">
          המספר יוצג לבעלי עסקים במסך ההמתנה לאישור.
        </p>
      </div>
      <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,16rem)_auto] sm:justify-start">
        <div className="grid gap-1">
          <label
            htmlFor="approval-contact-phone"
            className="text-sm font-medium"
          >
            מספר טלפון
          </label>
          <input
            id="approval-contact-phone"
            className="min-h-11 w-full rounded-lg border border-control bg-surface-raised px-3 text-base"
            type="tel"
            inputMode="tel"
            dir="ltr"
            required
            maxLength={32}
            readOnly={save.isPending}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              if (save.isError || save.isSuccess) save.reset();
            }}
            aria-invalid={save.isError}
            aria-describedby={
              save.isError ? "approval-contact-error" : undefined
            }
          />
        </div>
        <button
          type="submit"
          className="action-primary"
          disabled={!phone.trim() || save.isPending}
        >
          {save.isPending ? "שומרים…" : "שמירת מספר"}
        </button>
      </div>
      {save.error && (
        <p
          id="approval-contact-error"
          role="alert"
          className="text-sm text-danger"
        >
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="text-sm font-medium text-success">
          המספר נשמר.
        </p>
      )}
    </form>
  );
}
