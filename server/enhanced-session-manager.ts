// Enhanced Session Management System with advanced features
import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import crypto from 'crypto';

interface SessionData {
  id: string;
  userId: number;
  email: string;
  isAdmin: boolean;
  hasPaid: boolean;
  loginTime: number;
  lastActivity: number;
  userAgent: string;
  ipAddress: string;
  deviceFingerprint: string;
  sessionVersion: number;
  metadata: Record<string, any>;
}

interface SessionStore {
  sessions: Map<string, SessionData>;
  userSessions: Map<number, Set<string>>; // userId -> sessionIds
  refreshTokens: Map<string, {
    sessionId: string;
    userId: number;
    expiresAt: number;
    isRevoked: boolean;
  }>;
}

interface SessionConfig {
  maxAge: number; // Session max age in ms
  refreshTokenMaxAge: number; // Refresh token max age in ms
  maxSessionsPerUser: number; // Max concurrent sessions per user
  requireRefresh: boolean; // Whether to use refresh tokens
  trackActivity: boolean; // Whether to track user activity
  securityChecks: boolean; // Whether to perform security checks
  autoExtend: boolean; // Whether to auto-extend sessions on activity
}

interface SessionAnalytics {
  totalSessions: number;
  activeSessions: number;
  uniqueUsers: number;
  averageSessionDuration: number;
  topUserAgents: Array<{ userAgent: string; count: number }>;
  loginsByHour: number[];
  securityEvents: Array<{
    type: string;
    sessionId: string;
    userId: number;
    timestamp: number;
    details: any;
  }>;
}

class EnhancedSessionManager extends EventEmitter {
  private store: SessionStore = {
    sessions: new Map(),
    userSessions: new Map(),
    refreshTokens: new Map()
  };

  private config: SessionConfig = {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    refreshTokenMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxSessionsPerUser: 5, // Max 5 concurrent sessions
    requireRefresh: true,
    trackActivity: true,
    securityChecks: true,
    autoExtend: true
  };

  private analytics: SessionAnalytics = {
    totalSessions: 0,
    activeSessions: 0,
    uniqueUsers: 0,
    averageSessionDuration: 0,
    topUserAgents: [],
    loginsByHour: new Array(24).fill(0),
    securityEvents: []
  };

  private cleanupInterval: NodeJS.Timer;

  constructor(config: Partial<SessionConfig> = {}) {
    super();
    this.config = { ...this.config, ...config };
    this.startCleanupProcess();
    this.startAnalyticsUpdate();
  }

  // ==================== SESSION LIFECYCLE ====================

  async createSession(user: any, req: Request): Promise<{ sessionId: string; refreshToken?: string }> {
    const sessionId = this.generateSecureId();
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = this.getClientIP(req);
    const deviceFingerprint = this.generateDeviceFingerprint(req);

    // Check for suspicious activity
    if (this.config.securityChecks) {
      await this.performSecurityChecks(user.id, ipAddress, userAgent);
    }

    // Limit concurrent sessions per user
    await this.enforceSessionLimit(user.id);

    const session: SessionData = {
      id: sessionId,
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin || false,
      hasPaid: user.hasPaid || false,
      loginTime: Date.now(),
      lastActivity: Date.now(),
      userAgent,
      ipAddress,
      deviceFingerprint,
      sessionVersion: 1,
      metadata: {}
    };

    // Store session
    this.store.sessions.set(sessionId, session);

    // Track user sessions
    if (!this.store.userSessions.has(user.id)) {
      this.store.userSessions.set(user.id, new Set());
    }
    this.store.userSessions.get(user.id)!.add(sessionId);

    // Create refresh token if enabled
    let refreshToken: string | undefined;
    if (this.config.requireRefresh) {
      refreshToken = this.generateSecureId();
      this.store.refreshTokens.set(refreshToken, {
        sessionId,
        userId: user.id,
        expiresAt: Date.now() + this.config.refreshTokenMaxAge,
        isRevoked: false
      });
    }

    // Update analytics
    this.analytics.totalSessions++;
    this.updateLoginAnalytics(new Date());
    this.emit('session-created', { sessionId, userId: user.id, ipAddress });

    console.log(`✅ Created session ${sessionId} for user ${user.email} from ${ipAddress}`);

    return { sessionId, refreshToken };
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const session = this.store.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (this.isSessionExpired(session)) {
      await this.destroySession(sessionId);
      return null;
    }

    // Update last activity if tracking is enabled
    if (this.config.trackActivity) {
      session.lastActivity = Date.now();
      
      // Auto-extend session if enabled
      if (this.config.autoExtend) {
        // Don't extend if less than 1 hour has passed since last extension
        const timeSinceLogin = Date.now() - session.loginTime;
        const remainingTime = this.config.maxAge - timeSinceLogin;
        
        if (remainingTime < this.config.maxAge * 0.25) { // Extend when 75% of time has passed
          session.loginTime = Date.now() - (this.config.maxAge * 0.5); // Reset to 50% remaining
          this.emit('session-extended', { sessionId, userId: session.userId });
        }
      }
    }

    return session;
  }

  async refreshSession(refreshToken: string, req: Request): Promise<{ sessionId: string; newRefreshToken: string } | null> {
    const tokenData = this.store.refreshTokens.get(refreshToken);
    
    if (!tokenData || tokenData.isRevoked || Date.now() > tokenData.expiresAt) {
      this.store.refreshTokens.delete(refreshToken);
      return null;
    }

    const session = this.store.sessions.get(tokenData.sessionId);
    if (!session) {
      this.store.refreshTokens.delete(refreshToken);
      return null;
    }

    // Security checks for refresh
    if (this.config.securityChecks) {
      const currentIP = this.getClientIP(req);
      const currentUA = req.get('User-Agent') || '';
      const currentFingerprint = this.generateDeviceFingerprint(req);

      // Check for suspicious changes
      if (session.ipAddress !== currentIP) {
        this.recordSecurityEvent('ip-change', session.id, session.userId, {
          oldIP: session.ipAddress,
          newIP: currentIP
        });
      }

      if (session.deviceFingerprint !== currentFingerprint) {
        this.recordSecurityEvent('device-change', session.id, session.userId, {
          oldFingerprint: session.deviceFingerprint,
          newFingerprint: currentFingerprint
        });
      }
    }

    // Revoke old refresh token
    this.store.refreshTokens.delete(refreshToken);

    // Create new refresh token
    const newRefreshToken = this.generateSecureId();
    this.store.refreshTokens.set(newRefreshToken, {
      sessionId: tokenData.sessionId,
      userId: tokenData.userId,
      expiresAt: Date.now() + this.config.refreshTokenMaxAge,
      isRevoked: false
    });

    // Update session
    session.lastActivity = Date.now();
    session.sessionVersion++;
    session.ipAddress = this.getClientIP(req);
    session.userAgent = req.get('User-Agent') || '';

    this.emit('session-refreshed', { sessionId: tokenData.sessionId, userId: tokenData.userId });

    return { sessionId: tokenData.sessionId, newRefreshToken };
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.store.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Remove from user sessions
    const userSessions = this.store.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.store.userSessions.delete(session.userId);
      }
    }

    // Revoke associated refresh tokens
    for (const [token, tokenData] of this.store.refreshTokens) {
      if (tokenData.sessionId === sessionId) {
        tokenData.isRevoked = true;
        // Don't delete immediately to prevent replay attacks
        setTimeout(() => this.store.refreshTokens.delete(token), 60000); // Delete after 1 minute
      }
    }

    // Remove session
    this.store.sessions.delete(sessionId);

    this.emit('session-destroyed', { sessionId, userId: session.userId });
    console.log(`🗑️ Destroyed session ${sessionId} for user ${session.userId}`);

    return true;
  }

  async destroyAllUserSessions(userId: number, exceptSessionId?: string): Promise<number> {
    const userSessions = this.store.userSessions.get(userId);
    if (!userSessions) {
      return 0;
    }

    let destroyedCount = 0;
    const sessionsToDestroy = Array.from(userSessions).filter(id => id !== exceptSessionId);

    for (const sessionId of sessionsToDestroy) {
      if (await this.destroySession(sessionId)) {
        destroyedCount++;
      }
    }

    this.emit('user-sessions-destroyed', { userId, count: destroyedCount, exceptSessionId });
    return destroyedCount;
  }

  // ==================== EXPRESS MIDDLEWARE ====================

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Try to get session from various sources
        const sessionId = req.cookies?.sessionId || 
                         req.header('Authorization')?.replace('Bearer ', '') ||
                         req.header('X-Session-ID');

        if (!sessionId) {
          req.session = null;
          req.user = null;
          return next();
        }

        const session = await this.getSession(sessionId);
        if (!session) {
          // Clear invalid session cookie
          res.clearCookie('sessionId');
          req.session = null;
          req.user = null;
          return next();
        }

        // Attach session data to request
        req.session = session;
        req.user = {
          id: session.userId,
          email: session.email,
          isAdmin: session.isAdmin,
          hasPaid: session.hasPaid
        };

        // Security checks
        if (this.config.securityChecks) {
          if (!this.validateSessionSecurity(session, req)) {
            await this.destroySession(sessionId);
            res.clearCookie('sessionId');
            req.session = null;
            req.user = null;
            return next();
          }
        }

        next();
      } catch (error) {
        console.error('Session middleware error:', error);
        req.session = null;
        req.user = null;
        next();
      }
    };
  }

  requireAuth() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      next();
    };
  }

  requireAdmin() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    };
  }

  requirePayment() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (!req.user.isAdmin && !req.user.hasPaid) {
        return res.status(402).json({ error: 'Payment required' });
      }
      next();
    };
  }

  // ==================== SECURITY FUNCTIONS ====================

  private async performSecurityChecks(userId: number, ipAddress: string, userAgent: string) {
    // Check for rapid login attempts
    const recentSessions = Array.from(this.store.sessions.values())
      .filter(s => s.userId === userId && Date.now() - s.loginTime < 300000); // 5 minutes

    if (recentSessions.length > 3) {
      this.recordSecurityEvent('rapid-login', '', userId, { ipAddress, userAgent, count: recentSessions.length });
      throw new Error('Too many login attempts. Please wait before trying again.');
    }

    // Check for suspicious IP patterns
    const ipSessions = Array.from(this.store.sessions.values())
      .filter(s => s.ipAddress === ipAddress && Date.now() - s.loginTime < 3600000); // 1 hour

    if (ipSessions.length > 10) {
      this.recordSecurityEvent('ip-abuse', '', userId, { ipAddress, sessionCount: ipSessions.length });
    }
  }

  private validateSessionSecurity(session: SessionData, req: Request): boolean {
    const currentIP = this.getClientIP(req);
    const currentUA = req.get('User-Agent') || '';

    // Check for IP address changes
    if (session.ipAddress !== currentIP) {
      this.recordSecurityEvent('ip-mismatch', session.id, session.userId, {
        sessionIP: session.ipAddress,
        currentIP
      });
      // For high security, you might want to invalidate the session
      // return false;
    }

    // Check for user agent changes (less strict)
    if (session.userAgent !== currentUA) {
      this.recordSecurityEvent('ua-mismatch', session.id, session.userId, {
        sessionUA: session.userAgent,
        currentUA
      });
    }

    return true;
  }

  private recordSecurityEvent(type: string, sessionId: string, userId: number, details: any) {
    const event = {
      type,
      sessionId,
      userId,
      timestamp: Date.now(),
      details
    };

    this.analytics.securityEvents.push(event);
    
    // Keep only last 1000 events
    if (this.analytics.securityEvents.length > 1000) {
      this.analytics.securityEvents = this.analytics.securityEvents.slice(-1000);
    }

    this.emit('security-event', event);
    console.warn(`🚨 Security event: ${type} for user ${userId}`, details);
  }

  // ==================== UTILITY FUNCTIONS ====================

  private generateSecureId(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private getClientIP(req: Request): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
           'unknown';
  }

  private generateDeviceFingerprint(req: Request): string {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.get('Accept') || ''
    ];
    return crypto.createHash('sha256').update(components.join('|')).digest('hex').substring(0, 16);
  }

  private isSessionExpired(session: SessionData): boolean {
    const age = Date.now() - session.loginTime;
    return age > this.config.maxAge;
  }

  private async enforceSessionLimit(userId: number) {
    const userSessions = this.store.userSessions.get(userId);
    if (!userSessions || userSessions.size < this.config.maxSessionsPerUser) {
      return;
    }

    // Remove oldest sessions
    const sessions = Array.from(userSessions)
      .map(id => ({ id, session: this.store.sessions.get(id) }))
      .filter(item => item.session)
      .sort((a, b) => a.session!.loginTime - b.session!.loginTime);

    const sessionsToRemove = sessions.slice(0, sessions.length - this.config.maxSessionsPerUser + 1);
    
    for (const { id } of sessionsToRemove) {
      await this.destroySession(id);
    }

    if (sessionsToRemove.length > 0) {
      this.emit('session-limit-enforced', { userId, removedCount: sessionsToRemove.length });
    }
  }

  // ==================== ANALYTICS & MONITORING ====================

  private startAnalyticsUpdate() {
    setInterval(() => {
      this.updateAnalytics();
    }, 60000); // Update every minute
  }

  private updateAnalytics() {
    this.analytics.activeSessions = this.store.sessions.size;
    this.analytics.uniqueUsers = this.store.userSessions.size;

    // Calculate average session duration
    const activeSessions = Array.from(this.store.sessions.values());
    if (activeSessions.length > 0) {
      const totalDuration = activeSessions.reduce((sum, session) => {
        return sum + (Date.now() - session.loginTime);
      }, 0);
      this.analytics.averageSessionDuration = totalDuration / activeSessions.length;
    }

    // Update user agent statistics
    const userAgents = new Map<string, number>();
    activeSessions.forEach(session => {
      const ua = session.userAgent.split(' ')[0]; // Get browser name
      userAgents.set(ua, (userAgents.get(ua) || 0) + 1);
    });

    this.analytics.topUserAgents = Array.from(userAgents.entries())
      .map(([userAgent, count]) => ({ userAgent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private updateLoginAnalytics(loginTime: Date) {
    const hour = loginTime.getHours();
    this.analytics.loginsByHour[hour]++;
  }

  private startCleanupProcess() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  private cleanup() {
    let expiredSessions = 0;
    let expiredTokens = 0;

    // Clean up expired sessions
    for (const [sessionId, session] of this.store.sessions) {
      if (this.isSessionExpired(session)) {
        this.destroySession(sessionId);
        expiredSessions++;
      }
    }

    // Clean up expired refresh tokens
    const now = Date.now();
    for (const [token, tokenData] of this.store.refreshTokens) {
      if (tokenData.isRevoked || now > tokenData.expiresAt) {
        this.store.refreshTokens.delete(token);
        expiredTokens++;
      }
    }

    if (expiredSessions > 0 || expiredTokens > 0) {
      console.log(`🧹 Cleaned up ${expiredSessions} expired sessions and ${expiredTokens} expired refresh tokens`);
    }
  }

  // ==================== PUBLIC API ====================

  getAnalytics(): SessionAnalytics {
    this.updateAnalytics();
    return { ...this.analytics };
  }

  getActiveSessions(userId?: number): SessionData[] {
    if (userId) {
      const userSessionIds = this.store.userSessions.get(userId);
      if (!userSessionIds) return [];
      
      return Array.from(userSessionIds)
        .map(id => this.store.sessions.get(id))
        .filter(session => session && !this.isSessionExpired(session)) as SessionData[];
    }

    return Array.from(this.store.sessions.values())
      .filter(session => !this.isSessionExpired(session));
  }

  async updateSessionMetadata(sessionId: string, metadata: Record<string, any>): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    session.metadata = { ...session.metadata, ...metadata };
    return true;
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down Enhanced Session Manager...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Perform final cleanup
    this.cleanup();

    this.emit('shutdown');
    console.log('✅ Enhanced Session Manager shut down gracefully');
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      session?: SessionData | null;
      user?: {
        id: number;
        email: string;
        isAdmin: boolean;
        hasPaid: boolean;
      } | null;
    }
  }
}

export const sessionManager = new EnhancedSessionManager();
export { EnhancedSessionManager, SessionData, SessionConfig, SessionAnalytics };
