import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupLocalAuth, isAuthenticatedLocal, isAdmin, isSuperAdmin, hashPassword } from "./auth";
import session from "express-session";
import { insertEventSchema, insertEventAttendanceSchema, insertEventRatingSchema, insertAdminUserSchema, insertLocalUserSchema, phoneStartSchema, phoneVerifySchema, phoneLinkSchema, contactsMatchSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import twilio from "twilio";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";
import { createHmac, randomBytes } from "crypto";

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Phone authentication utilities
const HMAC_SECRET = process.env.SESSION_SECRET || 'default-secret';

// Initialize Twilio client (only if credentials are available)
let twilioClient: twilio.Twilio | null = null;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (twilioAccountSid && twilioAuthToken) {
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
}

// In-memory store for OTP codes (in production, use Redis or similar)
const otpStore = new Map<string, { codeHash: string; expiresAt: number; attempts: number }>();

function generateOTP(): string {
  const otp = randomBytes(3).readUIntBE(0, 3) % 1000000;
  return otp.toString().padStart(6, '0');
}

function hashOTP(code: string, phoneE164: string): string {
  return createHmac('sha256', HMAC_SECRET).update(code + phoneE164).digest('hex');
}

function generatePhoneHmac(phoneE164: string): string {
  return createHmac('sha256', HMAC_SECRET).update(phoneE164).digest('hex');
}

function normalizePhoneNumber(phone: string, country?: string): string | null {
  try {
    const phoneNumber = parsePhoneNumber(phone, country as any);
    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format('E.164');
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (record.count >= maxAttempts) {
    return true;
  }
  
  record.count++;
  return false;
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

  // Phone authentication routes
  app.post('/api/auth/phone/start', async (req, res) => {
    try {
      const { phone, country } = phoneStartSchema.parse(req.body);
      
      // Normalize phone number
      const phoneE164 = normalizePhoneNumber(phone, country);
      if (!phoneE164) {
        return res.status(400).json({ message: "Número de telefone inválido" });
      }
      
      // Rate limiting
      const clientIP = req.ip || req.connection.remoteAddress;
      if (isRateLimited(`phone_start_${clientIP}`, 5, 15 * 60 * 1000) || 
          isRateLimited(`phone_start_${phoneE164}`, 5, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Muitas tentativas. Tente novamente em 15 minutos." });
      }
      
      // Generate OTP
      const otp = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
      
      // Store OTP hash (never store plaintext)
      const codeHash = hashOTP(otp, phoneE164);
      otpStore.set(phoneE164, { codeHash, expiresAt, attempts: 0 });
      
      // Send SMS (only if Twilio is configured)
      if (twilioClient && twilioPhoneNumber) {
        try {
          await twilioClient.messages.create({
            body: `Seu código de verificação OurMap é: ${otp}`,
            from: twilioPhoneNumber,
            to: phoneE164,
          });
        } catch (twilioError) {
          console.error("Twilio error:", twilioError);
          return res.status(500).json({ message: "Falha ao enviar SMS" });
        }
      } else {
        // For development only - log the OTP (disabled in production)
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEV] OTP for ${phoneE164}: ${otp}`);
        }
      }
      
      res.json({ 
        message: "Código enviado com sucesso",
        phoneE164: phoneE164.replace(/(\+\d{2})(\d{2})(\d{5})(\d{4})/, '$1 ($2) $3-$4') // Format for display
      });
    } catch (error) {
      console.error("Phone start error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post('/api/auth/phone/verify', async (req, res) => {
    try {
      const { phone, code } = phoneVerifySchema.parse(req.body);
      
      // Rate limiting
      const clientIP = req.ip || req.connection.remoteAddress;
      if (isRateLimited(`phone_verify_${clientIP}`, 10, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Muitas tentativas. Tente novamente em 15 minutos." });
      }
      
      // Normalize phone number
      const phoneE164 = normalizePhoneNumber(phone);
      if (!phoneE164) {
        return res.status(400).json({ message: "Número de telefone inválido" });
      }
      
      // Additional rate limiting by phone
      if (isRateLimited(`phone_verify_${phoneE164}`, 10, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Muitas tentativas para este número. Tente novamente em 15 minutos." });
      }
      
      // Get stored OTP
      const storedOTP = otpStore.get(phoneE164);
      if (!storedOTP) {
        return res.status(400).json({ message: "Código não encontrado ou expirado" });
      }
      
      // Check expiration
      if (Date.now() > storedOTP.expiresAt) {
        otpStore.delete(phoneE164);
        return res.status(400).json({ message: "Código expirado" });
      }
      
      // Check attempts
      if (storedOTP.attempts >= 3) {
        otpStore.delete(phoneE164);
        return res.status(400).json({ message: "Muitas tentativas incorretas" });
      }
      
      // Verify code using hash comparison
      const providedCodeHash = hashOTP(code, phoneE164);
      if (storedOTP.codeHash !== providedCodeHash) {
        storedOTP.attempts++;
        return res.status(400).json({ message: "Código incorreto" });
      }
      
      // Clear OTP
      otpStore.delete(phoneE164);
      
      // Check if user already exists with this phone
      const existingUser = await storage.getUserByPhone(phoneE164);
      
      if (existingUser) {
        // Login existing user
        req.login(existingUser, (err) => {
          if (err) {
            console.error("Login error:", err);
            return res.status(500).json({ message: "Erro no login" });
          }
          
          const { password, ...sanitizedUser } = existingUser;
          res.json({
            message: "Login realizado com sucesso",
            user: sanitizedUser
          });
        });
      } else {
        // Create new user
        try {
          const phoneHmac = generatePhoneHmac(phoneE164);
          const phoneNumber = parsePhoneNumber(phoneE164);
          
          const newUser = await storage.createUser({
            firstName: "Usuário",
            lastName: "Telefone",
            phoneE164,
            phoneVerified: true,
            phoneCountry: phoneNumber?.country || undefined,
            phoneHmac,
            authType: "phone",
          });
          
          req.login(newUser, (err) => {
            if (err) {
              console.error("Login error:", err);
              return res.status(500).json({ message: "Erro no login" });
            }
            
            const { password, ...sanitizedUser } = newUser;
            res.json({
              message: "Conta criada e login realizado com sucesso",
              user: sanitizedUser
            });
          });
        } catch (createError) {
          console.error("User creation error:", createError);
          res.status(500).json({ message: "Erro ao criar usuário" });
        }
      }
    } catch (error) {
      console.error("Phone verify error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post('/api/auth/phone/link', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      // Rate limiting
      const clientIP = req.ip || req.connection.remoteAddress;
      if (isRateLimited(`phone_link_${clientIP}`, 5, 15 * 60 * 1000) || 
          isRateLimited(`phone_link_${userId}`, 5, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Muitas tentativas. Tente novamente em 15 minutos." });
      }
      
      const { phone, code } = phoneLinkSchema.parse(req.body);
      
      // Normalize phone number
      const phoneE164 = normalizePhoneNumber(phone);
      if (!phoneE164) {
        return res.status(400).json({ message: "Número de telefone inválido" });
      }
      
      // Get stored OTP
      const storedOTP = otpStore.get(phoneE164);
      if (!storedOTP) {
        return res.status(400).json({ message: "Código não encontrado ou expirado" });
      }
      
      // Check expiration
      if (Date.now() > storedOTP.expiresAt) {
        otpStore.delete(phoneE164);
        return res.status(400).json({ message: "Código expirado" });
      }
      
      // Verify code using hash comparison
      const providedCodeHashForLink = hashOTP(code, phoneE164);
      if (storedOTP.codeHash !== providedCodeHashForLink) {
        storedOTP.attempts++;
        return res.status(400).json({ message: "Código incorreto" });
      }
      
      // Clear OTP
      otpStore.delete(phoneE164);
      
      // Check if phone is already used by another user
      const existingUser = await storage.getUserByPhone(phoneE164);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: "Este telefone já está vinculado a outra conta" });
      }
      
      // Link phone to current user
      const phoneHmac = generatePhoneHmac(phoneE164);
      const phoneNumber = parsePhoneNumber(phoneE164);
      
      await storage.updateUserPhone(userId, {
        phoneE164,
        phoneVerified: true,
        phoneCountry: phoneNumber?.country || undefined,
        phoneHmac,
      });
      
      res.json({ message: "Telefone vinculado com sucesso" });
    } catch (error) {
      console.error("Phone link error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
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
      
      // Convert numeric fields from strings - price should remain as string for schema validation
      if (formData.price !== undefined && formData.price !== '') {
        // Ensure price is a string (FormData values are strings by default)
        formData.price = formData.price.toString();
      }
      
      const eventData = insertEventSchema.parse(formData);
      
      // Use eventData directly - dates are already strings from form validation
      const processedEventData = eventData;
      
      // Geocode the address
      const coordinates = await geocodeAddress(eventData.location);
      
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
      if (!existingEvent || existingEvent.creatorId !== userId) {
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
      
      // Convert numeric fields from strings - price should remain as string for schema validation
      if (formData.price !== undefined && formData.price !== '') {
        // Ensure price is a string (FormData values are strings by default)
        formData.price = formData.price.toString();
      }
      
      const eventData = insertEventSchema.partial().parse(formData);
      
      // Use eventData directly - dates are already strings from form validation
      const processedEventData = { ...eventData };
      
      // Geocode location if it changed
      let coordinates;
      if (eventData.location && eventData.location !== existingEvent.location) {
        coordinates = await geocodeAddress(eventData.location);
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
      // Sanitize attendee data - remove sensitive fields
      const sanitizedAttendees = attendees.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        authType: user.authType,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
      res.json(sanitizedAttendees);
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
      // Sanitize friend data - remove sensitive fields
      const sanitizedFriends = friends.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        authType: user.authType,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
      res.json(sanitizedFriends);
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

  // Contacts matching endpoint
  app.post('/api/friends/contacts', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const { contacts } = contactsMatchSchema.parse(req.body);
      
      // Normalize all phone numbers
      const normalizedContacts: string[] = [];
      for (const contact of contacts) {
        const normalized = normalizePhoneNumber(contact);
        if (normalized) {
          normalizedContacts.push(normalized);
        }
      }
      
      // Generate HMACs for matching
      const contactHmacs = normalizedContacts.map(phone => generatePhoneHmac(phone));
      
      // Find matching users (excluding the current user)
      const matchingUsers = await storage.getUsersByPhoneHmacs(contactHmacs, userId);
      
      // Get existing friendships status
      const usersWithFriendshipStatus = await Promise.all(
        matchingUsers.map(async (user) => {
          const areFriends = await storage.areFriends(userId, user.id);
          const hasPendingRequest = await storage.hasPendingFriendRequest(userId, user.id);
          
          return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            profileImageUrl: user.profileImageUrl,
            friendshipStatus: areFriends ? 'friends' : hasPendingRequest ? 'pending' : 'none'
          };
        })
      );
      
      res.json(usersWithFriendshipStatus);
    } catch (error) {
      console.error("Error matching contacts:", error);
      res.status(500).json({ message: "Failed to match contacts" });
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
      
      // Check if user can rate this event
      const canRate = await storage.canUserRateEvent(eventId, userId);
      if (!canRate.canRate) {
        return res.status(400).json({ message: canRate.reason });
      }
      
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

  app.get('/api/events/:id/ratings/average', async (req, res) => {
    try {
      const average = await storage.getEventRatingsAverage(req.params.id);
      res.json(average);
    } catch (error) {
      console.error("Error fetching ratings average:", error);
      res.status(500).json({ message: "Failed to fetch ratings average" });
    }
  });

  app.get('/api/events/:id/can-rate', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const canRate = await storage.canUserRateEvent(req.params.id, userId);
      res.json(canRate);
    } catch (error) {
      console.error("Error checking if user can rate:", error);
      res.status(500).json({ message: "Failed to check rating permission" });
    }
  });

  app.get('/api/events/:id/my-rating', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const rating = await storage.getUserEventRating(req.params.id, userId);
      res.json(rating || null);
    } catch (error) {
      console.error("Error fetching user rating:", error);
      res.status(500).json({ message: "Failed to fetch user rating" });
    }
  });

  app.get('/api/users/:id/organizer-rating', async (req, res) => {
    try {
      const organizerRating = await storage.getOrganizerRatingsAverage(req.params.id);
      res.json(organizerRating);
    } catch (error) {
      console.error("Error fetching organizer rating:", error);
      res.status(500).json({ message: "Failed to fetch organizer rating" });
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

  // Search endpoints
  app.get('/api/search/users', async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.json([]);
      }
      
      const users = await storage.searchUsers(query);
      res.json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  app.get('/api/search/events', async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.json([]);
      }
      
      const events = await storage.searchEvents(query);
      res.json(events);
    } catch (error) {
      console.error("Error searching events:", error);
      res.status(500).json({ message: "Failed to search events" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
