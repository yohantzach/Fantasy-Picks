import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sessionManager } from "./enhanced-session-manager";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
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

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "fpl-custom-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 60 * 1000, // 30 minutes
    },
  };

  app.set("trust proxy", 1);
  
  // Use enhanced session management middleware
  app.use(sessionManager.middleware());
  
  // Fallback to express-session for backward compatibility
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" }, // Use email instead of username
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false);
          } else {
            return done(null, user);
          }
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // User not found, clear session
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error('User deserialization error:', error);
      // Clear session on error
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      // Create enhanced session
      const { sessionId, refreshToken } = await sessionManager.createSession(user, req);
      
      // Set session cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 60 * 1000 // 30 minutes
      });
      
      // Also set refresh token if available
      if (refreshToken) {
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }
      
      // Fallback passport login for compatibility
      req.login(user, (err) => {
        if (err) return next(err);
        
        const userResponse = {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
          hasPaid: user.hasPaid,
          sessionId,
          ...(refreshToken && { hasRefreshToken: true })
        };
        
        res.status(201).json(userResponse);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/login", async (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      try {
        // Create enhanced session
        const { sessionId, refreshToken } = await sessionManager.createSession(user, req);
        
        // Set session cookie
        res.cookie('sessionId', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 60 * 1000 // 30 minutes
        });
        
        // Also set refresh token if available
        if (refreshToken) {
          res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });
        }
        
        // Fallback passport login for compatibility
        req.login(user, (err) => {
          if (err) return next(err);
          
          const userResponse = {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
            hasPaid: user.hasPaid,
            sessionId,
            ...(refreshToken && { hasRefreshToken: true })
          };
          
          return res.json(userResponse);
        });
      } catch (error) {
        console.error('Login session creation error:', error);
        return res.status(500).json({ error: error.message || 'Login failed' });
      }
    })(req, res, next);
  });

  app.post("/api/logout", async (req, res, next) => {
    try {
      const sessionId = req.cookies?.sessionId;
      
      // Destroy enhanced session if it exists
      if (sessionId) {
        await sessionManager.destroySession(sessionId);
        res.clearCookie('sessionId');
        res.clearCookie('refreshToken');
      }
      
      // Fallback passport logout
      req.logout((err) => {
        if (err) return next(err);
        res.json({ message: 'Logged out successfully' });
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });
  
  // Logout from all devices
  app.post("/api/logout/all", sessionManager.requireAuth(), async (req, res) => {
    try {
      const userId = req.user!.id;
      const currentSessionId = req.cookies?.sessionId;
      
      const destroyedCount = await sessionManager.destroyAllUserSessions(userId, currentSessionId);
      
      res.json({ 
        message: `Logged out from ${destroyedCount} other devices`,
        destroyedSessions: destroyedCount 
      });
    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({ error: 'Failed to logout from all devices' });
    }
  });
  
  // Refresh session endpoint
  app.post("/api/session/refresh", async (req, res) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token provided' });
      }
      
      const result = await sessionManager.refreshSession(refreshToken, req);
      
      if (!result) {
        res.clearCookie('sessionId');
        res.clearCookie('refreshToken');
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }
      
      // Set new cookies
      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 60 * 1000
      });
      
      res.cookie('refreshToken', result.newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      
      res.json({ message: 'Session refreshed successfully' });
    } catch (error) {
      console.error('Session refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh session' });
    }
  });
  
  // Get active sessions for current user
  app.get("/api/sessions", sessionManager.requireAuth(), async (req, res) => {
    try {
      const userId = req.user!.id;
      const sessions = sessionManager.getActiveSessions(userId);
      
      // Don't expose sensitive data
      const safeSessions = sessions.map(session => ({
        id: session.id,
        loginTime: new Date(session.loginTime).toISOString(),
        lastActivity: new Date(session.lastActivity).toISOString(),
        userAgent: session.userAgent,
        ipAddress: session.ipAddress.replace(/\d+$/, 'xxx'), // Partially hide IP
        isCurrent: session.id === req.cookies?.sessionId
      }));
      
      res.json(safeSessions);
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });
  
  // Revoke specific session
  app.delete("/api/sessions/:sessionId", sessionManager.requireAuth(), async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.id;
      
      // Verify the session belongs to the user
      const userSessions = sessionManager.getActiveSessions(userId);
      const targetSession = userSessions.find(s => s.id === sessionId);
      
      if (!targetSession) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const success = await sessionManager.destroySession(sessionId);
      
      if (success) {
        res.json({ message: 'Session revoked successfully' });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    } catch (error) {
      console.error('Revoke session error:', error);
      res.status(500).json({ error: 'Failed to revoke session' });
    }
  });

  // Clear all sessions (debug/admin endpoint)
  app.post("/api/admin/clear-sessions", async (req, res) => {
    try {
      const clearedCount = await sessionManager.clearAllSessions();
      
      res.json({ 
        message: `Cleared ${clearedCount} sessions successfully`,
        clearedCount
      });
    } catch (error) {
      console.error('Clear sessions error:', error);
      res.status(500).json({ error: 'Failed to clear sessions' });
    }
  });

  app.get("/api/user", (req, res) => {
    if (!req.user) return res.sendStatus(401);
    res.json(req.user);
  });
}
