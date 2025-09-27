import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupLocalAuth, isAuthenticatedLocal, isAdmin, isSuperAdmin, hashPassword } from "./auth";
import session from "express-session";
import { insertEventSchema, updateEventSchema, insertEventAttendanceSchema, insertEventRatingSchema, insertAdminUserSchema, insertLocalUserSchema, contactsMatchSchema, insertNotificationSchema, notificationConfigSchema, type User } from "@shared/schema";
import { validateEventContent, validateUserContent } from "./contentValidation";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";
import { sendEmail } from "./sendgrid";
import crypto from 'crypto';
import twilio from "twilio";

// Phone authentication schemas
export const phoneStartSchema = z.object({
  phone: z.string().min(1, "Número de telefone é obrigatório"),
  country: z.string().optional(),
});

export const phoneVerifySchema = z.object({
  phone: z.string().min(1, "Número de telefone é obrigatório"),
  code: z.string().min(1, "Código é obrigatório"),
});

export const phoneLinkSchema = z.object({
  phone: z.string().min(1, "Número de telefone é obrigatório"),
  code: z.string().min(1, "Código é obrigatório"),
});

// OTP storage interface
interface OTPRecord {
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

// Global stores and clients
const otpStore = new Map<string, OTPRecord>();

// Initialize Twilio (if configured)
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: any = null;
if (twilioAccountSid && twilioAuthToken) {
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
}

// Utility functions
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOTP(otp: string, phone: string): string {
  const secret = process.env.OTP_SECRET || 'default-secret-key';
  return crypto.createHmac('sha256', secret).update(`${otp}:${phone}`).digest('hex');
}

function generatePhoneHmac(phone: string): string {
  const secret = process.env.PHONE_HMAC_SECRET || 'default-phone-secret';
  return crypto.createHmac('sha256', secret).update(phone).digest('hex');
}

// Helper function to sanitize event data for responses
function sanitizeEventForUser(eventData: any, userId?: string) {
  // Handle both Event and EventWithDetails structures
  if (eventData.event && eventData.organizer) {
    // EventWithDetails structure: { event: {...}, organizer: {...}, ... }
    const { event, ...rest } = eventData;
    const sanitizedEvent = sanitizeEventObject(event, userId);
    return { event: sanitizedEvent, ...rest };
  } else {
    // Plain Event structure
    return sanitizeEventObject(eventData, userId);
  }
}

// Helper to sanitize a single event object
function sanitizeEventObject(event: any, userId?: string) {
  // Only show shareableLink to the event creator
  // For private events, the shareableLink is essential for sharing with invited users
  if (event.shareableLink && userId && event.creatorId !== userId) {
    const { shareableLink, ...sanitizedEvent } = event;
    return sanitizedEvent;
  }
  // If no userId provided, remove shareableLink
  if (event.shareableLink && !userId) {
    const { shareableLink, ...sanitizedEvent } = event;
    return sanitizedEvent;
  }
  return event;
}

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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

// Date recurrence helper functions
function generateRecurrenceDates(
  startDate: Date,
  endDate: Date,
  recurrenceType: string,
  recurrenceInterval: number = 1
): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);
  const maxRecurrenceDate = new Date(endDate);
  
  while (currentDate <= maxRecurrenceDate) {
    dates.push(new Date(currentDate));
    
    switch (recurrenceType) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + recurrenceInterval);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + (7 * recurrenceInterval));
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + (14 * recurrenceInterval));
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + recurrenceInterval);
        break;
      default:
        // If unknown type, break to prevent infinite loop
        break;
    }
    
    // Safety check to prevent infinite loops
    if (dates.length > 365) {
      console.warn('Recurrence limit reached (365 instances), stopping generation');
      break;
    }
  }
  
  return dates;
}

function calculateEventEndTime(startDate: Date, endTime?: Date, duration?: number): Date | undefined {
  if (endTime) return endTime;
  if (duration) {
    const calculatedEndTime = new Date(startDate);
    calculatedEndTime.setMinutes(calculatedEndTime.getMinutes() + duration);
    return calculatedEndTime;
  }
  return undefined;
}

// Notification helper functions
async function createNotificationIfEnabled(
  recipientId: string, 
  preferenceKey: string, // Changed type since notification fields don't exist in current DB
  notificationData: {
    type: string;
    title: string;
    message: string;
    relatedUserId?: string;
    relatedEventId?: string;
    actionUrl?: string;
  }
) {
  try {
    // Create notification directly since notification preferences are not implemented yet
    await storage.createNotification({
      userId: recipientId,
      ...notificationData
    });
    console.log(`Notification created for ${preferenceKey}: ${notificationData.title}`);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

async function notifyFriendsAboutEvent(creatorId: string, eventId: string, eventTitle: string) {
  try {
    const creator = await storage.getUser(creatorId);
    if (!creator) return;
    
    // Get event to check if it's private
    const event = await storage.getEvent(eventId, creatorId);
    if (!event) return;
    
    // For private events, only notify invited users
    if (event.isPrivate) {
      const invites = await storage.getEventInvites(eventId);
      for (const invite of invites) {
        await createNotificationIfEnabled(
          invite.userId,
          'notificarEventoAmigo',
          {
            type: 'event_created',
            title: 'Convite para evento privado',
            message: `${creator.firstName || 'Um amigo'} te convidou para um evento privado: "${eventTitle}"`,
            relatedUserId: creatorId,
            relatedEventId: eventId,
            actionUrl: `/event/${eventId}`
          }
        );
      }
    } else {
      // For public events, notify all friends
      const friends = await storage.getFriends(creatorId);
      for (const friend of friends) {
        await createNotificationIfEnabled(
          friend.id,
          'notificarEventoAmigo',
          {
            type: 'event_created',
            title: 'Novo evento de um amigo',
            message: `${creator.firstName || 'Um amigo'} criou um novo evento: "${eventTitle}"`,
            relatedUserId: creatorId,
            relatedEventId: eventId,
            actionUrl: `/event/${eventId}`
          }
        );
      }
    }
  } catch (error) {
    console.error('Error notifying friends about event:', error);
  }
}

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

// Geocoding function using Mapbox with optional proximity filter
async function geocodeAddress(
  address: string, 
  proximity?: { lat: number; lng: number },
  types?: string[]
): Promise<{ lat: number; lng: number }> {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) {
    throw new Error('Mapbox access token not configured');
  }

  const encodedAddress = encodeURIComponent(address);
  let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=5&language=pt`;
  
  // Add proximity filter if coordinates provided
  if (proximity) {
    url += `&proximity=${proximity.lng},${proximity.lat}`;
  }
  
  // Add types filter if specified
  if (types && types.length > 0) {
    url += `&types=${types.join(',')}`;
  }

  const response = await fetch(url);

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

// Function to get city bounding box from coordinates
async function getCityBounds(lat: number, lng: number): Promise<{ bbox?: number[], cityName?: string }> {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) {
    throw new Error('Mapbox access token not configured');
  }

  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&types=place,locality&limit=1`
  );

  if (!response.ok) {
    return {};
  }

  const data = await response.json();
  const cityFeature = data.features?.[0];
  
  if (cityFeature && cityFeature.bbox) {
    return {
      bbox: cityFeature.bbox, // [minLng, minLat, maxLng, maxLat]
      cityName: cityFeature.text
    };
  }
  
  return {};
}

// Function to search local places using Mapbox with city boundary restriction
async function searchLocalPlaces(
  query: string,
  proximity: { lat: number; lng: number },
  limit: number = 5
): Promise<any[]> {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) {
    throw new Error('Mapbox access token not configured');
  }

  // Get city bounds for precise filtering
  const { bbox, cityName } = await getCityBounds(proximity.lat, proximity.lng);
  
  const encodedQuery = encodeURIComponent(query);
  let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&types=poi,address&proximity=${proximity.lng},${proximity.lat}&limit=${limit * 2}&language=pt`;
  
  // Add bounding box if available for more precise city filtering
  if (bbox) {
    url += `&bbox=${bbox.join(',')}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Local place search failed');
  }

  const data = await response.json();
  let places = data.features?.map((feature: any) => ({
    place_name: feature.place_name,
    center: feature.center,
    text: feature.text,
    category: feature.properties?.category || 'lugar',
    address: feature.place_name,
    context: feature.context
  })) || [];
  
  // Additional filtering: keep only places that mention the current city in their context
  if (cityName) {
    places = places.filter((place: any) => {
      // Check if the place's context includes the current city
      if (place.context) {
        return place.context.some((ctx: any) => 
          ctx.text && ctx.text.toLowerCase().includes(cityName.toLowerCase())
        );
      }
      // If no context, check if city name is in the place name
      return place.place_name.toLowerCase().includes(cityName.toLowerCase());
    });
  }
  
  // Limit results after filtering
  return places.slice(0, limit);
}

// Auth middleware
function isAuthenticatedAny(req: any, res: any, next: any) {
  console.log('isAuthenticatedAny check:', {
    hasIsAuthenticated: !!req.isAuthenticated,
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    hasUser: !!req.user,
    userId: req.user?.id,
    sessionId: req.sessionID
  });
  
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
  
  // Store session parser reference for WebSocket authentication
  const sessionParser = session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true, // Required for HTTPS and sameSite: 'none'
      sameSite: 'none', // Required for iframe/proxy environment
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  });
  
  app.use(sessionParser);

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
      
      // Validate content for offensive language
      const contentValidation = validateUserContent({
        username: validatedData.username,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName
      });
      
      if (!contentValidation.isValid) {
        return res.status(400).json({ 
          message: "Conteúdo contém palavras ofensivas ou inadequadas", 
          errors: contentValidation.errors 
        });
      }
      
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
        profileImageUrl: user.profileImageUrl,
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

  // Profile image upload endpoint
  app.post('/api/user/profile-image', isAuthenticatedAny, upload.single('profileImage'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Nenhuma imagem foi enviada" });
      }

      // Process uploaded file - use safe extension based on mimetype
      const mimeToExtension: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png', 
        'image/webp': '.webp'
      };
      
      const safeExtension = mimeToExtension[req.file.mimetype];
      if (!safeExtension) {
        return res.status(400).json({ message: "Tipo de arquivo não suportado" });
      }
      
      const fileName = `profile_${userId}_${Date.now()}${safeExtension}`;
      const filePath = path.join(uploadsDir, fileName);
      
      // Rename file to include extension and user info
      fs.renameSync(req.file.path, filePath);
      const profileImageUrl = `/uploads/${fileName}`;

      // Get current user to check for existing profile image
      const currentUser = await storage.getUser(userId);
      
      // Update user profile image URL in database
      const updatedUser = await storage.updateUserProfileImage(userId, profileImageUrl);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Clean up old profile image if it exists
      if (currentUser?.profileImageUrl && currentUser.profileImageUrl.startsWith('/uploads/')) {
        const oldImagePath = path.join(process.cwd(), currentUser.profileImageUrl.replace(/^\//, ''));
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (error) {
            console.warn("Failed to delete old profile image:", error);
          }
        }
      }

      // Return sanitized user data
      const { password, ...sanitizedUser } = updatedUser;
      res.json({ 
        message: "Foto de perfil atualizada com sucesso",
        user: sanitizedUser 
      });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to upload profile image" });
      }
    }
  });

  // Profile image delete endpoint
  app.delete('/api/user/profile-image', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      // Update user profile image URL to null in database
      const updatedUser = await storage.updateUserProfileImage(userId, null);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return sanitized user data
      const { password, ...sanitizedUser } = updatedUser;
      res.json({ 
        message: "Foto de perfil removida com sucesso",
        user: sanitizedUser 
      });
    } catch (error) {
      console.error("Error removing profile image:", error);
      res.status(500).json({ message: "Failed to remove profile image" });
    }
  });

  // Update user profile endpoint
  app.patch('/api/user/profile', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const { firstName, lastName, phoneNumber } = req.body;

      // Validate input
      if (!firstName && !lastName && phoneNumber === undefined) {
        return res.status(400).json({ message: "Pelo menos um campo deve ser fornecido" });
      }

      // Validate content for offensive language
      const contentValidation = validateUserContent({
        firstName: firstName || undefined,
        lastName: lastName || undefined
      });
      
      if (!contentValidation.isValid) {
        return res.status(400).json({ 
          message: "Conteúdo contém palavras ofensivas ou inadequadas", 
          errors: contentValidation.errors 
        });
      }

      const profileData: { firstName?: string; lastName?: string; phoneE164?: string | null; phoneVerified?: boolean; phoneCountry?: string | null } = {};
      if (firstName !== undefined) profileData.firstName = firstName;
      if (lastName !== undefined) profileData.lastName = lastName;
      
      // Handle phone number update
      if (phoneNumber !== undefined) {
        if (!phoneNumber || phoneNumber.trim() === '') {
          // Clear phone number
          profileData.phoneE164 = null;
          profileData.phoneVerified = false;
          profileData.phoneCountry = null;
        } else {
          // Normalize and set phone number
          const normalizedPhone = normalizePhoneNumber(phoneNumber);
          if (normalizedPhone) {
            profileData.phoneE164 = normalizedPhone;
            profileData.phoneVerified = false; // Phone is not verified when updated
            try {
              const phoneNumberParsed = parsePhoneNumber(normalizedPhone);
              profileData.phoneCountry = phoneNumberParsed?.country || null;
            } catch {
              profileData.phoneCountry = null;
            }
          } else {
            return res.status(400).json({ message: "Número de telefone inválido" });
          }
        }
      }

      // Update user profile in database
      const updatedUser = await storage.updateUserProfile(userId, profileData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return sanitized user data
      const { password, ...sanitizedUser } = updatedUser;
      res.json({ 
        message: "Perfil atualizado com sucesso",
        user: sanitizedUser 
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Change password endpoint
  app.post('/api/user/change-password', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const { currentPassword, newPassword } = req.body;

      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" });
      }

      // Get current user to verify password
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password (using bcrypt)
      const bcrypt = require('bcrypt');
      const isValidPassword = await bcrypt.compare(currentPassword, currentUser.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: "Senha atual incorreta" });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password in database
      const updatedUser = await storage.changeUserPassword(userId, hashedNewPassword);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        message: "Senha alterada com sucesso"
      });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Forgot password endpoint
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email é obrigatório" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return res.status(200).json({ message: "Se o email existir, um link de recuperação será enviado" });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

      // Save token to database
      await storage.setPasswordResetToken(user.id, resetToken, tokenExpires);

      // Get the app domain for the reset link
      const domain = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'http://localhost:5000';
      const resetLink = `${domain}/reset-password/${resetToken}`;

      // Send email
      const emailSent = await sendEmail({
        to: email,
        from: 'noreply@ourmap.app',
        subject: 'Redefinir sua senha - OurMap',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Redefinir sua senha</h2>
            <p>Olá ${user.firstName || user.username},</p>
            <p>Você solicitou a redefinição da sua senha no OurMap. Clique no link abaixo para criar uma nova senha:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Redefinir Senha</a>
            </div>
            <p style="color: #666; font-size: 14px;">Este link expira em 1 hora. Se você não solicitou a redefinição da senha, ignore este email.</p>
            <p style="color: #666; font-size: 14px;">Se o botão não funcionar, copie e cole este link no seu navegador:</p>
            <p style="color: #666; font-size: 12px; word-break: break-all;">${resetLink}</p>
          </div>
        `,
        text: `
          Redefinir sua senha - OurMap
          
          Olá ${user.firstName || user.username},
          
          Você solicitou a redefinição da sua senha no OurMap. Acesse o link abaixo para criar uma nova senha:
          
          ${resetLink}
          
          Este link expira em 1 hora. Se você não solicitou a redefinição da senha, ignore este email.
        `
      });

      if (!emailSent) {
        console.error('Failed to send password reset email');
        return res.status(500).json({ message: "Erro ao enviar email de recuperação" });
      }

      res.status(200).json({ message: "Email de recuperação enviado com sucesso" });
    } catch (error) {
      console.error("Error in forgot password:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Validate reset token endpoint
  app.get('/api/auth/validate-reset-token/:token', async (req, res) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ message: "Token é obrigatório" });
      }

      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(404).json({ message: "Token inválido ou expirado" });
      }

      res.status(200).json({ message: "Token válido" });
    } catch (error) {
      console.error("Error validating reset token:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Reset password endpoint
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token e senha são obrigatórios" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
      }

      // Find user by token
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(404).json({ message: "Token inválido ou expirado" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(password);

      // Update password
      await storage.changeUserPassword(user.id, hashedPassword);

      // Clear reset token
      await storage.clearPasswordResetToken(user.id);

      res.status(200).json({ message: "Senha redefinida com sucesso" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Get user by ID for chat functionality (using specific route to avoid conflicts)
  app.get('/api/users/id/:userId', async (req: any, res) => {
    try {
      const { userId } = req.params;
      console.log(`[DEBUG] Searching for user with ID: ${userId}`);
      const user = await storage.getUser(userId);
      console.log(`[DEBUG] User found:`, user);
      
      if (!user) {
        console.log(`[DEBUG] User not found in database for ID: ${userId}`);
        return res.status(404).json({ message: "User not found" });
      }

      // Return sanitized user data
      const response = {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl
      };
      
      console.log(`[DEBUG] Returning user data:`, response);
      res.json(response);
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User profile route with conditional visibility
  // Get user by ID for chat functionality - specific route to avoid username conflicts
  app.get('/api/users/by-id/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return sanitized user data
      const response = {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl
      };
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user profile by username - for public profile access
  app.get('/api/users/:username', async (req: any, res) => {
    try {
      const { username } = req.params;
      const viewerId = getUserId(req); // May be undefined if not authenticated
      
      const profileData = await storage.getUserProfileByUsername(username, viewerId);
      
      if (!profileData) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const response: any = {
        name: profileData.profile.firstName && profileData.profile.lastName 
          ? `${profileData.profile.firstName} ${profileData.profile.lastName}` 
          : profileData.profile.firstName || profileData.profile.lastName || 'Usuário',
        username: profileData.profile.username,
        profile_picture_url: profileData.profile.profileImageUrl,
      };
      
      // Add full profile data if connected/can view
      if (profileData.canViewFullProfile) {
        response.phone_number = profileData.phoneNumber;
        // Sanitize events to remove shareableLink for non-creators
        const events = profileData.confirmedEvents || [];
        response.events = events.map(event => sanitizeEventForUser(event, viewerId));
      }
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Logout route - clears server session
  app.post('/api/auth/logout', async (req, res) => {
    try {
      req.logout((err) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ message: "Erro ao fazer logout" });
        }
        
        req.session.destroy((err) => {
          if (err) {
            console.error("Session destroy error:", err);
            return res.status(500).json({ message: "Erro ao encerrar sessão" });
          }
          
          res.clearCookie('connect.sid');
          res.json({ message: "Logout realizado com sucesso" });
        });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Erro ao fazer logout" });
    }
  });

  // Category routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Event routes
  app.get('/api/events', async (req, res) => {
    try {
      const { category, lat, lng, city } = req.query;
      const userId = getUserId(req);
      
      const events = await storage.getEvents({
        category: category as string,
        userLat: lat ? parseFloat(lat as string) : undefined,
        userLng: lng ? parseFloat(lng as string) : undefined,
        userCity: city as string,
        userId,
      });
      
      // Sanitize events to remove shareableLink for non-creators
      const sanitizedEvents = events.map(event => sanitizeEventForUser(event, userId));
      res.json(sanitizedEvents);
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
      
      // Sanitize events to remove shareableLink for non-creators (though user should be creator of their own events)
      const sanitizedEvents = events.map(event => sanitizeEventForUser(event, userId));
      res.json(sanitizedEvents);
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
      
      // Sanitize event to remove shareableLink for non-creators
      const sanitizedEvent = sanitizeEventForUser(event, userId);
      res.json(sanitizedEvent);
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
      if (formData.isPrivate !== undefined) {
        formData.isPrivate = formData.isPrivate === 'true';
      }
      
      // Convert numeric fields from strings - price should remain as string for schema validation
      if (formData.price !== undefined && formData.price !== '') {
        // Ensure price is a string (FormData values are strings by default)
        formData.price = formData.price.toString();
      }
      if (formData.maxAttendees !== undefined && formData.maxAttendees !== '') {
        formData.maxAttendees = parseInt(formData.maxAttendees, 10);
      }
      if (formData.recurrenceInterval !== undefined && formData.recurrenceInterval !== '') {
        formData.recurrenceInterval = parseInt(formData.recurrenceInterval, 10);
      }
      
      const eventData = insertEventSchema.parse(formData);
      
      // Validate content for offensive language
      const contentValidation = validateEventContent({
        title: eventData.title,
        description: eventData.description || '',
        location: eventData.location
      });
      
      if (!contentValidation.isValid) {
        return res.status(400).json({ 
          message: "Conteúdo contém palavras ofensivas ou inadequadas", 
          errors: contentValidation.errors 
        });
      }
      
      // Use eventData directly - dates are already strings from form validation
      const processedEventData = eventData;
      
      // Check for duplicate events
      const duplicateEvent = await storage.checkDuplicateEvent(
        processedEventData.title,
        processedEventData.location,
        processedEventData.dateTime
      );
      
      if (duplicateEvent) {
        return res.status(400).json({ 
          message: "Este evento já foi criado. Por favor, verifique os dados." 
        });
      }
      
      // Geocode the address
      const coordinates = await geocodeAddress(eventData.location);
      
      // Handle cover image if uploaded
      let coverImageUrl = null;
      if (req.file) {
        const mimeToExtension: Record<string, string> = {
          'image/jpeg': '.jpg',
          'image/png': '.png', 
          'image/webp': '.webp'
        };
        
        const safeExtension = mimeToExtension[req.file.mimetype];
        if (!safeExtension) {
          return res.status(400).json({ message: "Tipo de arquivo não suportado para capa do evento" });
        }
        
        const fileName = `${req.file.filename}${safeExtension}`;
        const filePath = path.join(uploadsDir, fileName);
        
        // Rename file to include extension
        fs.renameSync(req.file.path, filePath);
        coverImageUrl = `/uploads/${fileName}`;
      }
      
      // Create event (both single and recurring events create only one row)
      const event = await storage.createEvent(
        {
          ...processedEventData,
          coverImageUrl,
        },
        userId,
        coordinates
      );
      
      // Handle private event invitations
      if (processedEventData.isPrivate && req.body.invitedFriends) {
        try {
          const invitedFriends = JSON.parse(req.body.invitedFriends);
          if (Array.isArray(invitedFriends) && invitedFriends.length > 0) {
            await storage.inviteFriendsToEvent(event.id, invitedFriends);
            
            // Send notifications to invited friends
            for (const friendId of invitedFriends) {
              await storage.createNotification({
                userId: friendId,
                type: 'event_invite',
                title: 'Convite para evento privado',
                message: `Você foi convidado para o evento "${event.title}"`,
                relatedUserId: userId,
                relatedEventId: event.id,
                actionUrl: `/event/${event.id}`,
              });
            }
          }
        } catch (error) {
          console.error('Error processing friend invitations:', error);
        }
      }
      
      // Notify friends about the new event (only for public events)
      if (!processedEventData.isPrivate) {
        await notifyFriendsAboutEvent(userId, event.id, event.title);
      }
      
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      if (error instanceof Error) {
        // Check for unique constraint violation (PostgreSQL error code 23505)
        if (error.message.includes('unique constraint') || 
            error.message.includes('duplicate key value')) {
          res.status(400).json({ 
            message: "Este evento já foi criado. Por favor, verifique os dados." 
          });
        } else {
          res.status(400).json({ message: error.message });
        }
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
      const existingEvent = await storage.getEvent(eventId, userId);
      if (!existingEvent || existingEvent.creatorId !== userId) {
        return res.status(403).json({ message: "Not authorized to edit this event" });
      }
      
      // Convert FormData string values back to their proper types
      const formData = { ...req.body };
      
      // Convert boolean fields from strings (only process fields that exist in events table)
      if (formData.isRecurring !== undefined) {
        formData.isRecurring = formData.isRecurring === 'true';
      }
      if (formData.isPrivate !== undefined) {
        formData.isPrivate = formData.isPrivate === 'true';
      }
      
      // Convert numeric fields from strings
      if (formData.maxAttendees !== undefined && formData.maxAttendees !== '') {
        formData.maxAttendees = parseInt(formData.maxAttendees, 10);
      }
      if (formData.recurrenceInterval !== undefined && formData.recurrenceInterval !== '') {
        formData.recurrenceInterval = parseInt(formData.recurrenceInterval, 10);
      }
      
      // Ensure priceType is one of the allowed values
      if (formData.priceType && !['free', 'paid', 'crowdfunding'].includes(formData.priceType)) {
        formData.priceType = 'free' as const;
      }
      
      // Use dedicated update schema that supports partial updates with validation
      const eventData = updateEventSchema.parse(formData) as any;
      
      // Validate content for offensive language
      const contentValidation = validateEventContent({
        title: eventData.title,
        description: eventData.description || '',
        location: eventData.location
      });

      if (!contentValidation.isValid) {
        return res.status(400).json({ 
          message: "Conteúdo contém palavras ofensivas ou inadequadas",
          errors: contentValidation.errors 
        });
      }
      
      // Use eventData directly - dates are already strings from form validation
      const processedEventData = { ...eventData };
      
      // Geocode location if it changed
      let coordinates;
      if (eventData.location && eventData.location !== existingEvent.location) {
        coordinates = await geocodeAddress(eventData.location);
      }
      
      // Handle cover image if uploaded
      if (req.file) {
        const mimeToExtension: Record<string, string> = {
          'image/jpeg': '.jpg',
          'image/png': '.png', 
          'image/webp': '.webp'
        };
        
        const safeExtension = mimeToExtension[req.file.mimetype];
        if (!safeExtension) {
          return res.status(400).json({ message: "Tipo de arquivo não suportado para capa do evento" });
        }
        
        const fileName = `${req.file.filename}${safeExtension}`;
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
      
      // Ensure priceType is valid for update
      if (processedEventData.priceType && !['free', 'paid', 'crowdfunding'].includes(processedEventData.priceType)) {
        processedEventData.priceType = 'free' as const;
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
      
      // Check if event has already ended before allowing attendance
      const event = await storage.getEvent(eventId, userId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if event has ended
      const now = new Date();
      const eventEndTime = event.endTime || event.dateTime;
      if (eventEndTime && new Date(eventEndTime) <= now) {
        return res.status(400).json({ message: "Cannot change attendance for events that have already ended" });
      }
      
      const attendanceData = insertEventAttendanceSchema.parse({
        eventId,
        userId,
        status,
      });
      
      const attendance = await storage.createAttendance(attendanceData);
      
      // Notify event creator about attendance changes
      if (status === 'attending') {
        const event = await storage.getEvent(eventId, userId);
        if (event && event.creatorId !== userId) {
          const user = await storage.getUser(userId);
          if (user && event) {
            await createNotificationIfEnabled(
              event.creatorId,
              'notificarConfirmacaoPresenca',
              {
                type: 'event_attendance',
                title: 'Nova confirmação de presença',
                message: `${user.firstName || 'Alguém'} confirmou presença no seu evento "${event.title}"`,
                relatedUserId: userId,
                relatedEventId: eventId,
                actionUrl: `/event/${eventId}`
              }
            );
          }
        }
      } else if (status === 'not_going') {
        const event = await storage.getEvent(eventId, userId);
        
        // Se for um evento de vaquinha, remove as contribuições do usuário
        if (event && event.priceType === 'crowdfunding') {
          await storage.removeUserContributions(eventId, userId);
        }
        
        if (event && event.creatorId !== userId) {
          const user = await storage.getUser(userId);
          if (user && event) {
            await createNotificationIfEnabled(
              event.creatorId,
              'notificarConfirmacaoPresenca',
              {
                type: 'event_attendance',
                title: 'Cancelamento de presença',
                message: `${user.firstName || 'Alguém'} cancelou a presença no seu evento "${event.title}"`,
                relatedUserId: userId,
                relatedEventId: eventId,
                actionUrl: `/event/${eventId}`
              }
            );
          }
        }
      }
      
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

  // Contribution routes for crowdfunding events
  app.post('/api/events/:id/contribute', isAuthenticatedAny, async (req: any, res) => {
    try {
      const eventId = req.params.id;
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      // Validate contribution data
      const contributionData = {
        amount: req.body.amount,
        isPublic: req.body.isPublic || false,
      };

      // Basic validation
      const amount = parseFloat(contributionData.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Valor de contribuição inválido" });
      }

      // Check if event exists and is crowdfunding type
      const event = await storage.getEvent(eventId, userId);
      if (!event) {
        return res.status(404).json({ message: "Evento não encontrado" });
      }

      if (event.priceType !== 'crowdfunding') {
        return res.status(400).json({ message: "Este evento não aceita contribuições" });
      }

      // Check minimum contribution if set
      if (event.minimumContribution && amount < parseFloat(event.minimumContribution)) {
        return res.status(400).json({ 
          message: `Valor mínimo para contribuição é R$ ${event.minimumContribution}` 
        });
      }

      // Create contribution
      const contribution = await storage.createContribution({
        eventId,
        userId,
        amount: contributionData.amount,
        isPublic: contributionData.isPublic,
      });

      // Auto-confirm attendance when contributing
      await storage.createAttendance({
        eventId,
        userId,
        status: 'attending',
      });

      // Create notification for event organizer
      if (event.creatorId !== userId) {
        const user = await storage.getUser(userId);
        if (user) {
          await createNotificationIfEnabled(
            event.creatorId,
            'notificarConfirmacaoPresenca',
            {
              type: 'event_contribution',
              title: 'Nova contribuição recebida!',
              message: `${user.firstName || 'Alguém'} contribuiu R$ ${amount.toFixed(2)} para "${event.title}"`,
              relatedUserId: userId,
              relatedEventId: eventId,
              actionUrl: `/event/${eventId}`
            }
          );
        }
      }

      res.json({ 
        message: "Contribuição realizada com sucesso!",
        contribution 
      });
    } catch (error) {
      console.error("Error creating contribution:", error);
      res.status(500).json({ message: "Falha ao processar contribuição" });
    }
  });

  app.get('/api/events/:id/contributions', async (req, res) => {
    try {
      const eventId = req.params.id;
      const contributions = await storage.getEventContributions(eventId);
      
      // Only return public contributions and sanitize data
      const publicContributions = contributions
        .filter(contrib => contrib.isPublic)
        .map(contrib => ({
          id: contrib.id,
          amount: contrib.amount,
          createdAt: contrib.createdAt,
          userId: contrib.userId,
        }));

      res.json(publicContributions);
    } catch (error) {
      console.error("Error fetching contributions:", error);
      res.status(500).json({ message: "Falha ao buscar contribuições" });
    }
  });

  app.get('/api/events/:id/total-raised', async (req, res) => {
    try {
      const eventId = req.params.id;
      const totals = await storage.getEventTotalRaised(eventId);
      res.json(totals);
    } catch (error) {
      console.error("Error fetching total raised:", error);
      res.status(500).json({ message: "Falha ao buscar total arrecadado" });
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
      const { addresseeId, username } = req.body;
      
      let actualAddresseeId = addresseeId;
      
      // If username is provided instead of addresseeId, look up the user ID
      if (!actualAddresseeId && username) {
        const addresseeUser = await storage.getUserByUsername(username);
        if (!addresseeUser) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
        actualAddresseeId = addresseeUser.id;
      }
      
      if (!actualAddresseeId) {
        return res.status(400).json({ message: "addresseeId ou username deve ser fornecido" });
      }
      
      if (requesterId === actualAddresseeId) {
        return res.status(400).json({ message: "Cannot send friend request to yourself" });
      }
      
      // Check if already friends or request exists
      const areFriends = await storage.areFriends(requesterId, actualAddresseeId);
      if (areFriends) {
        return res.status(400).json({ message: "Already friends" });
      }
      
      // Check if a pending request already exists
      const hasPendingRequest = await storage.hasPendingFriendRequest(requesterId, actualAddresseeId);
      if (hasPendingRequest) {
        return res.status(400).json({ message: "Solicitação de conexão já enviada" });
      }
      
      const friendship = await storage.sendFriendRequest(requesterId, actualAddresseeId);
      
      // Notify user about friend request
      const requester = await storage.getUser(requesterId);
      if (requester) {
        await createNotificationIfEnabled(
          actualAddresseeId,
          'notificarConviteAmigo',
          {
            type: 'friend_invite',
            title: 'Nova solicitação de conexão',
            message: `${requester.firstName || 'Alguém'} quer se conectar com você`,
            relatedUserId: requesterId,
            actionUrl: `/friends`
          }
        );
      }
      
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
      
      // Note: Contact matching feature removed along with SMS authentication
      // This endpoint can be removed or replaced with alternative friend discovery
      const usersWithFriendshipStatus: any[] = [];
      
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
      
      // Notify event creator about new rating
      const event = await storage.getEvent(eventId, userId);
      if (event && event.creatorId !== userId) {
        const user = await storage.getUser(userId);
        if (user && event) {
          await createNotificationIfEnabled(
            event.creatorId,
            'notificarAvaliacaoEventoCriado',
            {
              type: 'event_rating',
              title: 'Nova avaliação do seu evento',
              message: `${user.firstName || 'Alguém'} avaliou seu evento "${event.title}"`,
              relatedUserId: userId,
              relatedEventId: eventId,
              actionUrl: `/event/${eventId}`
            }
          );
        }
      }
      
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

  // Get all ratings received by a user as organizer
  app.get('/api/users/:id/received-ratings', async (req, res) => {
    try {
      const userId = req.params.id;
      const ratings = await storage.getOrganizerReceivedRatings(userId);
      res.json(ratings);
    } catch (error) {
      console.error("Error fetching received ratings:", error);
      res.status(500).json({ message: "Failed to fetch received ratings" });
    }
  });

  // Geocoding endpoint with optional proximity filter
  app.post('/api/geocode', async (req, res) => {
    try {
      const { address, proximity, types } = req.body;
      if (!address) {
        return res.status(400).json({ message: "Address is required" });
      }
      
      const coordinates = await geocodeAddress(address, proximity, types);
      res.json(coordinates);
    } catch (error) {
      console.error("Geocoding error:", error);
      res.status(500).json({ message: "Failed to geocode address" });
    }
  });

  // Search local places endpoint
  app.post('/api/search-places', async (req, res) => {
    try {
      const { query, proximity } = req.body;
      if (!query || query.length < 2) {
        return res.json({ places: [] });
      }
      
      if (!proximity || !proximity.lat || !proximity.lng) {
        return res.status(400).json({ message: "User location (proximity) is required for local search" });
      }
      
      const places = await searchLocalPlaces(query, proximity, 10);
      res.json({ places });
    } catch (error) {
      console.error("Local place search error:", error);
      res.status(500).json({ message: "Failed to search local places" });
    }
  });

  // Reverse geocoding endpoint
  // Helper function to extract city from Mapbox response
  function extractCityFromMapboxResponse(feature: any): string | null {
    if (!feature || !feature.context) return null;
    
    // Find the city in context (place type)
    for (const context of feature.context) {
      if (context.id && (context.id.startsWith('place.') || context.id.startsWith('locality.'))) {
        return context.text;
      }
    }
    
    // Fallback: Extract from place_name (take the part after first comma, which is usually the city)
    const placeName = feature.place_name;
    if (placeName) {
      // For addresses like "Rua Santa Teresa 25, São Paulo - São Paulo, 01016-020, Brazil"
      // We want to extract "São Paulo" (the city part)
      const parts = placeName.split(',');
      if (parts.length >= 2) {
        // Get the second part and clean it up (remove state info)
        const cityPart = parts[1].trim();
        const cityName = cityPart.split(' - ')[0].trim(); // Remove state part like " - São Paulo"
        return cityName;
      }
    }
    
    return null;
  }

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

      const feature = data.features[0];
      const address = feature.place_name;
      const city = extractCityFromMapboxResponse(feature);
      
      console.log("DEBUG: Final city result:", city);
      
      res.json({ address, city: city || "TestCity" });
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      res.status(500).json({ message: "Failed to reverse geocode coordinates" });
    }
  });

  // City search endpoint for autocomplete with optional proximity
  app.post('/api/search-cities', async (req, res) => {
    try {
      const { query, proximity } = req.body;
      if (!query || query.length < 2) {
        return res.json({ suggestions: [] });
      }
      
      const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!mapboxToken) {
        return res.status(500).json({ message: 'Mapbox access token not configured' });
      }

      const encodedQuery = encodeURIComponent(query);
      let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&types=place,locality&limit=5&language=pt`;
      
      // Add proximity filter if coordinates provided (prioritize nearby cities)
      if (proximity && proximity.lat && proximity.lng) {
        url += `&proximity=${proximity.lng},${proximity.lat}`;
      }
      
      const response = await fetch(url);

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
      
      const userId = getUserId(req);
      const events = await storage.searchEvents(query, userId);
      
      // Sanitize events to remove shareableLink for non-creators
      const sanitizedEvents = events.map(event => sanitizeEventForUser(event, userId));
      res.json(sanitizedEvents);
    } catch (error) {
      console.error("Error searching events:", error);
      res.status(500).json({ message: "Failed to search events" });
    }
  });

  // Search ended events endpoint
  app.get('/api/search/ended-events', async (req, res) => {
    try {
      const { cityName, daysBack, searchQuery, lat, lng } = req.query;
      
      // Parse daysBack to number if provided
      const daysBackNumber = daysBack && typeof daysBack === 'string' ? parseInt(daysBack, 10) : undefined;
      if (daysBack && (isNaN(daysBackNumber!) || daysBackNumber! < 0)) {
        return res.status(400).json({ message: "Invalid daysBack parameter" });
      }
      
      // Parse coordinates if provided
      let userCoordinates: { lat: number; lng: number } | undefined = undefined;
      if (lat && lng) {
        const parsedLat = parseFloat(lat as string);
        const parsedLng = parseFloat(lng as string);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          userCoordinates = { lat: parsedLat, lng: parsedLng };
        }
      }
      
      const userId = getUserId(req);
      const events = await storage.searchEndedEvents(
        (cityName as string) || undefined,
        daysBackNumber,
        searchQuery as string || undefined,
        userId,
        userCoordinates
      );
      
      // Sanitize events to remove shareableLink for non-creators
      const sanitizedEvents = events.map(event => sanitizeEventForUser(event, userId));
      res.json(sanitizedEvents);
    } catch (error) {
      console.error("Error searching ended events:", error);
      res.status(500).json({ message: "Failed to search ended events" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const notifications = await storage.getNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      console.error("Error getting notifications:", error);
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.get('/api/notifications/unread-count', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const count = await storage.getUnreadNotificationsCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const notificationId = req.params.id;
      
      const success = await storage.markNotificationAsRead(notificationId, userId);
      if (success) {
        res.json({ message: "Notification marked as read" });
      } else {
        res.status(404).json({ message: "Notification not found" });
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch('/api/notifications/read-all', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Notification preferences routes
  app.get('/api/notifications/preferences', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const preferences = await storage.getNotificationPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error getting notification preferences:", error);
      res.status(500).json({ message: "Failed to get notification preferences" });
    }
  });

  app.patch('/api/notifications/preferences', isAuthenticatedAny, async (req: any, res) => {
    try {
      // Notification preferences are currently disabled as columns don't exist in current DB
      res.json({ message: "Notification preferences feature is currently disabled" });
    } catch (error) {
      console.error("Error updating notification preference:", error);
      res.status(500).json({ message: "Failed to update notification preference" });
    }
  });

  // Event invites routes - works for both public and private events
  app.post('/api/events/:id/invite', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const eventId = req.params.id;
      const { friendIds } = req.body;
      
      // Validate input
      if (!Array.isArray(friendIds) || friendIds.length === 0) {
        return res.status(400).json({ message: "Friend IDs array is required" });
      }
      
      // Check if user owns the event
      const event = await storage.getEvent(eventId, userId);
      if (!event || event.creatorId !== userId) {
        return res.status(403).json({ message: "Not authorized to invite to this event" });
      }
      
      // Validate that all friendIds are actual friends
      const friendships = await Promise.all(
        friendIds.map((friendId: string) => 
          storage.hasPendingFriendRequest(userId, friendId).then(pending => ({
            friendId,
            isFriend: !pending // If no pending request, they are already friends
          }))
        )
      );
      
      const validFriendIds = friendships
        .filter(f => f.isFriend)
        .map(f => f.friendId);
      
      if (validFriendIds.length === 0) {
        return res.status(400).json({ message: "No valid friends found to invite" });
      }
      
      // Send invitations
      await storage.inviteFriendsToEvent(eventId, validFriendIds);
      
      // Send notifications to invited friends
      for (const friendId of validFriendIds) {
        await storage.createNotification({
          userId: friendId,
          type: 'event_invite',
          title: 'Novo convite para evento!',
          message: `Você foi convidado para o evento "${event.title}".`,
          relatedEventId: event.id,
          relatedUserId: userId,
          actionUrl: `/event/${event.id}`
        });
      }
      
      res.json({ 
        message: `Invited ${validFriendIds.length} friends to the event`,
        invitedCount: validFriendIds.length
      });
    } catch (error) {
      console.error("Error inviting friends to event:", error);
      res.status(500).json({ message: "Failed to invite friends" });
    }
  });

  app.get('/api/events/:id/invites', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const eventId = req.params.id;
      
      // Check if user owns the event
      const event = await storage.getEvent(eventId, userId);
      if (!event || event.creatorId !== userId) {
        return res.status(403).json({ message: "Not authorized to view invites for this event" });
      }
      
      const invites = await storage.getEventInvites(eventId);
      res.json(invites);
    } catch (error) {
      console.error("Error fetching event invites:", error);
      res.status(500).json({ message: "Failed to fetch event invites" });
    }
  });

  app.post('/api/invites/:id/respond', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const inviteId = req.params.id;
      const { response } = req.body; // 'accepted' or 'declined'
      
      if (!['accepted', 'declined'].includes(response)) {
        return res.status(400).json({ message: "Response must be 'accepted' or 'declined'" });
      }
      
      // Respond to the invite
      const updatedInvite = await storage.respondToEventInvite(inviteId, userId, response);
      
      if (!updatedInvite) {
        return res.status(404).json({ message: "Invite not found or already responded to" });
      }
      
      // Get event details for notification
      const invite = await storage.getEventInviteWithDetails(inviteId, userId);
      if (invite && response === 'accepted') {
        // Notify the event organizer about the acceptance
        await storage.createNotification({
          userId: invite.event.creatorId,
          type: 'event_attendance',
          title: 'Convite aceito!',
          message: `Alguém aceitou o convite para "${invite.event.title}".`,
          relatedEventId: invite.event.id,
          actionUrl: `/event/${invite.event.id}`
        });
      }
      
      res.json({ 
        message: response === 'accepted' ? "Invite accepted successfully" : "Invite declined successfully",
        invite: updatedInvite 
      });
    } catch (error) {
      console.error("Error responding to invite:", error);
      res.status(500).json({ message: "Failed to respond to invite" });
    }
  });

  app.get('/api/events/link/:shareableLink', async (req, res) => {
    try {
      const { shareableLink } = req.params;
      const userId = getUserId(req);
      
      const event = await storage.getEventByShareableLink(shareableLink);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // For private events accessed via link, we allow access but still require auth for details
      if (event.isPrivate && !userId) {
        return res.status(401).json({ message: "Authentication required to access this private event" });
      }
      
      // Get full event details
      const eventWithDetails = await storage.getEventWithDetails(event.id, userId);
      if (!eventWithDetails) {
        return res.status(404).json({ message: "Event details not found" });
      }
      
      // Sanitize event to remove shareableLink for non-creators
      const sanitizedEvent = sanitizeEventForUser(eventWithDetails, userId);
      res.json(sanitizedEvent);
    } catch (error) {
      console.error("Error accessing event by shareable link:", error);
      res.status(500).json({ message: "Failed to access event" });
    }
  });

  app.get('/api/user/invites', isAuthenticatedAny, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const invites = await storage.getUserEventInvites(userId);
      res.json(invites);
    } catch (error) {
      console.error("Error fetching user invites:", error);
      res.status(500).json({ message: "Failed to fetch user invites" });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time chat
  const wss = new WebSocketServer({ 
    noServer: true,  // We'll handle upgrade manually
    path: '/ws'
  });
  
  // Handle WebSocket upgrade with proper authentication and CSRF protection
  httpServer.on('upgrade', (request, socket, head) => {
    const req = request as any;
    const pathname = new URL(req.url || '', `http://${req.headers.host}`).pathname;
    
    if (pathname === '/ws') {
      // CSRF Protection: Validate Origin header
      const origin = req.headers.origin;
      const host = req.headers.host;
      
      // Allow connections from same origin or localhost for development
      const allowedOrigins = [
        `https://${host}`,
        `http://${host}`,
        'http://localhost:5000', // Development
        process.env.NODE_ENV === 'development' ? 'https://530056ba-9d7a-473b-993f-c066392ca964-00-2um4pby6yv5uh.worf.replit.dev' : null
      ].filter(Boolean);
      
      if (!origin || !allowedOrigins.includes(origin)) {
        console.log(`WebSocket connection denied: Invalid origin ${origin}`);
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      
      // Parse session from upgrade request
      sessionParser(req, {} as any, () => {
        // Check authentication
        const isAuthenticated = req.session && 
                               req.session.passport && 
                               req.session.passport.user;
        
        if (isAuthenticated) {
          // Store user info for connection handler
          req.authenticatedUser = req.session.passport.user;
          
          // Proceed with WebSocket upgrade
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        } else {
          console.log('WebSocket connection denied: Not authenticated');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
        }
      });
    } else {
      socket.destroy();
    }
  });
  
  // Support multiple connections per user
  const connectedUsers = new Map<string, Set<WebSocket>>();
  
  wss.on('connection', (ws, request) => {
    const req = request as any;
    const userId = req.authenticatedUser;
    
    // Additional security check - this should never happen with proper upgrade handler
    if (!userId) {
      console.error('WebSocket connection without authenticated user - closing');
      ws.close(1008, 'Unauthorized');
      return;
    }
    
    console.log(`WebSocket connection established for user ${userId}`);
    
    // Add connection to user's set
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId)!.add(ws);
    
    // Send authentication success
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'auth_success', userId }));
    }
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
            
          case 'chat_message':
            // Handle sending chat message - use authenticated userId from session
            const { recipientId, content } = message;
            
            if (!recipientId || !content) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  message: 'Missing recipientId or content' 
                }));
              }
              return;
            }
            
            // Verify users are friends before allowing chat
            const areFriends = await storage.areFriends(userId, recipientId);
            if (!areFriends) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  message: 'You can only chat with friends' 
                }));
              }
              return;
            }
            
            // Save message to database
            let conversation = await storage.getOrCreateConversation(userId, recipientId);
            const savedMessage = await storage.createMessage(conversation.id, userId, content);
            
            // Create notification for the recipient about the new message
            const sender = await storage.getUser(userId);
            if (sender) {
              const notification = await storage.createNotification({
                userId: recipientId,
                type: 'chat_message',
                title: 'Nova mensagem',
                message: `${sender.firstName || sender.username || 'Alguém'} enviou uma mensagem: "${content.length > 50 ? content.substring(0, 50) + '...' : content}"`,
                relatedUserId: userId,
                actionUrl: `/chat/${conversation.id}?with=${userId}`,
                isRead: false
              });
              
              // Send real-time notification to recipient if they're online
              const recipientConnections = connectedUsers.get(recipientId);
              if (recipientConnections) {
                const notificationData = {
                  type: 'new_notification',
                  notification: {
                    id: notification.id,
                    userId: notification.userId,
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    relatedUserId: notification.relatedUserId,
                    actionUrl: notification.actionUrl,
                    isRead: notification.isRead,
                    createdAt: notification.createdAt,
                    relatedUser: {
                      id: sender.id,
                      firstName: sender.firstName,
                      lastName: sender.lastName,
                      profileImageUrl: sender.profileImageUrl,
                      username: sender.username
                    }
                  }
                };
                
                recipientConnections.forEach(connection => {
                  if (connection.readyState === WebSocket.OPEN) {
                    connection.send(JSON.stringify(notificationData));
                  }
                });
              }
            }
            
            // Send message to recipient if they're online (all their connections)
            const recipientConnections = connectedUsers.get(recipientId);
            if (recipientConnections) {
              const messageData = {
                type: 'new_message',
                message: {
                  id: savedMessage.id,
                  conversationId: savedMessage.conversationId,
                  senderId: savedMessage.senderId,
                  content: savedMessage.content,
                  createdAt: savedMessage.createdAt
                }
              };
              
              recipientConnections.forEach(connection => {
                if (connection.readyState === WebSocket.OPEN) {
                  connection.send(JSON.stringify(messageData));
                }
              });
            }
            
            // Confirm message sent to sender
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'message_sent',
                message: {
                  id: savedMessage.id,
                  conversationId: savedMessage.conversationId,
                  senderId: savedMessage.senderId,
                  content: savedMessage.content,
                  createdAt: savedMessage.createdAt
                }
              }));
            }
            break;
            
          case 'mark_read':
            // Validate mark_read message payload
            const markReadSchema = z.object({
              type: z.literal('mark_read'),
              messageIds: z.array(z.string().uuid()).min(1).max(50) // Limit array size
            });
            
            const markReadValidation = markReadSchema.safeParse(message);
            if (!markReadValidation.success) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Invalid mark_read message format' 
              }));
              return;
            }
            
            const { messageIds } = markReadValidation.data;
            
            try {
              await storage.markMessagesAsRead(messageIds, userId);
              
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                  type: 'messages_marked_read', 
                  messageIds 
                }));
              }
            } catch (error) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  message: error instanceof Error ? error.message : 'Failed to mark messages as read'
                }));
              }
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Invalid message format' 
          }));
        }
      }
    });
    
    ws.on('close', () => {
      // Remove this connection from user's set
      const userConnections = connectedUsers.get(userId);
      if (userConnections) {
        userConnections.delete(ws);
        
        // If no more connections, remove user entirely
        if (userConnections.size === 0) {
          connectedUsers.delete(userId);
        }
        
        console.log(`User ${userId} disconnected from WebSocket (${userConnections.size} connections remaining)`);
      }
    });
  });

  // Chat API routes
  app.get("/api/conversations", isAuthenticatedLocal, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const conversations = await storage.getConversations(userId);
      
      // Map otherUser to otherParticipant for frontend compatibility
      const mappedConversations = conversations.map(conv => ({
        ...conv,
        otherParticipant: conv.otherUser
      }));
      
      res.json(mappedConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:conversationId/messages", isAuthenticatedLocal, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Validate pagination parameters
      if (limit > 100 || limit < 1 || offset < 0) {
        return res.status(400).json({ message: "Invalid pagination parameters" });
      }
      
      const messages = await storage.getMessages(conversationId, userId, limit, offset);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      if (error instanceof Error && error.message.includes('not found or access denied')) {
        res.status(403).json({ message: "Access denied to this conversation" });
      } else {
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  });

  app.post("/api/conversations/:conversationId/messages/read", isAuthenticatedLocal, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const { conversationId } = req.params;
      
      // Validate request body
      const messageIdsSchema = z.object({
        messageIds: z.array(z.string().uuid()).min(1, "At least one messageId required")
      });
      
      const validationResult = messageIdsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.issues 
        });
      }
      
      const { messageIds } = validationResult.data;
      
      // Verify user is participant in the conversation before marking messages as read
      // This will be enforced in the storage function, which already checks conversation membership
      await storage.markMessagesAsRead(messageIds, userId);
      res.json({ success: true, message: "Messages marked as read" });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      if (error instanceof Error && error.message.includes('not found or access denied')) {
        res.status(403).json({ message: "Access denied to this conversation" });
      } else {
        res.status(500).json({ message: "Failed to mark messages as read" });
      }
    }
  });

  app.post("/api/conversations", isAuthenticatedLocal, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const { friendId } = req.body;
      
      if (!friendId) {
        return res.status(400).json({ message: "friendId is required" });
      }
      
      // Check if users are friends
      const areFriends = await storage.areFriends(userId, friendId);
      if (!areFriends) {
        return res.status(403).json({ message: "You can only chat with friends" });
      }
      
      const conversation = await storage.getOrCreateConversation(userId, friendId);
      res.json(conversation);
    } catch (error) {
      console.error("Error creating/getting conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });
  
  return httpServer;
}
