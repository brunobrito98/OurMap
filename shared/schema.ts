import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  real,
  uuid,
  numeric,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Additional fields for username/password authentication
  username: varchar("username").unique(),
  password: varchar("password"),
  authType: varchar("auth_type").default("replit"), // 'replit', 'local', or 'phone'
  role: varchar("role").default("user"), // 'user', 'admin', 'super_admin'
  // Phone authentication fields
  phoneE164: varchar("phone_e164").unique(), // Phone number in E.164 format (+5511999999999)
  phoneVerified: boolean("phone_verified").default(false), // Whether phone is verified
  phoneCountry: varchar("phone_country", { length: 2 }), // ISO2 country code (BR, US, etc.)
  phoneHmac: varchar("phone_hmac").unique(), // HMAC-SHA256 of phone for contact matching
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("outros"),
  dateTime: timestamp("date_time", { withTimezone: true }).notNull(),
  location: text("location").notNull(),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  creatorId: uuid("creator_id").notNull(),
  maxAttendees: integer("max_attendees"),
  price: numeric("price", { precision: 10, scale: 2 }).default("0"),
  imageUrl: text("image_url"),
  iconEmoji: text("icon_emoji").default("🎉"),
  coverImageUrl: text("cover_image_url"),
  popularityScore: integer("popularity_score").default(0),
  isRecurring: boolean("is_recurring").default(false),
  recurrenceType: text("recurrence_type"),
  recurrenceInterval: integer("recurrence_interval").default(1),
  recurrenceEndDate: timestamp("recurrence_end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const eventAttendees = pgTable("event_attendees", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("attending"), // attending, interested, not_going
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueEventUser: unique().on(table.eventId, table.userId),
}));

export const friendships = pgTable("friendships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addresseeId: uuid("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending, accepted, declined
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueFriendship: unique().on(table.requesterId, table.addresseeId),
}));

export const eventRatings = pgTable("event_ratings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizerRating: integer("organizer_rating"), // 1-5 stars for organizer
  eventRating: integer("event_rating"), // 1-5 stars for event
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserEventRating: unique().on(table.eventId, table.userId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  organizedEvents: many(events),
  attendances: many(eventAttendees),
  sentFriendRequests: many(friendships, { relationName: "requester" }),
  receivedFriendRequests: many(friendships, { relationName: "addressee" }),
  ratings: many(eventRatings),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, {
    fields: [events.creatorId],
    references: [users.id],
  }),
  attendances: many(eventAttendees),
  ratings: many(eventRatings),
}));

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendees.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventAttendees.userId],
    references: [users.id],
  }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(users, {
    fields: [friendships.requesterId],
    references: [users.id],
    relationName: "requester",
  }),
  addressee: one(users, {
    fields: [friendships.addresseeId],
    references: [users.id],
    relationName: "addressee",
  }),
}));

export const eventRatingsRelations = relations(eventRatings, ({ one }) => ({
  event: one(events, {
    fields: [eventRatings.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventRatings.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  creatorId: true,
  latitude: true,
  longitude: true,
}).extend({
  dateTime: z.string().min(1, "Data e hora são obrigatórias").datetime({ offset: true }),
  location: z.string().min(1, "Localização é obrigatória"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Preço deve ser um valor numérico válido").optional(),
  recurrenceEndDate: z.string().datetime({ offset: true }).optional().or(z.literal("")),
});

export const insertEventAttendanceSchema = createInsertSchema(eventAttendees).omit({
  id: true,
  createdAt: true,
});

export const insertFriendshipSchema = createInsertSchema(friendships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventRatingSchema = createInsertSchema(eventRatings).omit({
  id: true,
  createdAt: true,
});

// User schemas for different auth types
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLocalUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  profileImageUrl: true,
  authType: true,
  role: true,
  phoneE164: true,
  phoneVerified: true,
  phoneCountry: true,
  phoneHmac: true,
}).extend({
  username: z.string().min(3, "Username deve ter pelo menos 3 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  email: z.string().email("Email deve ser válido"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
});

// Phone authentication schemas
export const phoneStartSchema = z.object({
  phone: z.string().min(1, "Número de telefone é obrigatório"),
  country: z.string().length(2, "Código do país deve ter 2 caracteres").optional(),
});

export const phoneVerifySchema = z.object({
  phone: z.string().min(1, "Número de telefone é obrigatório"),
  code: z.string().length(6, "Código deve ter 6 dígitos").regex(/^\d{6}$/, "Código deve conter apenas números"),
});

export const phoneLinkSchema = z.object({
  phone: z.string().min(1, "Número de telefone é obrigatório"),
  code: z.string().length(6, "Código deve ter 6 dígitos").regex(/^\d{6}$/, "Código deve conter apenas números"),
});

export const contactsMatchSchema = z.object({
  contacts: z.array(z.string()).max(1000, "Máximo de 1000 contatos por vez"),
});

// Admin user creation schema
export const insertAdminUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  profileImageUrl: true,
  authType: true,
}).extend({
  username: z.string().min(3, "Username deve ter pelo menos 3 caracteres"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  email: z.string().email("Email deve ser válido"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
  role: z.enum(["admin", "super_admin"]),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertLocalUser = z.infer<typeof insertLocalUserSchema>;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type PhoneStart = z.infer<typeof phoneStartSchema>;
export type PhoneVerify = z.infer<typeof phoneVerifySchema>;
export type PhoneLink = z.infer<typeof phoneLinkSchema>;
export type ContactsMatch = z.infer<typeof contactsMatchSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EventAttendance = typeof eventAttendees.$inferSelect;
export type InsertEventAttendance = z.infer<typeof insertEventAttendanceSchema>;
export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type EventRating = typeof eventRatings.$inferSelect;
export type InsertEventRating = z.infer<typeof insertEventRatingSchema>;

// Sanitized types for API responses (excludes sensitive fields)
export type OrganizerSanitized = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string | null;
  authType: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type UserSanitized = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  username: string | null;
  authType: string | null;
  role: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

// Extended types for API responses
export type EventWithDetails = Event & {
  organizer: OrganizerSanitized;
  attendanceCount: number;
  userAttendance?: EventAttendance;
  distance?: number;
  friendsGoing?: UserSanitized[];
};

export type UserWithStats = User & {
  eventsCreated: number;
  eventsAttended: number;
  friendsCount: number;
  averageRating?: number;
};
