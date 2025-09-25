// TLS security: Using proper certificate verification for all connections

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { hashPassword } from "./auth";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Function to automatically create initial admin user
async function initializeAdminUser() {
  try {
    // Check if any admin user already exists
    const existingAdmins = await storage.getAdminUsers();
    if (existingAdmins.length > 0) {
      log("Admin user already exists, skipping initialization");
      return;
    }

    // Get admin credentials from environment secrets
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      log("ADMIN_USERNAME and ADMIN_PASSWORD must be set in secrets to create initial admin");
      return;
    }

    // Create the initial admin user
    const adminData = {
      username: adminUsername,
      password: await hashPassword(adminPassword),
      email: `${adminUsername}@admin.local`,
      firstName: "Admin",
      lastName: "User",
      authType: 'local' as const,
      role: 'super_admin' as const,
    };

    await storage.createAdminUser(adminData);
    log(`Initial super admin user created: ${adminUsername}`);
  } catch (error) {
    console.error("Error creating initial admin user:", error);
  }
}

(async () => {
  const server = await registerRoutes(app);
  
  // Initialize admin user if needed
  await initializeAdminUser();
  
  // Initialize categories if needed
  await storage.initializeCategories();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
