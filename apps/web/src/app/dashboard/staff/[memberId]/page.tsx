import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { StaffBookingSettings } from "@/components/dashboard/staff/StaffBookingSettings";
import { getServerCaller } from "@/trpc/server";

export default async function StaffBookingSettingsPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const [{ userId }, caller, { memberId }] = await Promise.all([
    auth(),
    getServerCaller(),
    params,
  ]);
  if (!userId) redirect("/");
  if ((await caller.me.getProfile()).role !== "OWNER") redirect("/");
  if (!z.string().uuid().safeParse(memberId).success) notFound();

  return <StaffBookingSettings memberId={memberId} />;
}
