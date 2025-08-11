import { Request, Response, NextFunction } from 'express';
import { sessionManager } from '../../enhanced-session-manager';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        isAdmin: boolean;
        hasPaid: boolean;
        role: string; // for compatibility with admin checks
      };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for session ID in cookies
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'No session found' });
    }

    // Validate session using enhanced session manager
    const session = await sessionManager.validateSession(sessionId, req);
    
    if (!session || !session.user) {
      res.clearCookie('sessionId');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Attach user to request with role compatibility
    req.user = {
      ...session.user,
      role: session.user.isAdmin ? 'admin' : 'user'
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
