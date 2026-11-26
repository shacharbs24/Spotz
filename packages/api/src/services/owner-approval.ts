import { db, tables } from "@spotz/db";

export async function getOwnerApprovalContactPhone() {
  const [settings] = await db
    .select({ contactPhone: tables.ownerApprovalSettings.contactPhone })
    .from(tables.ownerApprovalSettings);
  return settings?.contactPhone ?? null;
}
