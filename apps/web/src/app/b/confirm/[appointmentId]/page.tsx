import { notFound } from "next/navigation";
import { getServerCaller } from "@/trpc/server";
import { ConfirmActions } from "@/components/public/ConfirmActions";

interface ConfirmPageProps {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function ConfirmAppointmentPage({
  params,
  searchParams,
}: ConfirmPageProps) {
  const [{ appointmentId }, { token }] = await Promise.all([
    params,
    searchParams,
  ]);

  if (!token) {
    notFound();
  }

  const caller = await getServerCaller();
  let details: Awaited<ReturnType<typeof caller.public.getAppointmentDetails>> =
    null;
  try {
    details = await caller.public.getAppointmentDetails({
      appointmentId,
      token,
    });
  } catch {
    // Invalid id format etc. → treat as not found.
    details = null;
  }

  if (!details) {
    notFound();
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-surface px-6 py-16"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-owner-soft blur-3xl"
      />

      <div className="relative z-10 w-full max-w-md">
        <p className="mb-2 text-center text-sm font-medium text-owner">
          {details.businessName}
        </p>
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-ink">
          אישור הגעה לתור
        </h1>

        <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface-raised p-6 shadow-soft sm:p-8">
          <dl className="flex flex-col gap-3 text-sm">
            <Row label="שם">{details.clientName}</Row>
            <Row label="שירות">{details.serviceName}</Row>
            <Row label="תאריך">{details.date}</Row>
            <Row label="שעה">
              <span dir="ltr">
                {details.startTime}–{details.endTime}
              </span>
            </Row>
          </dl>

          <div className="h-px bg-line" />

          <ConfirmActions
            appointmentId={details.id}
            token={token}
            initialStatus={details.status}
            initialArrivalConfirmed={details.arrivalConfirmed}
          />
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}
