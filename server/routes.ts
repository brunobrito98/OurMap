import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupLocalAuth, isAuthenticatedLocal, isAdmin, isSuperAdmin, hashPassword } from "./auth";
import session from "express-session";
import { insertEventSchema, insertEventAttendanceSchema, insertEventRatingSchema, insertAdminUserSchema, insertLocalUserSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Geocoding function using Mapbox
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) {
    throw new Error('Mapbox access token not configured');
  }

  const encodedAddress = encodeURIComponent(address);
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`
  );

  if (!response.ok) {
    throw new Error('Geocoding failed');
  }

  const data = await response.json();
  if (!data.features || data.features.length === 0) {
    throw new Error('Address not found');
  }

  const [lng, lat] = data.features[0].center;
  return { lat, lng };
}

// Auth middleware
function isAuthenticatedAny(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Get user ID from auth
function getUserId(req: any): string | undefined {
  if (req.user && req.user.id) {
    return req.user.id;
  }
  return undefined;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session and passport
  app.set("trust proxy", 1);
  // Require session secret for security
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.error("SESSION_SECRET environment variable is required for secure sessions");
    process.exit(1);
  }
  
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  }));

  // Setup auth system
  setupLocalAuth(app);

  // Protected admin routes
  app.post('/api/admin/create-admin', isSuperAdmin, async (req, res) => {
    try {
      // Only super_admin can create new admins
      const userSchema = insertLocalUserSchema.extend({
        password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
      });
      
      const validatedData = userSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username já existe" });
      }

      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      // Create admin user (force role = admin)
      const user = await storage.createAdminUser({
        ...validatedData,
        password: await hashPassword(validatedData.password),
        authType: 'local',
        role: 'admin', // Force admin role (not super_admin)
      });

      res.status(201).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        message: "Administrador criado com sucesso"
      });
    } catch (error) {
      console.error("Admin creation error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Protected admin route to list all users (sanitized)
  app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
      // Only admins can list users
      const allUsers = await storage.getAllUsers();
      // Sanitize user data - remove sensitive fields
      const sanitizedUsers = allUsers.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        authType: user.authType,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });
  app.use('/uploads', express.static(uploadsDir));

  // Auth routes (unified for both auth types) - sanitized
  app.get('/api/auth/user', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const user = await storage.getUserWithStats(userId);
      if (user) {
        // Remove sensitive fields before returning
        const { password, ...sanitizedUser } = user;
        res.json(sanitizedUser);
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Fallback route for /api/user (used by some components) - sanitized
  app.get('/api/user', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const user = await storage.getUserWithStats(userId);
      if (user) {
        // Remove sensitive fields before returning
        const { password, ...sanitizedUser } = user;
        res.json(sanitizedUser);
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Event routes
  app.get('/api/events', async (req, res) => {
    try {
      const { category, lat, lng } = req.query;
      const userId = getUserId(req);
      
      const events = await storage.getEvents({
        category: category as string,
        userLat: lat ? parseFloat(lat as string) : undefined,
        userLng: lng ? parseFloat(lng as string) : undefined,
        userId,
      });
      
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get('/api/events/my-events', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const events = await storage.getUserEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching user events:", error);
      res.status(500).json({ message: "Failed to fetch user events" });
    }
  });

  app.get('/api/events/:id', async (req, res) => {
    try {
      const userId = getUserId(req);
      const event = await storage.getEventWithDetails(req.params.id, userId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post('/api/events', isAuthenticatedAny, upload.single('coverImage'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      // Convert FormData string values back to their proper types
      const formData = { ...req.body };
      
      // Convert boolean fields from strings
      if (formData.isFree !== undefined) {
        formData.isFree = formData.isFree === 'true';
      }
      if (formData.allowRsvp !== undefined) {
        formData.allowRsvp = formData.allowRsvp === 'true';
      }
      if (formData.isRecurring !== undefined) {
        formData.isRecurring = formData.isRecurring === 'true';
      }
      
      const eventData = insertEventSchema.parse(formData);
      
      // Use eventData directly - dates are already strings from form validation
      const processedEventData = eventData;
      
      // Geocode the address
      const coordinates = await geocodeAddress(eventData.address);
      
      // Handle cover image if uploaded
      let coverImageUrl = null;
      if (req.file) {
        const fileExtension = path.extname(req.file.originalname);
        const fileName = `${req.file.filename}${fileExtension}`;
        const filePath = path.join(uploadsDir, fileName);
        
        // Rename file to include extension
        fs.renameSync(req.file.path, filePath);
        coverImageUrl = `/uploads/${fileName}`;
      }
      
      const event = await storage.createEvent(
        {
          ...processedEventData,
          coverImageUrl,
        },
        userId,
        coordinates
      );
      
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create event" });
      }
    }
  });

  app.put('/api/events/:id', isAuthenticatedAny, upload.single('coverImage'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const eventId = req.params.id;
      
      // Check if user owns the event
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent || existingEvent.organizerId !== userId) {
        return res.status(403).json({ message: "Not authorized to edit this event" });
      }
      
      // Convert FormData string values back to their proper types
      const formData = { ...req.body };
      
      // Convert boolean fields from strings
      if (formData.isFree !== undefined) {
        formData.isFree = formData.isFree === 'true';
      }
      if (formData.allowRsvp !== undefined) {
        formData.allowRsvp = formData.allowRsvp === 'true';
      }
      if (formData.isRecurring !== undefined) {
        formData.isRecurring = formData.isRecurring === 'true';
      }
      
      const eventData = insertEventSchema.partial().parse(formData);
      
      // Use eventData directly - dates are already strings from form validation
      const processedEventData = { ...eventData };
      
      // Geocode address if it changed
      let coordinates;
      if (eventData.address && eventData.address !== existingEvent.address) {
        coordinates = await geocodeAddress(eventData.address);
      }
      
      // Handle cover image if uploaded
      if (req.file) {
        const fileExtension = path.extname(req.file.originalname);
        const fileName = `${req.file.filename}${fileExtension}`;
        const filePath = path.join(uploadsDir, fileName);
        
        // Rename file to include extension
        fs.renameSync(req.file.path, filePath);
        processedEventData.coverImageUrl = `/uploads/${fileName}`;
        
        // Delete old image if exists
        if (existingEvent.coverImageUrl) {
          const oldPath = path.join(process.cwd(), existingEvent.coverImageUrl.replace(/^\//, ''));
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      }
      
      const event = await storage.updateEvent(eventId, processedEventData, coordinates);
      res.json(event);
    } catch (error) {
      console.error("Error updating event:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update event" });
      }
    }
  });

  app.delete('/api/events/:id', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const success = await storage.deleteEvent(req.params.id, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Event not found or not authorized" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Attendance routes
  app.post('/api/events/:id/attend', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const eventId = req.params.id;
      const { status } = req.body;
      
      const attendanceData = insertEventAttendanceSchema.parse({
        eventId,
        userId,
        status,
      });
      
      const attendance = await storage.createAttendance(attendanceData);
      res.json(attendance);
    } catch (error) {
      console.error("Error updating attendance:", error);
      res.status(500).json({ message: "Failed to update attendance" });
    }
  });

  app.get('/api/events/:id/attendees', async (req, res) => {
    try {
      const attendees = await storage.getEventAttendees(req.params.id);
      res.json(attendees);
    } catch (error) {
      console.error("Error fetching attendees:", error);
      res.status(500).json({ message: "Failed to fetch attendees" });
    }
  });

  // Friend routes
  app.get('/api/friends', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const friends = await storage.getFriends(userId);
      res.json(friends);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get('/api/friend-requests', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const requests = await storage.getFriendRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  app.post('/api/friend-requests', isAuthenticatedAny, async (req: any, res) => {
    try {
      const requesterId = getUserId(req);
      if (!requesterId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const { addresseeId } = req.body;
      
      if (requesterId === addresseeId) {
        return res.status(400).json({ message: "Cannot send friend request to yourself" });
      }
      
      // Check if already friends or request exists
      const areFriends = await storage.areFriends(requesterId, addresseeId);
      if (areFriends) {
        return res.status(400).json({ message: "Already friends" });
      }
      
      const friendship = await storage.sendFriendRequest(requesterId, addresseeId);
      res.json(friendship);
    } catch (error) {
      console.error("Error sending friend request:", error);
      res.status(500).json({ message: "Failed to send friend request" });
    }
  });

  app.put('/api/friend-requests/:id', isAuthenticatedAny, async (req: any, res) => {
    try {
      const { status } = req.body;
      const friendship = await storage.respondToFriendRequest(req.params.id, status);
      
      if (!friendship) {
        return res.status(404).json({ message: "Friend request not found" });
      }
      
      res.json(friendship);
    } catch (error) {
      console.error("Error responding to friend request:", error);
      res.status(500).json({ message: "Failed to respond to friend request" });
    }
  });

  // Rating routes
  app.post('/api/events/:id/rate', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const eventId = req.params.id;
      
      const ratingData = insertEventRatingSchema.parse({
        ...req.body,
        eventId,
        userId,
      });
      
      const rating = await storage.createRating(ratingData);
      res.json(rating);
    } catch (error) {
      console.error("Error creating rating:", error);
      res.status(500).json({ message: "Failed to create rating" });
    }
  });

  app.get('/api/events/:id/ratings', async (req, res) => {
    try {
      const ratings = await storage.getEventRatings(req.params.id);
      res.json(ratings);
    } catch (error) {
      console.error("Error fetching ratings:", error);
      res.status(500).json({ message: "Failed to fetch ratings" });
    }
  });

  // Geocoding endpoint
  app.post('/api/geocode', async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ message: "Address is required" });
      }
      
      const coordinates = await geocodeAddress(address);
      res.json(coordinates);
    } catch (error) {
      console.error("Geocoding error:", error);
      res.status(500).json({ message: "Failed to geocode address" });
    }
  });

  // Reverse geocoding endpoint
  app.post('/api/reverse-geocode', async (req, res) => {
    try {
      const { lat, lng } = req.body;
      if (!lat || !lng) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }
      
      const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!mapboxToken) {
        return res.status(500).json({ message: 'Mapbox access token not configured' });
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&limit=1`
      );

      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }

      const data = await response.json();
      if (!data.features || data.features.length === 0) {
        return res.status(404).json({ message: 'Location not found' });
      }

      const address = data.features[0].place_name;
      res.json({ address });
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      res.status(500).json({ message: "Failed to reverse geocode coordinates" });
    }
  });

  // City search endpoint for autocomplete
  app.post('/api/search-cities', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || query.length < 2) {
        return res.json({ suggestions: [] });
      }
      
      const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!mapboxToken) {
        return res.status(500).json({ message: 'Mapbox access token not configured' });
      }

      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&types=place&limit=5&language=pt`
      );

      if (!response.ok) {
        throw new Error('City search failed');
      }

      const data = await response.json();
      const suggestions = data.features?.map((feature: any) => ({
        place_name: feature.place_name,
        center: feature.center,
        text: feature.text,
      })) || [];
      
      res.json({ suggestions });
    } catch (error) {
      console.error("City search error:", error);
      res.status(500).json({ message: "Failed to search cities" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
