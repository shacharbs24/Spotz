import { and, eq, sql } from "drizzle-orm";
import { tables } from "@spotz/db";

export function staffAtBusiness(businessId: string, memberId: string) {
  return and(
    eq(tables.staffMembers.businessId, businessId),
    eq(tables.staffMembers.id, memberId),
  );
}

// Null inherits the full catalog, including newly added services.
export const staffServiceIds = sql<string[] | null>`
  case when "staff_members"."uses_all_services" then null
  else array(
    select assignment.service_id
    from ${tables.staffServices} as assignment
    inner join ${tables.services} as service on service.id = assignment.service_id
    where assignment.staff_member_id = "staff_members"."id"
      and service.is_active
  ) end
`;
