import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { fplAPI } from "./fpl-api";
import { enhancedFplAPI } from "./enhanced-fpl-api";
import { hybridFplService } from "./hybrid-fpl-service";
import { apiUsageMonitor } from "./api-usage-monitor";
import { sessionManager } from "./enhanced-session-manager";
import { insertTeamSchema, insertPlayerSelectionSchema, users, teams, playerSelections, gameweekResults } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { eq } from "drizzle-orm";
import teamsRouter from "./routes/teams";

// Helper functions
function getPositionName(elementType: number): string {
  switch (elementType) {
    case 1: return "GKP";
    case 2: return "DEF";
    case 3: return "MID";
    case 4: return "FWD";
    default: return "UNK";
  }
}

function formatPrice(price: number): string {
  return (price / 10).toFixed(1);
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  
  // Register team management routes
  app.use("/api/teams", teamsRouter);

  // Hybrid FPL Data endpoints with automatic fallback between FPL API and API-Football
  app.get("/api/fpl/players", async (req, res) => {
    try {
      const players = await hybridFplService.getPlayers();
      const teams = await hybridFplService.getTeams();
      
      // Get current gameweek fixtures
      const currentGameweek = await hybridFplService.getCurrentGameweek();
      const fixtures = await hybridFplService.getFixtures(currentGameweek.id);
      
      // Add team information and injury status to players
      const playersWithTeams = players.map(player => {
        // Determine injury status based on FPL data
        let injuryStatus = 'available';
        let injuryInfo = '';
        
        if (player.status === 'i') {
          injuryStatus = 'injured';
          injuryInfo = 'Injured';
        } else if (player.status === 'd') {
          injuryStatus = 'doubtful';
          injuryInfo = 'Doubtful';
        } else if (player.status === 's') {
          injuryStatus = 'suspended';
          injuryInfo = 'Suspended';
        } else if (player.status === 'u') {
          injuryStatus = 'unavailable';
          injuryInfo = 'Unavailable';
        }
        
        // Add chance of playing info
        let chanceOfPlaying = null;
        if (player.chance_of_playing_this_round !== null) {
          chanceOfPlaying = player.chance_of_playing_this_round;
        } else if (player.chance_of_playing_next_round !== null) {
          chanceOfPlaying = player.chance_of_playing_next_round;
        }
        
        // Find next fixture for this player's team
        let nextOpponent = 'TBD';
        const teamFixtures = fixtures.filter(f => 
          (f.team_h === player.team || f.team_a === player.team) && !f.finished
        );
        
        if (teamFixtures.length > 0) {
          // Get the earliest upcoming fixture
          const nextFixture = teamFixtures.sort((a, b) => 
            new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
          )[0];
          
          if (nextFixture) {
            const isHome = nextFixture.team_h === player.team;
            const opponentTeam = teams.find(t => 
              t.id === (isHome ? nextFixture.team_a : nextFixture.team_h)
            );
            if (opponentTeam) {
              nextOpponent = `${opponentTeam.short_name}(${isHome ? 'H' : 'A'})`;
            }
          }
        }
        
        return {
          ...player,
          team_name: teams.find(t => t.id === player.team)?.name || "Unknown",
          team_short_name: teams.find(t => t.id === player.team)?.short_name || "UNK",
          position_name: getPositionName(player.element_type),
          price_formatted: formatPrice(player.now_cost),
          injury_status: injuryStatus,
          injury_info: injuryInfo,
          chance_of_playing: chanceOfPlaying,
          news_summary: player.news || '',
          is_available: injuryStatus === 'available',
          next_opponent: nextOpponent,
          // Add 1 million to the displayed price for all positions
          adjusted_price: (player.now_cost / 10) + 1,
          adjusted_price_formatted: `£${((player.now_cost / 10) + 1).toFixed(1)}m`
        };
      });
      
      res.json(playersWithTeams);
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ error: "Failed to fetch players" });
    }
  });

  app.get("/api/fpl/teams", async (req, res) => {
    try {
      // Use hybrid service with enhanced caching and rate limiting
      const teams = await hybridFplService.getTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  // Enhanced fixtures endpoint with hybrid service, rate limiting and intelligent caching
  app.get("/api/fpl/fixtures/:gameweek?", async (req, res) => {
    try {
      const gameweek = req.params.gameweek ? parseInt(req.params.gameweek) : undefined;
      
      // Use hybrid service with automatic fallback and enhanced caching
      const fixtures = await hybridFplService.getFixturesWithTeamNames(gameweek);
      
      // Add response headers for cache information
      const cacheStats = hybridFplService.getComprehensiveStatus();
      const currentSource = hybridFplService.getCurrentSource();
      
      res.set({
        'X-Data-Source': currentSource,
        'X-Cache-Status': fixtures.length > 0 ? 'HIT' : 'MISS',
        'X-Rate-Limit-Remaining': cacheStats.sources[currentSource]?.stats?.rateLimiting?.remainingRequests || 'unknown'
      });
      
      res.json(fixtures);
    } catch (error) {
      console.error("Error fetching fixtures:", error);
      res.status(500).json({ error: "Failed to fetch fixtures" });
    }
  });

  // Enhanced cache statistics endpoint for monitoring
  app.get("/api/fpl/cache-stats", async (req, res) => {
    try {
      const enhancedStats = enhancedFplAPI.getCacheStats();
      const legacyStats = fplAPI.getCacheStats();
      
      res.json({
        enhanced: enhancedStats,
        legacy: legacyStats,
        comparison: {
          enhancedCacheHits: enhancedStats.memory.totalHits + enhancedStats.persistent.totalHits,
          legacyCacheSize: legacyStats.cacheSize,
          enhancedQueueSize: enhancedStats.queue.size
        }
      });
    } catch (error) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({ error: "Failed to fetch cache stats" });
    }
  });
  
  // API Usage monitoring endpoints for Basic plan optimization
  app.get("/api/admin/usage-stats", sessionManager.requireAdmin(), async (req, res) => {
    try {
      const usageStats = apiUsageMonitor.getUsageStats();
      const cacheEfficiency = apiUsageMonitor.getCacheEfficiency();
      const quotaStatus = apiUsageMonitor.getQuotaStatus();
      
      res.json({
        usage: usageStats,
        cache: cacheEfficiency,
        quota: quotaStatus,
        recommendations: {
          upgrade: quotaStatus.projected.willExceed,
          cacheOptimization: cacheEfficiency.hitRate < 80,
          emergencyCaching: quotaStatus.monthly.percentUsed > 90
        }
      });
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ error: "Failed to fetch usage stats" });
    }
  });
  
  // Deadline traffic simulation endpoint
  app.post("/api/admin/simulate-deadline", sessionManager.requireAdmin(), async (req, res) => {
    try {
      const { userCount } = req.body;
      
      if (!userCount || userCount < 1 || userCount > 1000) {
        return res.status(400).json({ error: "User count must be between 1 and 1000" });
      }
      
      const simulation = apiUsageMonitor.simulateDeadlineTraffic(userCount);
      const currentQuota = apiUsageMonitor.getQuotaStatus();
      
      res.json({
        ...simulation,
        currentUsage: currentQuota,
        planRecommendation: simulation.willExceedQuota ? {
          action: 'upgrade',
          plan: 'Pro',
          reason: 'Basic plan insufficient for expected traffic'
        } : {
          action: 'optimize',
          strategies: ['pre-cache data', 'extend cache TTLs', 'enable emergency caching']
        }
      });
    } catch (error) {
      console.error("Error simulating deadline traffic:", error);
      res.status(500).json({ error: "Failed to simulate traffic" });
    }
  });
  
  // Emergency caching control
  app.post("/api/admin/emergency-caching", sessionManager.requireAdmin(), async (req, res) => {
    try {
      apiUsageMonitor.enableEmergencyCaching();
      
      res.json({
        message: "Emergency caching enabled",
        status: "All cache TTLs extended by 4x",
        reason: "Conserving API quota during high traffic"
      });
    } catch (error) {
      console.error("Error enabling emergency caching:", error);
      res.status(500).json({ error: "Failed to enable emergency caching" });
    }
  });
  
  // Session analytics endpoint for admin monitoring
  app.get("/api/admin/session-analytics", sessionManager.requireAdmin(), async (req, res) => {
    try {
      const analytics = sessionManager.getAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching session analytics:", error);
      res.status(500).json({ error: "Failed to fetch session analytics" });
    }
  });
  
  // Enhanced API monitoring endpoint with hybrid service status
  app.get("/api/admin/api-status", sessionManager.requireAdmin(), async (req, res) => {
    try {
      const hybridStatus = hybridFplService.getComprehensiveStatus();
      const sessionStats = sessionManager.getAnalytics();
      
      const status = {
        hybrid: hybridStatus,
        sessions: {
          active: sessionStats.activeSessions,
          total: sessionStats.totalSessions,
          unique: sessionStats.uniqueUsers,
          averageDuration: Math.round(sessionStats.averageSessionDuration / 1000 / 60), // minutes
          securityEvents: sessionStats.securityEvents.length
        },
        health: {
          status: hybridStatus.sources['fpl-official']?.status?.available || hybridStatus.sources['api-football']?.status?.available ? 'healthy' : 'degraded',
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      };
      
      res.json(status);
    } catch (error) {
      console.error("Error fetching API status:", error);
      res.status(500).json({ error: "Failed to fetch API status" });
    }
  });
  
  // Hybrid service control endpoints
  app.post("/api/admin/api/switch-source", sessionManager.requireAdmin(), async (req, res) => {
    try {
      const { source } = req.body;
      
      if (!['fpl-official', 'api-football'].includes(source)) {
        return res.status(400).json({ error: 'Invalid data source. Must be fpl-official or api-football' });
      }
      
      await hybridFplService.switchSource(source);
      res.json({ 
        message: `Successfully switched to ${source}`,
        currentSource: hybridFplService.getCurrentSource()
      });
    } catch (error) {
      console.error("Error switching data source:", error);
      res.status(500).json({ error: error.message || "Failed to switch data source" });
    }
  });
  
  app.get("/api/admin/api/source-status", sessionManager.requireAdmin(), async (req, res) => {
    try {
      const sourceStatus = Array.from(hybridFplService.getSourceStatus().entries()).map(([name, status]) => ({
        name,
        ...status,
        lastSuccessFormatted: new Date(status.lastSuccess).toISOString(),
        lastErrorFormatted: status.lastError ? new Date(status.lastError).toISOString() : null,
        nextAvailableFormatted: status.nextAvailable ? new Date(status.nextAvailable).toISOString() : null
      }));
      
      res.json({
        currentSource: hybridFplService.getCurrentSource(),
        sources: sourceStatus
      });
    } catch (error) {
      console.error("Error fetching source status:", error);
      res.status(500).json({ error: "Failed to fetch source status" });
    }
  });
  
  // API-Football specific endpoints
  app.get("/api/admin/api-football/status", sessionManager.requireAdmin(), async (req, res) => {
    try {
      const { apiFootballService } = await import('./api-football-service');
      const rateLimitStatus = apiFootballService.getRateLimitStatus();
      const cacheStats = apiFootballService.getCacheStats();
      
      res.json({
        rateLimits: rateLimitStatus,
        cache: cacheStats,
        configured: !!process.env.API_FOOTBALL_KEY
      });
    } catch (error) {
      console.error("Error fetching API-Football status:", error);
      res.status(500).json({ error: "Failed to fetch API-Football status" });
    }
  });

  // Admin endpoint to update gameweek deadlines
  app.post("/api/admin/update-deadlines", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.sendStatus(403);
    }

    try {
      const currentGameweek = await storage.getCurrentGameweek();
      if (!currentGameweek) {
        return res.status(404).json({ error: "No active gameweek found" });
      }

      // Update deadline based on current gameweek fixtures
      const deadline = await fplAPI.getGameweekDeadline(currentGameweek.gameweekNumber);
      await storage.updateGameweekDeadline(currentGameweek.id, new Date(deadline));

      res.json({ 
        message: "Deadline updated successfully",
        newDeadline: deadline,
        gameweek: currentGameweek.gameweekNumber
      });
    } catch (error) {
      console.error("Error updating deadlines:", error);
      res.status(500).json({ error: "Failed to update deadlines" });
    }
  });

  // Gameweek management
  app.get("/api/gameweek/current", async (req, res) => {
    try {
      let currentGameweek = await storage.getCurrentGameweek();
      
      if (!currentGameweek) {
        // Create first gameweek if none exists
        const fplGameweek = await fplAPI.getCurrentGameweek();
        const deadline = await fplAPI.getGameweekDeadline(fplGameweek.id);
        
        currentGameweek = await storage.createGameweek(fplGameweek.id, new Date(deadline));
      }
      
      res.json(currentGameweek);
    } catch (error) {
      console.error("Error fetching current gameweek:", error);
      res.status(500).json({ error: "Failed to fetch current gameweek" });
    }
  });

  // Team management
  app.get("/api/team/current", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const currentGameweek = await storage.getCurrentGameweek();
      if (!currentGameweek) {
        return res.status(404).json({ error: "No active gameweek" });
      }
      
      const team = await storage.getUserTeamForGameweek(req.user!.id, currentGameweek.id);
      if (!team) {
        return res.json(null);
      }
      
      const players = await storage.getTeamPlayers(team.id);
      res.json({ ...team, players });
    } catch (error) {
      console.error("Error fetching user team:", error);
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  app.post("/api/team", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Check if user has paid (unless admin)
      if (!req.user!.isAdmin && !req.user!.hasPaid) {
        return res.status(403).json({ error: "Payment required" });
      }
      
      const currentGameweek = await storage.getCurrentGameweek();
      if (!currentGameweek) {
        return res.status(404).json({ error: "No active gameweek" });
      }
      
      // Check if deadline has passed
      if (new Date() > currentGameweek.deadline) {
        return res.status(403).json({ error: "Gameweek deadline has passed" });
      }
      
      const teamData = insertTeamSchema.parse(req.body);
      
      // Validate team constraints
      if (teamData.players && teamData.players.length !== 11) {
        return res.status(400).json({ error: "Team must have exactly 11 players" });
      }
      
      // Validate budget constraint
      const players = await fplAPI.getPlayers();
      const selectedPlayers = players.filter((p: any) => teamData.players?.includes(p.id));
      const totalCost = selectedPlayers.reduce((sum: number, p: any) => sum + p.now_cost, 0);
      
      if (totalCost > 1000) { // 100.0m in API units
        return res.status(400).json({ error: "Team exceeds budget limit" });
      }
      
      // Validate max 3 players per team
      const teamCounts = new Map();
      selectedPlayers.forEach((player: any) => {
        const count = teamCounts.get(player.team) || 0;
        teamCounts.set(player.team, count + 1);
      });
      
      for (const [teamId, count] of Array.from(teamCounts.entries())) {
        if (count > 3) {
          return res.status(400).json({ error: "Maximum 3 players allowed from the same team" });
        }
      }
      
      // Check if user already has a team for this gameweek
      let team = await storage.getUserTeamForGameweek(req.user!.id, currentGameweek.id);
      
      if (team) {
        // Update existing team
        team = await storage.updateTeam(team.id, teamData);
      } else {
        // Create new team
        team = await storage.createTeam({
          ...teamData,
          userId: req.user!.id,
          gameweekId: currentGameweek.id,
        });
      }
      
      res.json(team);
    } catch (error) {
      console.error("Error saving team:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid team data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save team" });
    }
  });

  // Leaderboard
  app.get("/api/leaderboard/:gameweekId", async (req, res) => {
    try {
      const gameweekId = parseInt(req.params.gameweekId);
      if (isNaN(gameweekId)) {
        return res.status(400).json({ error: "Invalid gameweek ID" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const leaderboard = await storage.getGameweekLeaderboard(gameweekId, limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboard/previous-winners", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
      const winners = await storage.getPreviousGameweekWinners(limit);
      res.json(winners);
    } catch (error) {
      console.error("Error fetching previous winners:", error);
      res.status(500).json({ error: "Failed to fetch previous winners" });
    }
  });

  // Payment processing
  app.post("/api/payment/confirm", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { paymentId, amount } = req.body;
      
      // In production, verify payment with payment gateway
      // For now, we'll accept any paymentId as valid
      if (!paymentId || amount !== 20) {
        return res.status(400).json({ error: "Invalid payment details" });
      }
      
      await storage.updateUserPayment(req.user!.id, paymentId);
      res.json({ success: true, message: "Payment confirmed successfully" });
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  app.post("/api/payment/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { paymentId } = req.body;
      
      // In production, verify payment with Razorpay
      // For now, we'll accept any paymentId as valid
      if (!paymentId) {
        return res.status(400).json({ error: "Payment ID required" });
      }
      
      await storage.updateUserPayment(req.user!.id, paymentId);
      res.json({ success: true, message: "Payment verified successfully" });
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // User Profile endpoints
  app.get("/api/user/gameweek-history", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userTeams = await storage.getUserTeams(req.user!.id);
      
      const gameweekHistory = await Promise.all(
        userTeams.map(async (team) => {
          const gameweek = await storage.getGameweek(team.gameweekId);
          const leaderboard = await storage.getGameweekLeaderboard(team.gameweekId, 1000);
          const userResult = leaderboard.find(result => result.teamId === team.id);
          
          return {
            id: team.id,
            gameweekNumber: gameweek?.gameweekNumber || 0,
            teamName: team.teamName,
            points: team.totalPoints || 0,
            rank: userResult?.rank || 0,
            totalParticipants: leaderboard.length,
            hasPaid: req.user!.hasPaid,
            createdAt: team.createdAt
          };
        })
      );
      
      res.json(gameweekHistory.sort((a, b) => b.gameweekNumber - a.gameweekNumber));
    } catch (error) {
      console.error("Error fetching user gameweek history:", error);
      res.status(500).json({ error: "Failed to fetch gameweek history" });
    }
  });

  app.get("/api/user/payment-history", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // For now, we'll create mock payment history based on user teams
      // In a real implementation, you'd have a payments table
      const userTeams = await storage.getUserTeams(req.user!.id);
      
      const paymentHistory = await Promise.all(
        userTeams.map(async (team, index) => {
          const gameweek = await storage.getGameweek(team.gameweekId);
          
          return {
            id: team.id,
            gameweekNumber: gameweek?.gameweekNumber || 0,
            amount: 20,
            status: req.user!.hasPaid ? "success" : "pending",
            paymentMethod: "Razorpay",
            transactionId: req.user!.paymentId || `TXN${team.id}${Date.now()}`,
            createdAt: team.createdAt
          };
        })
      );
      
      res.json(paymentHistory.sort((a, b) => b.gameweekNumber - a.gameweekNumber));
    } catch (error) {
      console.error("Error fetching user payment history:", error);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  });

  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { name, phone } = req.body;
      
      if (!name || !phone) {
        return res.status(400).json({ error: "Name and phone are required" });
      }
      
      await db
        .update(users)
        .set({ name, phone })
        .where(eq(users.id, req.user!.id));
        
      const updatedUser = await storage.getUser(req.user!.id);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.delete("/api/user/account", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userId = req.user!.id;
      
      // Delete user's teams and player selections
      const userTeams = await storage.getUserTeams(userId);
      
      for (const team of userTeams) {
        // Delete player selections for each team
        await db
          .delete(playerSelections)
          .where(eq(playerSelections.teamId, team.id));
      }
      
      // Delete user's teams
      await db
        .delete(teams)
        .where(eq(teams.userId, userId));
      
      // Delete gameweek results
      await db
        .delete(gameweekResults)
        .where(eq(gameweekResults.userId, userId));
      
      // Finally, delete the user account
      await db
        .delete(users)
        .where(eq(users.id, userId));
        
      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Admin endpoints
  app.get("/api/admin/teams", async (req, res) => {
    if (!req.isAuthenticated() || !req.user!.isAdmin) {
      return res.sendStatus(403);
    }
    
    try {
      const gameweekId = req.query.gameweek ? parseInt(req.query.gameweek as string) : null;
      
      let teams;
      if (gameweekId) {
        teams = await storage.getTeamsForGameweek(gameweekId);
      } else {
        teams = await storage.getAllTeams();
      }
      
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams for admin:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || !req.user!.isAdmin) {
      return res.sendStatus(403);
    }
    
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users for admin:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/teams/:id/lock", async (req, res) => {
    if (!req.isAuthenticated() || !req.user!.isAdmin) {
      return res.sendStatus(403);
    }
    
    try {
      const teamId = parseInt(req.params.id);
      const { isLocked } = req.body;
      
      await storage.updateTeamLockStatus(teamId, isLocked);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating team lock status:", error);
      res.status(500).json({ error: "Failed to update team lock status" });
    }
  });

  app.post("/api/admin/gameweek/:gameweekId/complete", async (req, res) => {
    if (!req.isAuthenticated() || !req.user!.isAdmin) {
      return res.sendStatus(403);
    }
    
    try {
      const gameweekId = parseInt(req.params.gameweekId);
      await storage.updateGameweekStatus(gameweekId, true);
      
      // TODO: Calculate and store gameweek results using live FPL data
      res.json({ success: true });
    } catch (error) {
      console.error("Error completing gameweek:", error);
      res.status(500).json({ error: "Failed to complete gameweek" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
