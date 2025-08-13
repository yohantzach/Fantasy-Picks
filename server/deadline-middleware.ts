import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

export interface DeadlineCheckResult {
  gameweek: any;
  isDeadlinePassed: boolean;
  isGameweekCompleted: boolean;
  canModifyTeam: boolean;
  message?: string;
}

export async function checkDeadlineMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const currentGameweek = await storage.getCurrentGameweek();
    
    // Allow gameweek creation endpoints to proceed even without active gameweek
    const isGameweekManagementRoute = (
      req.path === '/api/gameweek/current' ||
      req.path.startsWith('/api/admin/gameweek') ||
      req.path.startsWith('/api/admin/update-deadlines')
    );
    
    if (!currentGameweek) {
      if (isGameweekManagementRoute) {
        // Let gameweek management routes handle the missing gameweek
        console.log(`⚠️ No active gameweek found, allowing ${req.path} to handle gameweek creation`);
        return next();
      }
      
      return res.status(404).json({ 
        error: "No active gameweek found",
        canModifyTeam: false,
        message: "Please wait while the current gameweek is being set up."
      });
    }

    const now = new Date();
    const deadline = new Date(currentGameweek.deadline);
    const isDeadlinePassed = now > deadline;
    const isGameweekCompleted = currentGameweek.isCompleted;

    // Allow admin to always access (but still log the deadline info)
    if (req.user?.isAdmin) {
      req.deadlineInfo = {
        gameweek: currentGameweek,
        isDeadlinePassed,
        isGameweekCompleted,
        canModifyTeam: true,
        message: "Admin access - deadline restrictions bypassed"
      };
      console.log(`Admin ${req.user.email} accessing ${req.method} ${req.path} - Deadline: ${isDeadlinePassed ? 'PASSED' : 'Active'}`);
      return next();
    }

    // Check if deadline has passed or gameweek is completed
    if (isDeadlinePassed || isGameweekCompleted) {
      req.deadlineInfo = {
        gameweek: currentGameweek,
        isDeadlinePassed,
        isGameweekCompleted,
        canModifyTeam: false,
        message: isGameweekCompleted 
          ? "Gameweek is completed - team modifications disabled"
          : "Deadline has passed - team modifications disabled until gameweek ends"
      };
      
      // Block ALL team modification routes after deadline
      const isTeamModificationRoute = (
        (req.path.includes('/api/team') && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) ||
        (req.path === '/api/team/save' && req.method === 'POST') ||
        (req.path === '/api/team/complete-registration' && req.method === 'POST')
      );
      
      if (isTeamModificationRoute) {
        console.log(`DEADLINE BLOCKED: User ${req.user?.email || 'anonymous'} tried to access ${req.method} ${req.path}`);
        console.log(`Deadline: ${deadline.toISOString()}, Current time: ${now.toISOString()}`);
        
        return res.status(403).json({
          error: req.deadlineInfo.message,
          deadline: deadline.toISOString(),
          currentTime: now.toISOString(),
          gameweekNumber: currentGameweek.gameweekNumber,
          isDeadlinePassed,
          isGameweekCompleted,
          hoursAfterDeadline: (now.getTime() - deadline.getTime()) / (1000 * 60 * 60),
          canOnlyViewLeaderboard: true,
          nextGameweekInfo: "New gameweek will start after current matches complete"
        });
      }
    } else {
      req.deadlineInfo = {
        gameweek: currentGameweek,
        isDeadlinePassed: false,
        isGameweekCompleted: false,
        canModifyTeam: true,
        message: "Team modifications allowed"
      };
      
      const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      console.log(`Deadline check: ${hoursUntilDeadline.toFixed(1)} hours remaining until deadline`);
    }

    next();
  } catch (error) {
    console.error('Deadline check middleware error:', error);
    res.status(500).json({ error: 'Failed to check deadline status' });
  }
}

// Middleware specifically for team routes that need deadline protection
export function requireActiveDeadline(req: Request, res: Response, next: NextFunction) {
  if (!req.deadlineInfo) {
    return res.status(500).json({ error: 'Deadline info not available' });
  }

  if (!req.deadlineInfo.canModifyTeam && !req.user?.isAdmin) {
    return res.status(403).json({
      error: req.deadlineInfo.message,
      deadline: req.deadlineInfo.gameweek.deadline,
      gameweekNumber: req.deadlineInfo.gameweek.gameweekNumber,
      isDeadlinePassed: req.deadlineInfo.isDeadlinePassed,
      isGameweekCompleted: req.deadlineInfo.isGameweekCompleted,
      canOnlyViewLeaderboard: true
    });
  }

  next();
}

// Add deadline info to Express Request interface
declare global {
  namespace Express {
    interface Request {
      deadlineInfo?: DeadlineCheckResult;
    }
  }
}
