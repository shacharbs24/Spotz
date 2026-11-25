export function getBookingOwnerName(
  business: { ownerBookingName: string | null; name: string },
  ownerFullName: string | null | undefined,
) {
  return business.ownerBookingName || ownerFullName?.trim() || business.name;
}
