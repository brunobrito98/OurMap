// Local authentication implementation based on javascript_auth_all_persistance blueprint
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, RequestHandler } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, InsertLocalUser, InsertAdminUser, insertLocalUserSchema, insertAdminUserSchema } from "@shared/schema";
import { z } from "zod";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupLocalAuth(app: Express) {
  // Initialize passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup local strategy for passport
  passport.use(
    "local",
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !user.password || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Credenciais inválidas" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  // Setup passport serialization for local auth only
  passport.serializeUser((user: any, done) => {
    try {
      console.log('Serializing local user:', user.id);
      return done(null, user.id);
    } catch (error) {
      console.error('Serialization error:', error);
      done(error);
    }
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        console.log('Deserialized local user:', user.id);
        return done(null, user);
      } else {
        console.log('Local user not found:', id);
        return done(null, null);
      }
    } catch (error) {
      console.error('Deserialization error:', error);
      done(error);
    }
  });

  // Local auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = insertLocalUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username já existe" });
      }

      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      const user = await storage.createLocalUser({
        ...validatedData,
        password: await hashPassword(validatedData.password),
      });

      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Erro interno do servidor" });
        }
        res.status(201).json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          authType: user.authType,
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: error.errors[0]?.message || "Dados inválidos" 
        });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: SelectUser, info: any) => {
      if (err) {
        console.error("Authentication error:", err);
        return res.status(500).json({ message: "Erro interno do servidor" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Credenciais inválidas" });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Erro interno do servidor" });
        }
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          authType: user.authType,
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  // Bootstrap admin creation endpoint - secure with setup token
  app.post("/api/auth/bootstrap-admin", async (req, res) => {
    try {
      // Require setup token for security - fail closed if not set
      const setupToken = req.headers['x-setup-token'] as string;
      const expectedToken = process.env.ADMIN_SETUP_TOKEN;
      
      if (!expectedToken) {
        return res.status(500).json({ message: "Sistema não configurado para criação de administrador" });
      }
      
      if (!setupToken || setupToken !== expectedToken) {
        return res.status(401).json({ message: "Token de configuração inválido" });
      }

      // Check if any admin already exists
      const existingAdmins = await storage.getAdminUsers();
      if (existingAdmins.length > 0) {
        return res.status(403).json({ 
          message: "Já existe um administrador no sistema." 
        });
      }

      // Use schema without role (force super_admin)
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

      // Force super_admin role on server side
      const user = await storage.createAdminUser({
        ...validatedData,
        password: await hashPassword(validatedData.password),
        authType: 'local',
        role: 'super_admin', // Force super_admin role
      });

      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Usuário criado mas erro no login automático" });
        }
        res.status(201).json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          role: user.role,
          authType: user.authType,
          message: "Super administrador criado com sucesso"
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: error.errors[0]?.message || "Dados inválidos" 
        });
      }
      console.error("Bootstrap admin creation error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });
}

// Middleware to check if user is authenticated (works with both auth types)
export const isAuthenticatedLocal: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Admin middleware
export const isAdmin: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && (req.user?.role === 'admin' || req.user?.role === 'super_admin')) {
    return next();
  }
  res.status(403).json({ message: "Acesso negado. Apenas administradores." });
};

export const isSuperAdmin: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && req.user?.role === 'super_admin') {
    return next();
  }
  res.status(403).json({ message: "Acesso negado. Apenas super administradores." });
};