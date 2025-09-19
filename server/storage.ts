import {
  users,
  events,
  eventAttendances,
  friendships,
  eventRatings,
  type User,
  type UpsertUser,
  type Event,
  type InsertEvent,
  type EventAttendance,
  type InsertEventAttendance,
  type Friendship,
  type InsertFriendship,
  type EventRating,
  type InsertEventRating,
  type EventWithDetails,
  type UserWithStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, count, avg, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserWithStats(id: string): Promise<UserWithStats | undefined>;

  // Event operations
  createEvent(event: InsertEvent, organizerId: string, coordinates: { lat: number; lng: number }): Promise<Event>;
  getEvent(id: string): Promise<Event | undefined>;
  getEventWithDetails(id: string, userId?: string): Promise<EventWithDetails | undefined>;
  getEvents(filters?: {
    category?: string;
    userLat?: number;
    userLng?: number;
    userId?: string;
  }): Promise<EventWithDetails[]>;
  updateEvent(id: string, event: Partial<InsertEvent>, coordinates?: { lat: number; lng: number }): Promise<Event | undefined>;
  deleteEvent(id: string, organizerId: string): Promise<boolean>;

  // Attendance operations
  createAttendance(attendance: InsertEventAttendance): Promise<EventAttendance>;
  getAttendance(eventId: string, userId: string): Promise<EventAttendance | undefined>;
  updateAttendance(eventId: string, userId: string, status: string): Promise<EventAttendance | undefined>;
  getEventAttendees(eventId: string): Promise<User[]>;

  // Friendship operations
  sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship>;
  respondToFriendRequest(requestId: string, status: string): Promise<Friendship | undefined>;
  getFriends(userId: string): Promise<User[]>;
  getFriendRequests(userId: string): Promise<(Friendship & { requester: User })[]>;
  areFriends(userId1: string, userId2: string): Promise<boolean>;

  // Rating operations
  createRating(rating: InsertEventRating): Promise<EventRating>;
  getEventRatings(eventId: string): Promise<EventRating[]>;
  getUserRatings(userId: string): Promise<EventRating[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserWithStats(id: string): Promise<UserWithStats | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const [eventsCreatedResult] = await db
      .select({ count: count() })
      .from(events)
      .where(eq(events.organizerId, id));

    const [eventsAttendedResult] = await db
      .select({ count: count() })
      .from(eventAttendances)
      .where(and(
        eq(eventAttendances.userId, id),
        eq(eventAttendances.status, 'confirmed')
      ));

    const [friendsResult] = await db
      .select({ count: count() })
      .from(friendships)
      .where(and(
        or(
          eq(friendships.requesterId, id),
          eq(friendships.addresseeId, id)
        ),
        eq(friendships.status, 'accepted')
      ));

    const [ratingResult] = await db
      .select({ avg: avg(eventRatings.organizerRating) })
      .from(eventRatings)
      .innerJoin(events, eq(eventRatings.eventId, events.id))
      .where(eq(events.organizerId, id));

    return {
      ...user,
      eventsCreated: eventsCreatedResult.count,
      eventsAttended: eventsAttendedResult.count,
      friendsCount: friendsResult.count,
      averageRating: ratingResult.avg ? Number(ratingResult.avg) : undefined,
    };
  }

  // Event operations
  async createEvent(event: InsertEvent, organizerId: string, coordinates: { lat: number; lng: number }): Promise<Event> {
    const [newEvent] = await db
      .insert(events)
      .values({
        ...event,
        organizerId,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      })
      .returning();
    return newEvent;
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEventWithDetails(id: string, userId?: string): Promise<EventWithDetails | undefined> {
    const [result] = await db
      .select({
        event: events,
        organizer: users,
      })
      .from(events)
      .innerJoin(users, eq(events.organizerId, users.id))
      .where(eq(events.id, id));

    if (!result) return undefined;

    const [attendanceCountResult] = await db
      .select({ count: count() })
      .from(eventAttendances)
      .where(and(
        eq(eventAttendances.eventId, id),
        eq(eventAttendances.status, 'confirmed')
      ));

    let userAttendance: EventAttendance | undefined;
    if (userId) {
      [userAttendance] = await db
        .select()
        .from(eventAttendances)
        .where(and(
          eq(eventAttendances.eventId, id),
          eq(eventAttendances.userId, userId)
        ));
    }

    // Get friends going to this event
    let friendsGoing: User[] = [];
    if (userId) {
      const friendsGoingResult = await db
        .select({ user: users })
        .from(eventAttendances)
        .innerJoin(users, eq(eventAttendances.userId, users.id))
        .innerJoin(friendships, or(
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, users.id)
          ),
          and(
            eq(friendships.addresseeId, userId),
            eq(friendships.requesterId, users.id)
          )
        ))
        .where(and(
          eq(eventAttendances.eventId, id),
          eq(eventAttendances.status, 'confirmed'),
          eq(friendships.status, 'accepted')
        ));

      friendsGoing = friendsGoingResult.map(r => r.user);
    }

    return {
      ...result.event,
      organizer: result.organizer,
      attendanceCount: attendanceCountResult.count,
      userAttendance,
      friendsGoing,
    };
  }

  async getEvents(filters?: {
    category?: string;
    userLat?: number;
    userLng?: number;
    userId?: string;
  }): Promise<EventWithDetails[]> {
    let query = db
      .select({
        event: events,
        organizer: users,
      })
      .from(events)
      .innerJoin(users, eq(events.organizerId, users.id))
      .where(sql`${events.startDate} >= NOW()`);

    if (filters?.category) {
      query = query.where(eq(events.category, filters.category));
    }

    const results = await query.orderBy(desc(events.createdAt));

    // Enhance with attendance counts and user data
    const enhancedEvents = await Promise.all(
      results.map(async (result) => {
        const [attendanceCountResult] = await db
          .select({ count: count() })
          .from(eventAttendances)
          .where(and(
            eq(eventAttendances.eventId, result.event.id),
            eq(eventAttendances.status, 'confirmed')
          ));

        let userAttendance: EventAttendance | undefined;
        if (filters?.userId) {
          [userAttendance] = await db
            .select()
            .from(eventAttendances)
            .where(and(
              eq(eventAttendances.eventId, result.event.id),
              eq(eventAttendances.userId, filters.userId)
            ));
        }

        // Calculate distance if user coordinates provided
        let distance: number | undefined;
        if (filters?.userLat && filters?.userLng) {
          // Haversine formula for distance calculation
          const R = 6371; // Earth's radius in km
          const dLat = (result.event.latitude - filters.userLat) * Math.PI / 180;
          const dLng = (result.event.longitude - filters.userLng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(filters.userLat * Math.PI / 180) * Math.cos(result.event.latitude * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance = R * c;
        }

        return {
          ...result.event,
          organizer: result.organizer,
          attendanceCount: attendanceCountResult.count,
          userAttendance,
          distance,
        };
      })
    );

    // Filter events by proximity (same city) and sort by distance if coordinates provided
    if (filters?.userLat && filters?.userLng) {
      // Filter events within 50km (same city/region)
      const nearbyEvents = enhancedEvents.filter(event => 
        event.distance === undefined || event.distance <= 50
      );
      
      // Sort by distance
      nearbyEvents.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      return nearbyEvents;
    }

    return enhancedEvents;
  }

  async updateEvent(id: string, event: Partial<InsertEvent>, coordinates?: { lat: number; lng: number }): Promise<Event | undefined> {
    const updateData: any = { ...event, updatedAt: new Date() };
    if (coordinates) {
      updateData.latitude = coordinates.lat;
      updateData.longitude = coordinates.lng;
    }

    const [updatedEvent] = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }

  async deleteEvent(id: string, organizerId: string): Promise<boolean> {
    const result = await db
      .delete(events)
      .where(and(eq(events.id, id), eq(events.organizerId, organizerId)));
    return result.rowCount > 0;
  }

  // Attendance operations
  async createAttendance(attendance: InsertEventAttendance): Promise<EventAttendance> {
    const [newAttendance] = await db
      .insert(eventAttendances)
      .values(attendance)
      .onConflictDoUpdate({
        target: [eventAttendances.eventId, eventAttendances.userId],
        set: { status: attendance.status },
      })
      .returning();
    return newAttendance;
  }

  async getAttendance(eventId: string, userId: string): Promise<EventAttendance | undefined> {
    const [attendance] = await db
      .select()
      .from(eventAttendances)
      .where(and(
        eq(eventAttendances.eventId, eventId),
        eq(eventAttendances.userId, userId)
      ));
    return attendance;
  }

  async updateAttendance(eventId: string, userId: string, status: string): Promise<EventAttendance | undefined> {
    const [attendance] = await db
      .update(eventAttendances)
      .set({ status })
      .where(and(
        eq(eventAttendances.eventId, eventId),
        eq(eventAttendances.userId, userId)
      ))
      .returning();
    return attendance;
  }

  async getEventAttendees(eventId: string): Promise<User[]> {
    const results = await db
      .select({ user: users })
      .from(eventAttendances)
      .innerJoin(users, eq(eventAttendances.userId, users.id))
      .where(and(
        eq(eventAttendances.eventId, eventId),
        eq(eventAttendances.status, 'confirmed')
      ));
    
    return results.map(r => r.user);
  }

  // Friendship operations
  async sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    const [friendship] = await db
      .insert(friendships)
      .values({
        requesterId,
        addresseeId,
        status: 'pending',
      })
      .returning();
    return friendship;
  }

  async respondToFriendRequest(requestId: string, status: string): Promise<Friendship | undefined> {
    const [friendship] = await db
      .update(friendships)
      .set({ status, updatedAt: new Date() })
      .where(eq(friendships.id, requestId))
      .returning();
    return friendship;
  }

  async getFriends(userId: string): Promise<User[]> {
    const results = await db
      .select({
        friend: users,
      })
      .from(friendships)
      .innerJoin(users, or(
        and(eq(friendships.requesterId, userId), eq(users.id, friendships.addresseeId)),
        and(eq(friendships.addresseeId, userId), eq(users.id, friendships.requesterId))
      ))
      .where(and(
        or(
          eq(friendships.requesterId, userId),
          eq(friendships.addresseeId, userId)
        ),
        eq(friendships.status, 'accepted')
      ));

    return results.map(r => r.friend);
  }

  async getFriendRequests(userId: string): Promise<(Friendship & { requester: User })[]> {
    const results = await db
      .select({
        friendship: friendships,
        requester: users,
      })
      .from(friendships)
      .innerJoin(users, eq(friendships.requesterId, users.id))
      .where(and(
        eq(friendships.addresseeId, userId),
        eq(friendships.status, 'pending')
      ));

    return results.map(r => ({ ...r.friendship, requester: r.requester }));
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(friendships)
      .where(and(
        or(
          and(eq(friendships.requesterId, userId1), eq(friendships.addresseeId, userId2)),
          and(eq(friendships.requesterId, userId2), eq(friendships.addresseeId, userId1))
        ),
        eq(friendships.status, 'accepted')
      ));

    return !!result;
  }

  // Rating operations
  async createRating(rating: InsertEventRating): Promise<EventRating> {
    const [newRating] = await db
      .insert(eventRatings)
      .values(rating)
      .returning();
    return newRating;
  }

  async getEventRatings(eventId: string): Promise<EventRating[]> {
    return await db
      .select()
      .from(eventRatings)
      .where(eq(eventRatings.eventId, eventId));
  }

  async getUserRatings(userId: string): Promise<EventRating[]> {
    return await db
      .select()
      .from(eventRatings)
      .where(eq(eventRatings.userId, userId));
  }
}

export const storage = new DatabaseStorage();
