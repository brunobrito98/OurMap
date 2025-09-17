import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertEventSchema, insertEventAttendanceSchema, insertEventRatingSchema } from "@shared/schema";
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
      cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.'), false);
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });
  app.use('/uploads', express.static(uploadsDir));

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserWithStats(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Event routes
  app.get('/api/events', async (req, res) => {
    try {
      const { category, lat, lng } = req.query;
      const userId = req.user?.claims?.sub;
      
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

  app.get('/api/events/:id', async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
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

  app.post('/api/events', isAuthenticated, upload.single('coverImage'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventData = insertEventSchema.parse(req.body);
      
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
          ...eventData,
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

  app.put('/api/events/:id', isAuthenticated, upload.single('coverImage'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;
      
      // Check if user owns the event
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent || existingEvent.organizerId !== userId) {
        return res.status(403).json({ message: "Not authorized to edit this event" });
      }
      
      const eventData = insertEventSchema.partial().parse(req.body);
      
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
        eventData.coverImageUrl = `/uploads/${fileName}`;
        
        // Delete old image if exists
        if (existingEvent.coverImageUrl) {
          const oldPath = path.join(process.cwd(), existingEvent.coverImageUrl);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      }
      
      const event = await storage.updateEvent(eventId, eventData, coordinates);
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

  app.delete('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.post('/api/events/:id/attend', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.get('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const friends = await storage.getFriends(userId);
      res.json(friends);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get('/api/friend-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getFriendRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  app.post('/api/friend-requests', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
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

  app.put('/api/friend-requests/:id', isAuthenticated, async (req: any, res) => {
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
  app.post('/api/events/:id/rate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  const httpServer = createServer(app);
  return httpServer;
}
