import {
  users,
  events,
  eventAttendees,
  eventInvites,
  friendships,
  eventRatings,
  eventContributions,
  categories,
  notifications,
  type User,
  type UpsertUser,
  type Event,
  type InsertEvent,
  type EventAttendance,
  type InsertEventAttendance,
  type EventInvite,
  type InsertEventInvite,
  type Friendship,
  type InsertFriendship,
  type EventRating,
  type InsertEventRating,
  type EventContribution,
  type InsertEventContribution,
  type EventWithDetails,
  type UserWithStats,
  type OrganizerSanitized,
  type UserSanitized,
  type Category,
  type InsertCategory,
  type Notification,
  type InsertNotification,
  type NotificationWithDetails,
  type NotificationConfig,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, count, avg, sql, like, isNull, isNotNull, gte, lte } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserWithStats(id: string): Promise<UserWithStats | undefined>;
  // Additional user operations for local authentication from javascript_auth_all_persistance blueprint
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createLocalUser(user: { username: string; password: string; email: string; firstName: string; lastName: string }): Promise<User>;
  
  // Phone authentication operations
  getUserByPhone(phoneE164: string): Promise<User | undefined>;
  createUser(userData: Partial<UpsertUser>): Promise<User>;
  updateUserPhone(userId: string, phoneData: { phoneE164: string; phoneVerified: boolean; phoneCountry?: string; phoneHmac: string }): Promise<void>;
  getUsersByPhoneHmacs(phoneHmacs: string[], excludeUserId?: string): Promise<User[]>;
  
  // Admin functions
  getAdminUsers(): Promise<User[]>;
  createAdminUser(userData: { username: string; password: string; email: string; firstName: string; lastName: string; role: string; authType: string }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Profile management
  updateUserProfileImage(userId: string, profileImageUrl: string | null): Promise<User | undefined>;
  updateUserProfile(userId: string, profileData: { firstName?: string; lastName?: string }): Promise<User | undefined>;
  changeUserPassword(userId: string, newPassword: string): Promise<User | undefined>;

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
  getUserEvents(userId: string): Promise<EventWithDetails[]>;
  updateEvent(id: string, event: Partial<InsertEvent>, coordinates?: { lat: number; lng: number }): Promise<Event | undefined>;
  deleteEvent(id: string, organizerId: string): Promise<boolean>;
  checkDuplicateEvent(title: string, location: string, dateTime: string): Promise<Event | undefined>;

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
  hasPendingFriendRequest(userId1: string, userId2: string): Promise<boolean>;

  // Rating operations
  createRating(rating: InsertEventRating): Promise<EventRating>;
  getEventRatings(eventId: string): Promise<EventRating[]>;
  getUserRatings(userId: string): Promise<EventRating[]>;
  getUserEventRating(eventId: string, userId: string): Promise<EventRating | undefined>;
  canUserRateEvent(eventId: string, userId: string): Promise<{ canRate: boolean; reason?: string }>;
  getEventRatingsAverage(eventId: string): Promise<{ eventAverage: number; organizerAverage: number; totalRatings: number }>;
  getOrganizerRatingsAverage(organizerId: string): Promise<{ average: number; totalRatings: number }>;

  // Search operations
  searchUsers(query: string): Promise<UserSanitized[]>;
  searchEvents(query: string, userId?: string): Promise<EventWithDetails[]>;
  searchEndedEvents(cityName?: string, daysBack?: number, searchQuery?: string, userId?: string): Promise<EventWithDetails[]>;

  // Profile operations
  getUserProfileByUsername(username: string, viewerId?: string): Promise<{
    profile: UserSanitized;
    isConnected: boolean;
    canViewFullProfile: boolean;
    phoneNumber?: string | null;
    confirmedEvents?: EventWithDetails[];
  } | undefined>;

  // Category operations
  getCategories(): Promise<Category[]>;
  getCategoryByValue(value: string): Promise<Category | undefined>;
  getSubcategories(parentId: string): Promise<Category[]>;
  getCategoryWithSubcategories(categoryValue: string): Promise<string[]>;

  // Notification operations
  getNotifications(userId: string, limit?: number): Promise<NotificationWithDetails[]>;
  getUnreadNotificationsCount(userId: string): Promise<number>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  
  // Notification preferences operations
  getNotificationPreferences(userId: string): Promise<Partial<User>>;
  updateNotificationPreference(userId: string, key: keyof User, value: boolean): Promise<boolean>;

  // Contribution operations
  createContribution(contribution: InsertEventContribution): Promise<EventContribution>;
  getEventContributions(eventId: string): Promise<EventContribution[]>;
  getUserContributions(userId: string): Promise<EventContribution[]>;
  getUserEventContribution(eventId: string, userId: string): Promise<EventContribution | undefined>;
  getEventTotalRaised(eventId: string): Promise<{ totalRaised: number; contributionCount: number }>;
  removeUserContributions(eventId: string, userId: string): Promise<void>;
  
  // Private event operations
  inviteFriendsToEvent(eventId: string, friendIds: string[]): Promise<void>;
  getEventInvites(eventId: string): Promise<EventInvite[]>;
  getUserEventInvites(userId: string): Promise<EventInvite[]>;
  getEventByShareableLink(shareableLink: string): Promise<Event | undefined>;
  isUserInvitedToEvent(eventId: string, userId: string): Promise<boolean>;
  canUserAccessPrivateEvent(eventId: string, userId: string): Promise<boolean>;
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
      .where(eq(events.creatorId, id));

    const [eventsAttendedResult] = await db
      .select({ count: count() })
      .from(eventAttendees)
      .where(and(
        eq(eventAttendees.userId, id),
        eq(eventAttendees.status, 'attending')
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
      .where(eq(events.creatorId, id));

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
        title: event.title,
        description: event.description,
        category: event.category,
        dateTime: new Date(event.dateTime),
        location: event.location,
        creatorId: organizerId,
        latitude: coordinates.lat.toString(),
        longitude: coordinates.lng.toString(),
        maxAttendees: event.maxAttendees,
        imageUrl: event.imageUrl,
        iconEmoji: event.iconEmoji,
        coverImageUrl: event.coverImageUrl,
        isRecurring: event.isRecurring,
        recurrenceType: event.recurrenceType,
        recurrenceInterval: event.recurrenceInterval,
        recurrenceEndDate: event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : undefined,
        // Private event fields
        isPrivate: event.isPrivate ?? false,
        priceType: event.priceType ?? 'free',
        price: event.price,
        fundraisingGoal: event.fundraisingGoal,
        minimumContribution: event.minimumContribution,
        // shareableLink will be auto-generated by database default
      })
      .returning();
    return newEvent;
  }

  // Internal method to get event without access checks (used by canUserAccessPrivateEvent)
  private async getEventInternal(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEvent(id: string, userId?: string): Promise<Event | undefined> {
    const event = await this.getEventInternal(id);
    if (!event) return undefined;
    
    // Check access for private events
    if (event.isPrivate && userId) {
      const canAccess = await this.canUserAccessPrivateEvent(id, userId);
      if (!canAccess) return undefined;
    } else if (event.isPrivate && !userId) {
      // Private events require authentication
      return undefined;
    }
    
    return event;
  }

  async getEventWithDetails(id: string, userId?: string): Promise<EventWithDetails | undefined> {
    const [result] = await db
      .select({
        event: events,
        organizer: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          authType: users.authType,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(events)
      .innerJoin(users, eq(events.creatorId, users.id))
      .where(eq(events.id, id));

    if (!result) return undefined;

    // Check access for private events
    if (result.event.isPrivate && userId) {
      const canAccess = await this.canUserAccessPrivateEvent(id, userId);
      if (!canAccess) return undefined;
    } else if (result.event.isPrivate && !userId) {
      // Private events require authentication
      return undefined;
    }

    const [attendanceCountResult] = await db
      .select({ count: count() })
      .from(eventAttendees)
      .where(and(
        eq(eventAttendees.eventId, id),
        eq(eventAttendees.status, 'attending')
      ));

    let userAttendance: EventAttendance | undefined;
    if (userId) {
      [userAttendance] = await db
        .select()
        .from(eventAttendees)
        .where(and(
          eq(eventAttendees.eventId, id),
          eq(eventAttendees.userId, userId)
        ));
    }

    // Get friends going to this event
    let friendsGoing: UserSanitized[] = [];
    if (userId) {
      const friendsGoingResult = await db
        .select({
          user: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            username: users.username,
            authType: users.authType,
            role: users.role,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          }
        })
        .from(eventAttendees)
        .innerJoin(users, eq(eventAttendees.userId, users.id))
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
          eq(eventAttendees.eventId, id),
          eq(eventAttendees.status, 'attending'),
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
    userCity?: string;
    userId?: string;
  }): Promise<EventWithDetails[]> {
    try {
      console.log('DEBUG getEvents called with filters:', JSON.stringify(filters));
      // Filter out events that have already ended
      // Use dateTime to check if event is still upcoming (assuming events last a few hours)
      const conditions = [gte(events.dateTime, new Date())];
      console.log('DEBUG: Initial conditions set with event end time filtering');
      
      // Filter out private events unless user has access
      if (filters?.userId) {
        // Include public events OR private events where user is creator, invited, or attending        
        const accessCondition = or(
          eq(events.isPrivate, false),
          and(
            eq(events.isPrivate, true),
            or(
              eq(events.creatorId, filters.userId),
              sql`EXISTS (
                SELECT 1 FROM ${eventInvites} 
                WHERE ${eventInvites.eventId} = ${events.id} 
                AND ${eventInvites.userId} = ${filters.userId}
              )`,
              sql`EXISTS (
                SELECT 1 FROM ${eventAttendees} 
                WHERE ${eventAttendees.eventId} = ${events.id} 
                AND ${eventAttendees.userId} = ${filters.userId}
              )`
            )
          )
        );
        
        if (accessCondition) {
          conditions.push(accessCondition);
        }
      } else {
        // No user provided, only show public events
        conditions.push(eq(events.isPrivate, false));
      }
      
      if (filters?.category) {
        // Get category and all its subcategories for hierarchical filtering
        const categoryValues = await this.getCategoryWithSubcategories(filters.category);
        if (categoryValues.length > 0) {
          // Filter by any of the category values (main category + subcategories)
          const categoryConditions = categoryValues.map(value => eq(events.category, value));
          if (categoryConditions.length === 1) {
            conditions.push(categoryConditions[0]);
          } else if (categoryConditions.length > 1) {
            const categoryOr = or(...categoryConditions);
            if (categoryOr) {
              conditions.push(categoryOr);
            }
          }
        }
      }

      const query = db
        .select({
          event: events,
          organizer: {
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            authType: users.authType,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          },
        })
        .from(events)
        .innerJoin(users, sql`${events.creatorId}::varchar = ${users.id}`)
        .where(and(...conditions));

      const results = await query.orderBy(desc(events.createdAt));
      console.log('DEBUG: Query executed, results count:', results?.length || 0);
      
      if (!results || !Array.isArray(results)) {
        console.log('No results or invalid results from query');
        return [];
      }

      // Enhance with attendance counts and user data
      const enhancedEvents = await Promise.all(
        results.map(async (result) => {
          const [attendanceCountResult] = await db
            .select({ count: count() })
            .from(eventAttendees)
            .where(and(
              eq(eventAttendees.eventId, result.event.id),
              eq(eventAttendees.status, 'attending')
            ));

          let userAttendance: EventAttendance | undefined;
          if (filters?.userId) {
            [userAttendance] = await db
              .select()
              .from(eventAttendees)
              .where(and(
                eq(eventAttendees.eventId, result.event.id),
                eq(eventAttendees.userId, filters.userId)
              ));
          }

          // Calculate distance if user coordinates provided
          let distance: number | undefined;
          if (filters?.userLat && filters?.userLng && result.event.latitude && result.event.longitude) {
            // Haversine formula for distance calculation
            const R = 6371; // Earth's radius in km
            const eventLat = parseFloat(result.event.latitude);
            const eventLng = parseFloat(result.event.longitude);
            const dLat = (eventLat - filters.userLat) * Math.PI / 180;
            const dLng = (eventLng - filters.userLng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(filters.userLat * Math.PI / 180) * Math.cos(eventLat * Math.PI / 180) *
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

      // Prioritize distance-based filtering if coordinates are available
      if (filters?.userLat && filters?.userLng) {
        // Filter events within 50km (same city/region)
        const nearbyEvents = enhancedEvents.filter(event => 
          event.distance === undefined || event.distance <= 50
        );
        
        // Sort by distance, then by creation date
        nearbyEvents.sort((a, b) => {
          const distanceA = a.distance || 0;
          const distanceB = b.distance || 0;
          if (distanceA !== distanceB) {
            return distanceA - distanceB;
          }
          // If distances are equal, sort by creation date (most recent first)
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bDate - aDate;
        });
        
        return nearbyEvents;
      }

      // Fallback to text-based city filtering if coordinates not available
      if (filters?.userCity) {
        // For now, when filtering by city but no coordinates, return all events
        // This is a temporary fix to ensure events appear while we improve geocoding
        // In the future, we should enhance the geocoding process to always include city info
        console.log(`City filter applied for: ${filters.userCity}, but returning all events to avoid filtering issues`);
        
        // Sort by creation date (most recent first)
        enhancedEvents.sort((a, b) => {
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bDate - aDate;
        });
        
        return enhancedEvents;
      }

      // If no filters are provided, return all events sorted by creation date
      console.log('No filters provided, returning all events');
      enhancedEvents.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });

      return enhancedEvents;
    } catch (error) {
      console.error('Error in getEvents:', error);
      return [];
    }
  }

  async getUserEvents(userId: string): Promise<EventWithDetails[]> {
    try {
      const query = db
        .select({
          event: events,
          organizer: {
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            authType: users.authType,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          },
        })
        .from(events)
        .innerJoin(users, sql`${events.creatorId}::varchar = ${users.id}`)
        .where(eq(events.creatorId, userId));

      const results = await query.orderBy(desc(events.createdAt));
      
      if (!results || !Array.isArray(results)) {
        return [];
      }

      // Enhance with attendance counts
      const enhancedEvents = await Promise.all(
        results.map(async (result) => {
          const [attendanceCountResult] = await db
            .select({ count: count() })
            .from(eventAttendees)
            .where(and(
              eq(eventAttendees.eventId, result.event.id),
              eq(eventAttendees.status, 'attending')
            ));

          return {
            ...result.event,
            organizer: result.organizer,
            attendanceCount: attendanceCountResult.count,
            userAttendance: undefined,
            friendsGoing: [],
          };
        })
      );

      return enhancedEvents;
    } catch (error) {
      console.error('Error in getUserEvents:', error);
      return [];
    }
  }

  async updateEvent(id: string, event: Partial<InsertEvent>, coordinates?: { lat: number; lng: number }): Promise<Event | undefined> {
    const updateData: any = { 
      ...event, 
      updatedAt: new Date(),
      ...(event.dateTime && { dateTime: new Date(event.dateTime) }),
      ...(event.recurrenceEndDate && { recurrenceEndDate: new Date(event.recurrenceEndDate) }),
    };
    if (coordinates) {
      updateData.latitude = coordinates.lat.toString();
      updateData.longitude = coordinates.lng.toString();
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
      .where(and(eq(events.id, id), eq(events.creatorId, organizerId)));
    return (result.rowCount || 0) > 0;
  }

  async checkDuplicateEvent(title: string, location: string, dateTime: string): Promise<Event | undefined> {
    const [duplicateEvent] = await db
      .select()
      .from(events)
      .where(and(
        eq(events.title, title),
        eq(events.location, location),
        eq(events.dateTime, new Date(dateTime))
      ));
    return duplicateEvent;
  }

  // Attendance operations
  async createAttendance(attendance: InsertEventAttendance): Promise<EventAttendance> {
    const [newAttendance] = await db
      .insert(eventAttendees)
      .values(attendance)
      .onConflictDoUpdate({
        target: [eventAttendees.eventId, eventAttendees.userId],
        set: { status: attendance.status },
      })
      .returning();
    return newAttendance;
  }

  async getAttendance(eventId: string, userId: string): Promise<EventAttendance | undefined> {
    const [attendance] = await db
      .select()
      .from(eventAttendees)
      .where(and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.userId, userId)
      ));
    return attendance;
  }

  async updateAttendance(eventId: string, userId: string, status: string): Promise<EventAttendance | undefined> {
    const [attendance] = await db
      .update(eventAttendees)
      .set({ status })
      .where(and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.userId, userId)
      ))
      .returning();
    return attendance;
  }

  async getEventAttendees(eventId: string): Promise<User[]> {
    const results = await db
      .select({ user: users })
      .from(eventAttendees)
      .innerJoin(users, eq(eventAttendees.userId, users.id))
      .where(and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.status, 'attending')
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

  async getUserEventRating(eventId: string, userId: string): Promise<EventRating | undefined> {
    const [rating] = await db
      .select()
      .from(eventRatings)
      .where(and(
        eq(eventRatings.eventId, eventId),
        eq(eventRatings.userId, userId)
      ));
    return rating;
  }

  async canUserRateEvent(eventId: string, userId: string): Promise<{ canRate: boolean; reason?: string }> {
    // Check if event exists and has ended
    const event = await this.getEvent(eventId);
    if (!event) {
      return { canRate: false, reason: "Evento não encontrado" };
    }

    const now = new Date();
    if (event.dateTime > now) {
      return { canRate: false, reason: "Só é possível avaliar após o término do evento" };
    }

    // Check if user attended the event
    const attendance = await this.getAttendance(eventId, userId);
    if (!attendance || attendance.status !== 'attending') {
      return { canRate: false, reason: "Apenas usuários que confirmaram presença podem avaliar" };
    }

    // Check if user already rated this event
    const existingRating = await this.getUserEventRating(eventId, userId);
    if (existingRating) {
      return { canRate: false, reason: "Você já avaliou este evento" };
    }

    return { canRate: true };
  }

  async getEventRatingsAverage(eventId: string): Promise<{ eventAverage: number; organizerAverage: number; totalRatings: number }> {
    const [result] = await db
      .select({
        eventAverage: avg(eventRatings.eventRating),
        organizerAverage: avg(eventRatings.organizerRating),
        totalRatings: count(),
      })
      .from(eventRatings)
      .where(eq(eventRatings.eventId, eventId));

    return {
      eventAverage: result.eventAverage ? Number(result.eventAverage) : 0,
      organizerAverage: result.organizerAverage ? Number(result.organizerAverage) : 0,
      totalRatings: result.totalRatings,
    };
  }

  async getOrganizerRatingsAverage(organizerId: string): Promise<{ average: number; totalRatings: number }> {
    const [result] = await db
      .select({
        average: avg(eventRatings.organizerRating),
        totalRatings: count(),
      })
      .from(eventRatings)
      .innerJoin(events, eq(eventRatings.eventId, events.id))
      .where(eq(events.creatorId, organizerId));

    return {
      average: result.average ? Number(result.average) : 0,
      totalRatings: result.totalRatings,
    };
  }

  // Additional user operations for local authentication from javascript_auth_all_persistance blueprint
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createLocalUser(userData: { username: string; password: string; email: string; firstName: string; lastName: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        authType: 'local',
      })
      .returning();
    return user;
  }

  // Phone authentication operations
  async getUserByPhone(phoneE164: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneE164, phoneE164));
    return user;
  }

  async createUser(userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUserPhone(userId: string, phoneData: { phoneE164: string; phoneVerified: boolean; phoneCountry?: string; phoneHmac: string }): Promise<void> {
    await db
      .update(users)
      .set({
        phoneE164: phoneData.phoneE164,
        phoneVerified: phoneData.phoneVerified,
        phoneCountry: phoneData.phoneCountry,
        phoneHmac: phoneData.phoneHmac,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getUsersByPhoneHmacs(phoneHmacs: string[], excludeUserId?: string): Promise<User[]> {
    let whereConditions = sql`${users.phoneHmac} = ANY(${phoneHmacs})`;
    
    if (excludeUserId) {
      whereConditions = sql`${whereConditions} AND ${users.id} != ${excludeUserId}`;
    }

    return await db
      .select()
      .from(users)
      .where(whereConditions);
  }

  async hasPendingFriendRequest(userId1: string, userId2: string): Promise<boolean> {
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(
        and(
          or(
            and(eq(friendships.requesterId, userId1), eq(friendships.addresseeId, userId2)),
            and(eq(friendships.requesterId, userId2), eq(friendships.addresseeId, userId1))
          ),
          eq(friendships.status, 'pending')
        )
      );
    return !!friendship;
  }

  async getAdminUsers(): Promise<User[]> {
    const adminUsers = await db
      .select()
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.role, 'super_admin')));
    return adminUsers;
  }

  async createAdminUser(userData: { username: string; password: string; email: string; firstName: string; lastName: string; role: string; authType: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserProfileImage(userId: string, profileImageUrl: string | null): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        profileImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserProfile(userId: string, profileData: { firstName?: string; lastName?: string }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...profileData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async changeUserPassword(userId: string, newPassword: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        password: newPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Search operations
  async searchUsers(query: string): Promise<UserSanitized[]> {
    const searchTerm = `%${query}%`;
    const results = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        username: users.username,
        authType: users.authType,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(or(
        like(users.firstName, searchTerm),
        like(users.lastName, searchTerm),
        like(users.username, searchTerm)
      ));
    
    return results;
  }

  async searchEvents(query: string, userId?: string): Promise<EventWithDetails[]> {
    const searchTerm = `%${query}%`;
    const conditions = [
      or(
        like(events.title, searchTerm),
        like(events.description, searchTerm),
        like(events.location, searchTerm)
      ),
      sql`DATE(${events.dateTime}) >= DATE(NOW())`
    ];

    // Filter out private events unless user has access
    if (userId) {
      // Include public events OR private events where user is creator, invited, or attending
      conditions.push(
        or(
          eq(events.isPrivate, false),
          and(
            eq(events.isPrivate, true),
            or(
              eq(events.creatorId, userId),
              sql`EXISTS (
                SELECT 1 FROM ${eventInvites} 
                WHERE ${eventInvites.eventId} = ${events.id} 
                AND ${eventInvites.userId} = ${userId}
              )`,
              sql`EXISTS (
                SELECT 1 FROM ${eventAttendees} 
                WHERE ${eventAttendees.eventId} = ${events.id} 
                AND ${eventAttendees.userId} = ${userId}
              )`
            )
          )
        )
      );
    } else {
      // No user provided, only show public events
      conditions.push(eq(events.isPrivate, false));
    }

    const results = await db
      .select({
        event: events,
        organizer: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          authType: users.authType,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(events)
      .innerJoin(users, eq(events.creatorId, users.id))
      .where(and(...conditions));

    // Enhance with attendance counts
    const enhancedEvents = await Promise.all(
      results.map(async (result) => {
        const [attendanceCountResult] = await db
          .select({ count: count() })
          .from(eventAttendees)
          .where(and(
            eq(eventAttendees.eventId, result.event.id),
            eq(eventAttendees.status, 'attending')
          ));

        return {
          ...result.event,
          organizer: result.organizer,
          attendanceCount: attendanceCountResult.count,
          userAttendance: undefined,
          friendsGoing: [],
        };
      })
    );

    return enhancedEvents;
  }

  async searchEndedEvents(
    cityName?: string,
    daysBack?: number,
    searchQuery?: string,
    userId?: string
  ): Promise<EventWithDetails[]> {
    const conditions = [];

    // Add condition for ended events (events that have already occurred)
    conditions.push(lte(events.dateTime, new Date()));

    // Add date range filter if daysBack is specified
    if (daysBack && daysBack > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      conditions.push(gte(events.dateTime, cutoffDate));
    }

    // Add city filter if specified
    if (cityName && cityName.trim() !== '') {
      const citySearchTerm = `%${cityName.trim()}%`;
      conditions.push(like(events.location, citySearchTerm));
    }

    // Add search query filter if specified
    if (searchQuery && searchQuery.trim() !== '' && searchQuery.length >= 2) {
      const searchTerm = `%${searchQuery.trim()}%`;
      conditions.push(
        or(
          like(events.title, searchTerm),
          like(events.description, searchTerm),
          like(events.location, searchTerm)
        )
      );
    }

    // Filter out private events unless user has access
    if (userId) {
      // Include public events OR private events where user is creator, invited, or attending
      conditions.push(
        or(
          eq(events.isPrivate, false),
          and(
            eq(events.isPrivate, true),
            or(
              eq(events.creatorId, userId),
              sql`EXISTS (
                SELECT 1 FROM ${eventInvites} 
                WHERE ${eventInvites.eventId} = ${events.id} 
                AND ${eventInvites.userId} = ${userId}
              )`,
              sql`EXISTS (
                SELECT 1 FROM ${eventAttendees} 
                WHERE ${eventAttendees.eventId} = ${events.id} 
                AND ${eventAttendees.userId} = ${userId}
              )`
            )
          )
        )
      );
    } else {
      // No user provided, only show public events
      conditions.push(eq(events.isPrivate, false));
    }

    const results = await db
      .select({
        event: events,
        organizer: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          authType: users.authType,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(events)
      .innerJoin(users, eq(events.creatorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(events.dateTime));

    // Enhance with attendance counts
    const enhancedEvents = await Promise.all(
      results.map(async (result) => {
        const [attendanceCountResult] = await db
          .select({ count: count() })
          .from(eventAttendees)
          .where(and(
            eq(eventAttendees.eventId, result.event.id),
            eq(eventAttendees.status, 'attending')
          ));

        return {
          ...result.event,
          organizer: result.organizer,
          attendanceCount: attendanceCountResult.count,
          userAttendance: undefined,
          friendsGoing: [],
        };
      })
    );

    return enhancedEvents;
  }

  async getUserProfileByUsername(username: string, viewerId?: string): Promise<{
    profile: UserSanitized;
    isConnected: boolean;
    canViewFullProfile: boolean;
    phoneNumber?: string | null;
    confirmedEvents?: EventWithDetails[];
  } | undefined> {
    // Get user by username
    const user = await this.getUserByUsername(username);
    if (!user) return undefined;

    // Create sanitized profile
    const profile: UserSanitized = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      username: user.username,
      authType: user.authType,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // If no viewer, return public profile only
    if (!viewerId) {
      return {
        profile,
        isConnected: false,
        canViewFullProfile: false,
      };
    }

    // If viewing own profile, show full profile
    if (viewerId === user.id) {
      const confirmedEvents = await db
        .select({
          event: events,
          organizer: {
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            authType: users.authType,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          },
        })
        .from(eventAttendees)
        .innerJoin(events, eq(eventAttendees.eventId, events.id))
        .innerJoin(users, sql`${events.creatorId}::varchar = ${users.id}`)
        .where(and(
          eq(eventAttendees.userId, user.id),
          eq(eventAttendees.status, 'attending'),
          // Only show public events OR private events where user has access
          or(
            eq(events.isPrivate, false),
            and(
              eq(events.isPrivate, true),
              or(
                eq(events.creatorId, viewerId),
                sql`EXISTS (
                  SELECT 1 FROM ${eventInvites} 
                  WHERE ${eventInvites.eventId} = ${events.id} 
                  AND ${eventInvites.userId} = ${viewerId}
                )`
              )
            )
          )
        ));

      const enhancedEvents = await Promise.all(
        confirmedEvents.map(async (result) => {
          const [attendanceCountResult] = await db
            .select({ count: count() })
            .from(eventAttendees)
            .where(and(
              eq(eventAttendees.eventId, result.event.id),
              eq(eventAttendees.status, 'attending')
            ));

          return {
            ...result.event,
            organizer: result.organizer,
            attendanceCount: attendanceCountResult.count,
            userAttendance: undefined,
            friendsGoing: [],
          };
        })
      );

      return {
        profile,
        isConnected: true,
        canViewFullProfile: true,
        phoneNumber: user.phoneE164,
        confirmedEvents: enhancedEvents,
      };
    }

    // Check friendship status
    const areConnected = await this.areFriends(viewerId, user.id);

    if (areConnected) {
      // Return full profile for connected friends
      const confirmedEvents = await db
        .select({
          event: events,
          organizer: {
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            authType: users.authType,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          },
        })
        .from(eventAttendees)
        .innerJoin(events, eq(eventAttendees.eventId, events.id))
        .innerJoin(users, sql`${events.creatorId}::varchar = ${users.id}`)
        .where(and(
          eq(eventAttendees.userId, user.id),
          eq(eventAttendees.status, 'attending'),
          // Only show public events OR private events where viewer has access
          or(
            eq(events.isPrivate, false),
            and(
              eq(events.isPrivate, true),
              or(
                eq(events.creatorId, viewerId),
                sql`EXISTS (
                  SELECT 1 FROM ${eventInvites} 
                  WHERE ${eventInvites.eventId} = ${events.id} 
                  AND ${eventInvites.userId} = ${viewerId}
                )`,
                sql`EXISTS (
                  SELECT 1 FROM ${eventAttendees} 
                  WHERE ${eventAttendees.eventId} = ${events.id} 
                  AND ${eventAttendees.userId} = ${viewerId}
                )`
              )
            )
          )
        ));

      const enhancedEvents = await Promise.all(
        confirmedEvents.map(async (result) => {
          const [attendanceCountResult] = await db
            .select({ count: count() })
            .from(eventAttendees)
            .where(and(
              eq(eventAttendees.eventId, result.event.id),
              eq(eventAttendees.status, 'attending')
            ));

          return {
            ...result.event,
            organizer: result.organizer,
            attendanceCount: attendanceCountResult.count,
            userAttendance: undefined,
            friendsGoing: [],
          };
        })
      );

      return {
        profile,
        isConnected: true,
        canViewFullProfile: true,
        phoneNumber: user.phoneE164,
        confirmedEvents: enhancedEvents,
      };
    }

    // Return public profile only for non-connected users
    return {
      profile,
      isConnected: false,
      canViewFullProfile: false,
    };
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    try {
      const result = await db.select().from(categories).orderBy(asc(categories.displayOrder));
      return result;
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  async getCategoryByValue(value: string): Promise<Category | undefined> {
    try {
      const [category] = await db.select().from(categories).where(eq(categories.value, value));
      return category;
    } catch (error) {
      console.error('Error getting category by value:', error);
      return undefined;
    }
  }

  async getSubcategories(parentId: string): Promise<Category[]> {
    try {
      const result = await db.select().from(categories)
        .where(eq(categories.parentId, parentId))
        .orderBy(asc(categories.displayOrder));
      return result;
    } catch (error) {
      console.error('Error getting subcategories:', error);
      return [];
    }
  }

  async getCategoryWithSubcategories(categoryValue: string): Promise<string[]> {
    try {
      // Se categoryValue estiver vazio, retorna todos
      if (!categoryValue || categoryValue === '') {
        return [];
      }

      // Busca a categoria principal
      const category = await this.getCategoryByValue(categoryValue);
      if (!category) {
        return [categoryValue]; // Retorna o valor original se não encontrar
      }

      // Se é uma categoria principal (sem parent), busca todas as subcategorias
      if (!category.parentId) {
        const subcategories = await this.getSubcategories(category.id);
        const subcategoryValues = subcategories.map(sub => sub.value);
        return [categoryValue, ...subcategoryValues];
      }

      // Se é uma subcategoria, retorna apenas ela
      return [categoryValue];
    } catch (error) {
      console.error('Error getting category with subcategories:', error);
      return [categoryValue];
    }
  }

  // Notification operations
  async getNotifications(userId: string, limit: number = 20): Promise<NotificationWithDetails[]> {
    try {
      const result = await db
        .select({
          notification: notifications,
          relatedUser: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            username: users.username,
            authType: users.authType,
            role: users.role,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          },
          relatedEvent: {
            id: events.id,
            title: events.title,
            imageUrl: events.imageUrl,
          }
        })
        .from(notifications)
        .leftJoin(users, eq(notifications.relatedUserId, users.id))
        .leftJoin(events, eq(notifications.relatedEventId, events.id))
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      return result.map(row => ({
        ...row.notification,
        relatedUser: row.relatedUser?.id ? row.relatedUser : undefined,
        relatedEvent: row.relatedEvent?.id ? row.relatedEvent : undefined,
      }));
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  async getUnreadNotificationsCount(userId: string): Promise<number> {
    try {
      const [result] = await db
        .select({ count: count() })
        .from(notifications)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ));
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting unread notifications count:', error);
      return 0;
    }
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const [updated] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ))
        .returning({ id: notifications.id });
      return !!updated;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ));
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    try {
      const [created] = await db
        .insert(notifications)
        .values(notification)
        .returning();
      return created;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Notification preferences operations
  async getNotificationPreferences(userId: string): Promise<Partial<User>> {
    try {
      const [user] = await db
        .select({
          notificarConviteAmigo: users.notificarConviteAmigo,
          notificarEventoAmigo: users.notificarEventoAmigo,
          notificarAvaliacaoAmigo: users.notificarAvaliacaoAmigo,
          notificarContatoCadastrado: users.notificarContatoCadastrado,
          notificarConfirmacaoPresenca: users.notificarConfirmacaoPresenca,
          notificarAvaliacaoEventoCriado: users.notificarAvaliacaoEventoCriado,
        })
        .from(users)
        .where(eq(users.id, userId));
      return user || {};
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return {};
    }
  }

  async updateNotificationPreference(userId: string, key: keyof User, value: boolean): Promise<boolean> {
    try {
      const updateData: any = {};
      updateData[key] = value;
      updateData.updatedAt = new Date();
      
      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning({ id: users.id });
      return !!updated;
    } catch (error) {
      console.error('Error updating notification preference:', error);
      return false;
    }
  }
  // Contribution operations
  async createContribution(contribution: InsertEventContribution): Promise<EventContribution> {
    const [newContribution] = await db
      .insert(eventContributions)
      .values(contribution)
      .returning();
    return newContribution;
  }

  async getEventContributions(eventId: string): Promise<EventContribution[]> {
    return await db
      .select()
      .from(eventContributions)
      .where(eq(eventContributions.eventId, eventId));
  }

  async getUserContributions(userId: string): Promise<EventContribution[]> {
    return await db
      .select()
      .from(eventContributions)
      .where(eq(eventContributions.userId, userId));
  }

  async getUserEventContribution(eventId: string, userId: string): Promise<EventContribution | undefined> {
    const [contribution] = await db
      .select()
      .from(eventContributions)
      .where(and(
        eq(eventContributions.eventId, eventId),
        eq(eventContributions.userId, userId)
      ));
    return contribution;
  }

  async getEventTotalRaised(eventId: string): Promise<{ totalRaised: number; contributionCount: number }> {
    const [result] = await db
      .select({
        totalRaised: sql<number>`COALESCE(SUM(CAST(${eventContributions.amount} AS numeric)), 0)`,
        contributionCount: count(),
      })
      .from(eventContributions)
      .where(eq(eventContributions.eventId, eventId));

    return {
      totalRaised: Number(result.totalRaised) || 0,
      contributionCount: result.contributionCount || 0,
    };
  }

  async removeUserContributions(eventId: string, userId: string): Promise<void> {
    await db
      .delete(eventContributions)
      .where(and(
        eq(eventContributions.eventId, eventId),
        eq(eventContributions.userId, userId)
      ));
  }

  // Private event operations
  async inviteFriendsToEvent(eventId: string, friendIds: string[]): Promise<void> {
    const invitations = friendIds.map(friendId => ({
      eventId,
      userId: friendId,
      status: 'pending' as const,
    }));

    await db
      .insert(eventInvites)
      .values(invitations)
      .onConflictDoNothing();
  }

  async getEventInvites(eventId: string): Promise<EventInvite[]> {
    const results = await db
      .select()
      .from(eventInvites)
      .where(eq(eventInvites.eventId, eventId));
    return results;
  }

  async getUserEventInvites(userId: string): Promise<EventInvite[]> {
    const results = await db
      .select()
      .from(eventInvites)
      .where(and(
        eq(eventInvites.userId, userId),
        eq(eventInvites.status, 'pending')
      ));
    return results;
  }

  async getEventByShareableLink(shareableLink: string): Promise<Event | undefined> {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.shareableLink, shareableLink));
    return event;
  }

  async isUserInvitedToEvent(eventId: string, userId: string): Promise<boolean> {
    const [invite] = await db
      .select()
      .from(eventInvites)
      .where(and(
        eq(eventInvites.eventId, eventId),
        eq(eventInvites.userId, userId),
        eq(eventInvites.status, 'pending')
      ));
    return !!invite;
  }

  async canUserAccessPrivateEvent(eventId: string, userId: string): Promise<boolean> {
    // Get the event to check if it's private (use internal method to avoid recursion)
    const event = await this.getEventInternal(eventId);
    if (!event) return false;
    
    // If event is not private, everyone can access
    if (!event.isPrivate) return true;
    
    // CRITICAL: If user is the organizer, they can ALWAYS access their own private events
    if (event.creatorId === userId) return true;
    
    // Check if user is invited
    const isInvited = await this.isUserInvitedToEvent(eventId, userId);
    if (isInvited) return true;
    
    // Check if user is already attending (e.g., via shared link)
    const [attendance] = await db
      .select()
      .from(eventAttendees)
      .where(and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.userId, userId)
      ));
    
    return !!attendance;
  }
}

export const storage = new DatabaseStorage();
