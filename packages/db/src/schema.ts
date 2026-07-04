import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  time,
  date,
  boolean,
  pgEnum,
  smallint,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- Enums ---
export const userRole = pgEnum("user_role", ["OWNER", "CLIENT"]);
export const appointmentStatus = pgEnum("appointment_status", [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
]);
// --- Outbound messaging enums ---
export const messageChannel = pgEnum("message_channel", ["WHATSAPP"]);
export const messageType = pgEnum("message_type", ["REMINDER_24H"]);
export const messageStatus = pgEnum("message_status", [
  "PENDING",
  "SENT",
  "FAILED",
  "SKIPPED",
]);

// --- Users (ממופה ל-Clerk) ---
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(), // user_xxx מ-Clerk
  email: text("email").notNull(),
  fullName: text("full_name"),
  phone: text("phone"),
  role: userRole("role").notNull().default("CLIENT"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Businesses ---
export const businesses = pgTable("businesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // לכתובת ציבורית: /b/[slug]
  description: text("description"),
  imageUrl: text("image_url"), // לוגו/תמונת קאבר — URL חיצוני (R2 בהמשך)
  phone: text("phone"),
  city: text("city"), // עיר — נשמר כ-UTF-8, תומך בעברית
  address: text("address"), // כתובת מלאה — תומך בעברית
  timezone: text("timezone").notNull().default("Asia/Jerusalem"),
  // --- Booking window ---
  autoOpenCalendar: boolean("auto_open_calendar").notNull().default(true),
  autoOpenDays: integer("auto_open_days").notNull().default(14), // today + N days
  manualOpenUntil: date("manual_open_until"), // hard cap when auto is off (nullable)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Business Photos (URLs מ-R2) ---
export const businessPhotos = pgTable("business_photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// --- Services ---
export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"), // תיאור חופשי — תומך בעברית
  durationMinutes: integer("duration_minutes").notNull().default(30),
  priceCents: integer("price_cents").notNull(), // אגורות — תמיד שלמים, לא float
  currency: text("currency").notNull().default("ILS"),
  isActive: boolean("is_active").notNull().default(true),
  // When true, bookings for this service start as PENDING and await manual owner
  // approval; when false they are auto-confirmed (CONFIRMED) on creation.
  // Defaults to manual approval to preserve the pre-feature booking behavior.
  requiresApproval: boolean("requires_approval").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Working Hours (שורה לכל יום בשבוע) ---
export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(), // 0=ראשון ... 6=שבת
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isClosed: boolean("is_closed").notNull().default(false),
  },
  (t) => ({
    uniqDay: uniqueIndex("uq_business_day").on(t.businessId, t.dayOfWeek),
  }),
);

// --- Clients (לקוחות אורחים — מזוהים לפי טלפון, פר עסק) ---
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // Linked authenticated user, when the booking was made while signed in.
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // לקוח חוזר מזוהה לפי (עסק, טלפון) — משמש ל-upsert בעת הזמנה
    uniqPhone: uniqueIndex("uq_client_business_phone").on(t.businessId, t.phone),
  }),
);

// --- Appointments ---
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").notNull().default("PENDING"),
    // When the client confirmed arrival via the WhatsApp reminder link. Tracked
    // separately from `status` so it stays distinct from owner/auto approval.
    arrivalConfirmedAt: timestamp("arrival_confirmed_at", { withTimezone: true }),
    priceCentsSnapshot: integer("price_cents_snapshot").notNull(), // נעילת מחיר בזמן ההזמנה
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // האינדקס החם של לוח היומן בדאשבורד
    byBusinessTime: index("idx_appt_business_time").on(t.businessId, t.startAt),
  }),
);

// --- Blocked Periods (חופשות / חסימות יומן) ---
export const blockedPeriods = pgTable(
  "blocked_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    reason: text("reason"), // הערה חופשית — "חופשה", "פגישה" וכו'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byBusinessTime: index("idx_blocked_business_time").on(
      t.businessId,
      t.startAt,
    ),
  }),
);

// --- Appointment Messages (תיעוד הודעות יוצאות — תזכורות WhatsApp) ---
export const appointmentMessages = pgTable(
  "appointment_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    channel: messageChannel("channel").notNull().default("WHATSAPP"),
    type: messageType("type").notNull().default("REMINDER_24H"),
    status: messageStatus("status").notNull().default("PENDING"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    providerMessageId: text("provider_message_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // לכל הזמנה הודעה אחת מכל סוג — מונע שליחה כפולה
    uniqApptType: uniqueIndex("uq_appt_message_type").on(
      t.appointmentId,
      t.type,
    ),
    // אינדקס לסריקת ה-cron: לפי סטטוס וזמן מתוזמן
    byStatusScheduled: index("idx_message_status_scheduled").on(
      t.status,
      t.scheduledFor,
    ),
  }),
);

// --- Reviews (חוות דעת על עסק, מקושרות לתור שהושלם) ---
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // Nullable: appointment-based reviews link both; direct public reviews link neither.
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "cascade",
    }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    rating: integer("rating").notNull(), // 1–5, נאכף ב-check constraint
    comment: text("comment"),
    // Display name for direct reviews (or when no client row); appointment-based
    // reviews fall back to the client's name.
    reviewerName: text("reviewer_name"),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // חוות דעת אחת לכל תור
    uniqAppointment: uniqueIndex("uq_review_appointment").on(t.appointmentId),
    byBusinessCreated: index("idx_review_business_created").on(
      t.businessId,
      t.createdAt,
    ),
    byBusinessVisible: index("idx_review_business_visible").on(
      t.businessId,
      t.isVisible,
    ),
    ratingRange: check("review_rating_range", sql`${t.rating} between 1 and 5`),
  }),
);
