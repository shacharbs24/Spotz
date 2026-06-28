import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@spotz/api";

/** Inferred I/O types for the tRPC API — keeps client types in sync with the server. */
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export type ServiceRow = RouterOutputs["services"]["getServices"][number];

export type PublicBusinessData = NonNullable<
  RouterOutputs["public"]["getBusinessBySlug"]
>;
export type PublicService = PublicBusinessData["services"][number];

export type AppointmentRow =
  RouterOutputs["appointments"]["getDashboardAppointments"][number];

export type BlockedPeriodRow =
  RouterOutputs["blocks"]["getBlockedPeriods"][number];

export type MyAppointmentsData = RouterOutputs["me"]["getMyAppointments"];
export type ClientAppointment = MyAppointmentsData["upcoming"][number];

export type MyBusiness = RouterOutputs["me"]["getMyBusinesses"][number];

export type BusinessReview =
  RouterOutputs["reviews"]["getBusinessReviews"][number];
export type RatingSummary =
  RouterOutputs["reviews"]["getBusinessRatingSummary"];
