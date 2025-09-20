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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Additional fields for username/password authentication
  username: varchar("username").unique(),
  password: varchar("password"),
  authType: varchar("auth_type").default("replit"), // 'replit' or 'local'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  category: varchar("category").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  address: text("address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  isFree: boolean("is_free").default(true),
  coverImageUrl: varchar("cover_image_url"),
  iconType: varchar("icon_type").default("calendar"),
  maxAttendees: integer("max_attendees"),
  allowRsvp: boolean("allow_rsvp").default(true),
  isRecurring: boolean("is_recurring").default(false),
  recurringType: varchar("recurring_type"), // weekly, monthly, yearly
  organizerId: varchar("organizer_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventAttendances = pgTable("event_attendances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status").notNull(), // confirmed, interested, not_going
  createdAt: timestamp("created_at").defaultNow(),
});

export const friendships = pgTable("friendships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addresseeId: varchar("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status").notNull(), // pending, accepted, declined
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventRatings = pgTable("event_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizerRating: integer("organizer_rating"), // 1-5 stars for organizer
  eventRating: integer("event_rating"), // 1-5 stars for event
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  organizedEvents: many(events),
  attendances: many(eventAttendances),
  sentFriendRequests: many(friendships, { relationName: "requester" }),
  receivedFriendRequests: many(friendships, { relationName: "addressee" }),
  ratings: many(eventRatings),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, {
    fields: [events.organizerId],
    references: [users.id],
  }),
  attendances: many(eventAttendances),
  ratings: many(eventRatings),
}));

export const eventAttendancesRelations = relations(eventAttendances, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendances.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventAttendances.userId],
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
  organizerId: true,
  latitude: true,
  longitude: true,
}).extend({
  startDate: z.string().min(1, "Data de início é obrigatória").regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Formato de data inválido"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Formato de data inválido").optional().or(z.literal("")),
});

export const insertEventAttendanceSchema = createInsertSchema(eventAttendances).omit({
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
}).extend({
  username: z.string().min(3, "Username deve ter pelo menos 3 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  email: z.string().email("Email deve ser válido"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertLocalUser = z.infer<typeof insertLocalUserSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EventAttendance = typeof eventAttendances.$inferSelect;
export type InsertEventAttendance = z.infer<typeof insertEventAttendanceSchema>;
export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type EventRating = typeof eventRatings.$inferSelect;
export type InsertEventRating = z.infer<typeof insertEventRatingSchema>;

// Extended types for API responses
export type EventWithDetails = Event & {
  organizer: User;
  attendanceCount: number;
  userAttendance?: EventAttendance;
  distance?: number;
  friendsGoing?: User[];
};

export type UserWithStats = User & {
  eventsCreated: number;
  eventsAttended: number;
  friendsCount: number;
  averageRating?: number;
};
