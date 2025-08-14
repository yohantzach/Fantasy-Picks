import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { fplAPI } from "./fpl-api";
import { enhancedFplAPI } from "./enhanced-fpl-api";
import { hybridFplService } from "./hybrid-fpl-service";
import { apiUsageMonitor } from "./api-usage-monitor";
import { sessionManager } from "./enhanced-session-manager";
import { checkDeadlineMiddleware, requireActiveDeadline } from "./deadline-middleware";
import { fplScoringService } from "./fpl-scoring-service";
import { insertTeamSchema, insertPlayerSelectionSchema, users, teams, playerSelections, gameweekResults, paymentProofs, gameweeks } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import teamsRouter from "./routes/teams";
import paymentRouter from "./src/routes/payment";

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
  
  // Add cookie parser middleware for payment routes
  app.use(cookieParser());
  
  // Add deadline checking middleware for all routes
  app.use(checkDeadlineMiddleware);
  
  // Start FPL scoring service
  fplScoringService.startAutoScoring();
  
  // Register specific /api/teams/user route before the generic teams router
  // This must come BEFORE the teams router to prevent conflicts
  
  // Get all user teams for current gameweek
  app.get("/api/teams/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("❌ [TEAMS/USER] User not authenticated");
      return res.sendStatus(401);
    }
    
    try {
      const currentGameweek = await storage.getCurrentGameweek();
      console.log("🔍 [TEAMS/USER] Current gameweek:", currentGameweek);
      
      if (!currentGameweek) {
        console.log("❌ [TEAMS/USER] No active gameweek found");
        return res.status(404).json({ error: "No active gameweek" });
      }
      
      const userId = req.user!.id;
      console.log("🔍 [TEAMS/USER] User ID:", userId, "Gameweek ID:", currentGameweek.id);
      
      const userTeams = await storage.getUserTeamsForGameweek(userId, currentGameweek.id);
      console.log("🔍 [TEAMS/USER] Raw user teams from storage:", JSON.stringify(userTeams, null, 2));
      
      if (userTeams.length === 0) {
        console.log("⚠️ [TEAMS/USER] No teams found for user", userId, "in gameweek", currentGameweek.id);
        console.log("⚠️ [TEAMS/USER] Returning empty array");
        return res.json([]);
      }
      
      // Get payment status for each team
      const teamsWithPaymentStatus = await Promise.all(
        userTeams.map(async (team) => {
          console.log("🔍 [TEAMS/USER] Processing team:", team.id, "team number:", team.teamNumber);
          
          const paymentStatus = await db
            .select()
            .from(paymentProofs)
            .where(
              and(
                eq(paymentProofs.userId, userId),
                eq(paymentProofs.gameweekId, currentGameweek.id),
                eq(paymentProofs.teamNumber, team.teamNumber)
              )
            )
            .orderBy(paymentProofs.submittedAt)
            .limit(1);
          
          console.log("🔍 [TEAMS/USER] Payment status query result:", paymentStatus);
          
          const payment = paymentStatus[0];
          const teamWithStatus = {
            ...team,
            paymentStatus: payment?.status || 'not_submitted',
            canEdit: payment?.status === 'approved' && new Date() <= currentGameweek.deadline,
            pendingPayment: payment?.status === 'pending'
          };
          
          console.log("🔍 [TEAMS/USER] Final team with status:", JSON.stringify(teamWithStatus, null, 2));
          return teamWithStatus;
        })
      );
      
      console.log("✅ [TEAMS/USER] Final response:", JSON.stringify(teamsWithPaymentStatus, null, 2));
      res.json(teamsWithPaymentStatus);
    } catch (error) {
      console.error("❌ [TEAMS/USER] Error fetching user teams:", error);
      console.error("❌ [TEAMS/USER] Stack trace:", error instanceof Error ? error.stack : error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });
  
  // Register payment routes for manual payment system
  app.use("/api/payment", paymentRouter);
  
  // Register team management routes (this will handle /api/teams/:id and other team routes)
  app.use("/api/teams", teamsRouter);
  

  // Hybrid FPL Data endpoints with automatic fallback between FPL API and API-Football
  app.get("/api/fpl/players", async (req, res) => {
    try {
      const players = await hybridFplService.getPlayers();
      const teams = await hybridFplService.getTeams();
      
      // Get current gameweek fixtures with enhanced error handling
      let fixtures = [];
      let currentGameweek = null;
      
      try {
        currentGameweek = await hybridFplService.getCurrentGameweek();
        console.log(`📊 Current gameweek: ${currentGameweek.id}`);
        
        // Use direct FPL API call for fixtures to ensure reliability
        const fixturesResponse = await fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${currentGameweek.id}`);
        fixtures = await fixturesResponse.json();
        console.log(`⚽ Fetched ${fixtures.length} fixtures from FPL API for gameweek ${currentGameweek.id}`);
        
        // Debug: Log fixture structure for first few fixtures
        if (fixtures.length > 0) {
          console.log('🔍 Sample fixture structure:', JSON.stringify(fixtures.slice(0, 2), null, 2));
          console.log(`🏠 Sample fixture team_h values:`, fixtures.slice(0, 5).map(f => ({ id: f.id, team_h: f.team_h, team_a: f.team_a, finished: f.finished })));
        } else {
          console.log('⚠️ No fixtures found for current gameweek, trying all fixtures...');
          // Fallback: get all fixtures if gameweek-specific ones are not available
          const allFixturesResponse = await fetch('https://fantasy.premierleague.com/api/fixtures/');
          const allFixtures = await allFixturesResponse.json();
          fixtures = allFixtures.filter(f => !f.finished && f.event === currentGameweek.id);
          console.log(`⚽ Found ${fixtures.length} upcoming fixtures from all fixtures`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch fixtures from FPL API, players will show TBD:', error.message);
        fixtures = [];
      }
      
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
        
        try {
          if (fixtures && fixtures.length > 0) {
            const teamFixtures = fixtures.filter(f => {
              // More flexible fixture matching
              const isPlayerTeamHome = f.team_h === player.team || f.team_h_id === player.team;
              const isPlayerTeamAway = f.team_a === player.team || f.team_a_id === player.team;
              const isFinished = f.finished || f.finished_provisional;
              
              return (isPlayerTeamHome || isPlayerTeamAway) && !isFinished;
            });
            
            // Debug logging for the first player to help diagnose fixture issues
            if (player.web_name === 'Haaland' || player.web_name === 'Isak') {
              console.log(`🔍 Debug fixture for ${player.web_name} (Team ID: ${player.team})`);
              console.log(`📊 Total fixtures: ${fixtures.length}`);
              console.log(`⚽ Team fixtures found: ${teamFixtures.length}`);
              if (teamFixtures.length > 0) {
                console.log(`🎯 Next fixture:`, JSON.stringify(teamFixtures[0], null, 2));
              }
            }
            
            if (teamFixtures.length > 0) {
              // Get the earliest upcoming fixture
              const nextFixture = teamFixtures.sort((a, b) => {
                const dateA = new Date(a.kickoff_time || a.kickoff_time_utc).getTime();
                const dateB = new Date(b.kickoff_time || b.kickoff_time_utc).getTime();
                return dateA - dateB;
              })[0];
              
              if (nextFixture) {
                const isHome = (nextFixture.team_h === player.team || nextFixture.team_h_id === player.team);
                const opponentId = isHome ? (nextFixture.team_a || nextFixture.team_a_id) : (nextFixture.team_h || nextFixture.team_h_id);
                const opponentTeam = teams.find(t => t.id === opponentId);
                
                if (opponentTeam) {
                  nextOpponent = `${opponentTeam.short_name}(${isHome ? 'H' : 'A'})`;
                } else {
                  // Fallback to team names from fixture if available
                  if (nextFixture.team_h_short && nextFixture.team_a_short) {
                    nextOpponent = isHome 
                      ? `${nextFixture.team_a_short}(H)` 
                      : `${nextFixture.team_h_short}(A)`;
                  }
                }
              }
            }
          } else {
            // Log when no fixtures are available
            if (player.web_name === 'Haaland' || player.web_name === 'Isak') {
              console.log(`⚠️ No fixtures available for ${player.web_name} - this is why TBD is showing`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error processing fixture for player ${player.web_name}:`, error.message);
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
      let currentGameweek = await storage.getCurrentGameweek();
      const now = new Date();
      
      // Use the same real-time logic as /api/gameweek/current
      let latestFplGameweek;
      let latestDeadline;
      
      try {
        console.log('🔄 [ADMIN] Fetching latest gameweek data for deadline update...');
        latestFplGameweek = await hybridFplService.getCurrentGameweek();
        
        // Get the actual deadline from FPL - this is 2 hours before first match
        const fixtures = await hybridFplService.getFixtures(latestFplGameweek.id);
        const upcomingFixtures = fixtures
          .filter(f => !f.finished && f.event === latestFplGameweek.id)
          .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
        
        if (upcomingFixtures.length > 0) {
          // Set deadline to 2 hours before first match of the gameweek
          const firstMatchTime = new Date(upcomingFixtures[0].kickoff_time);
          latestDeadline = new Date(firstMatchTime.getTime() - (2 * 60 * 60 * 1000)); // 2 hours before
          console.log(`⏰ [ADMIN] Real deadline: ${latestDeadline.toISOString()} (2h before first match: ${firstMatchTime.toISOString()})`);
        } else {
          // Fallback to FPL's deadline if no fixtures found
          latestDeadline = new Date(latestFplGameweek.deadline_time);
          console.log(`⏰ [ADMIN] Using FPL deadline: ${latestDeadline.toISOString()}`);
        }
      } catch (fplError) {
        console.warn('⚠️ [ADMIN] Failed to fetch latest FPL data:', fplError.message);
        // If we can't get latest data, try to update existing gameweek with FPL API
        if (currentGameweek) {
          const deadline = await fplAPI.getGameweekDeadline(currentGameweek.gameweekNumber);
          await storage.updateGameweekDeadline(currentGameweek.id, new Date(deadline));
          return res.json({
            message: "Deadline updated using fallback FPL API",
            newDeadline: deadline,
            gameweek: currentGameweek.gameweekNumber,
            source: "fpl-api-fallback"
          });
        } else {
          return res.status(404).json({ error: "No active gameweek found and cannot fetch FPL data" });
        }
      }
      
      let updatedGameweek;
      let updateMessage = "";
      
      // Check if we need to create or update gameweek (same logic as gameweek/current)
      if (!currentGameweek) {
        if (latestFplGameweek && latestDeadline) {
          console.log('🆕 [ADMIN] Creating new gameweek from real-time data...');
          updatedGameweek = await storage.createGameweek(latestFplGameweek.id, latestDeadline);
          updateMessage = `Created new gameweek ${latestFplGameweek.id} with real-time deadline`;
        } else {
          return res.status(404).json({ error: "No active gameweek found and cannot create from FPL data" });
        }
      } else if (latestFplGameweek && latestDeadline) {
        // Update existing gameweek if FPL data is different
        const currentDeadlineTime = new Date(currentGameweek.deadline).getTime();
        const latestDeadlineTime = latestDeadline.getTime();
        const gameweekNumberChanged = currentGameweek.gameweekNumber !== latestFplGameweek.id;
        const deadlineChanged = Math.abs(currentDeadlineTime - latestDeadlineTime) > 60000; // More than 1 minute difference
        
        if (gameweekNumberChanged) {
          console.log(`🔄 [ADMIN] Gameweek changed from ${currentGameweek.gameweekNumber} to ${latestFplGameweek.id}`);
          // Mark current gameweek as completed and create new one
          await storage.updateGameweekStatus(currentGameweek.id, true);
          updatedGameweek = await storage.createGameweek(latestFplGameweek.id, latestDeadline);
          updateMessage = `Gameweek transition: completed GW${currentGameweek.gameweekNumber}, created GW${latestFplGameweek.id} with real-time deadline`;
        } else if (deadlineChanged) {
          console.log(`⏰ [ADMIN] Deadline updated for GW${currentGameweek.gameweekNumber}`);
          await storage.updateGameweekDeadline(currentGameweek.id, latestDeadline);
          updatedGameweek = { ...currentGameweek, deadline: latestDeadline };
          updateMessage = `Updated deadline for GW${currentGameweek.gameweekNumber} with real-time data`;
        } else {
          updatedGameweek = currentGameweek;
          updateMessage = `No updates needed - GW${currentGameweek.gameweekNumber} deadline is already current`;
        }
      }
      
      // Calculate response data
      const deadline = new Date(updatedGameweek.deadline);
      const canModifyTeam = now <= deadline && !updatedGameweek.isCompleted;
      const timeUntilDeadline = Math.max(0, deadline.getTime() - now.getTime());
      const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
      
      res.json({ 
        message: updateMessage,
        gameweek: {
          id: updatedGameweek.id,
          gameweekNumber: updatedGameweek.gameweekNumber,
          deadline: deadline.toISOString(),
          isCompleted: updatedGameweek.isCompleted,
          canModifyTeam,
          hoursUntilDeadline: hoursUntilDeadline.toFixed(1)
        },
        source: "hybrid-fpl-service",
        updatedAt: now.toISOString()
      });
    } catch (error) {
      console.error("❌ [ADMIN] Error updating deadlines:", error);
      res.status(500).json({ error: "Failed to update deadlines", details: error.message });
    }
  });

  // Gameweek management with real-time FPL data
  app.get("/api/gameweek/current", async (req, res) => {
    try {
      let currentGameweek = await storage.getCurrentGameweek();
      const now = new Date();
      
      // Always try to get fresh FPL data first
      let latestFplGameweek;
      let latestDeadline;
      
      try {
        console.log('🔄 Fetching latest gameweek data from FPL API...');
        latestFplGameweek = await hybridFplService.getCurrentGameweek();
        
        // Get the actual deadline from FPL - this is 2 hours before first match
        const fixtures = await hybridFplService.getFixtures(latestFplGameweek.id);
        const upcomingFixtures = fixtures
          .filter(f => !f.finished && f.event === latestFplGameweek.id)
          .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
        
        if (upcomingFixtures.length > 0) {
          // Set deadline to 2 hours before first match of the gameweek
          const firstMatchTime = new Date(upcomingFixtures[0].kickoff_time);
          latestDeadline = new Date(firstMatchTime.getTime() - (2 * 60 * 60 * 1000)); // 2 hours before
          console.log(`⏰ Real deadline: ${latestDeadline.toISOString()} (2h before first match: ${firstMatchTime.toISOString()})`);
        } else {
          // Fallback to FPL's deadline if no fixtures found
          latestDeadline = new Date(latestFplGameweek.deadline_time);
          console.log(`⏰ Using FPL deadline: ${latestDeadline.toISOString()}`);
        }
      } catch (fplError) {
        console.warn('⚠️ Failed to fetch latest FPL data:', fplError.message);
      }
      
      // Check if we need to create or update gameweek
      if (!currentGameweek) {
        if (latestFplGameweek && latestDeadline) {
          console.log('🆕 Creating new gameweek from RapidAPI hybrid data...');
          currentGameweek = await storage.createGameweek(latestFplGameweek.id, latestDeadline);
        } else {
          // Emergency fallback - use current date logic for mid-season
          console.log('🚨 Creating emergency gameweek with current date logic...');
          const now = new Date();
          const currentMonth = now.getMonth() + 1; // 1-based month
          const currentDay = now.getDate();
          
          // Determine likely gameweek based on current date (rough estimation)
          let estimatedGameweek = 1;
          let fallbackDeadline = new Date();
          
          if (currentMonth >= 8) {
            // Season has started - estimate gameweek
            if (currentMonth === 8) {
              estimatedGameweek = Math.min(4, Math.max(1, Math.floor(currentDay / 7)));
            } else if (currentMonth >= 9 && currentMonth <= 12) {
              estimatedGameweek = 4 + ((currentMonth - 9) * 4) + Math.floor(currentDay / 7);
            } else if (currentMonth >= 1 && currentMonth <= 5) {
              estimatedGameweek = 20 + ((currentMonth - 1) * 4) + Math.floor(currentDay / 7);
            }
          }
          
          // Set deadline to next Saturday 11:30 AM (typical PL kickoff)
          fallbackDeadline = new Date();
          const daysUntilSaturday = (6 - fallbackDeadline.getDay() + 7) % 7 || 7;
          fallbackDeadline.setDate(fallbackDeadline.getDate() + daysUntilSaturday);
          fallbackDeadline.setHours(9, 30, 0, 0); // 11:30 AM is 09:30 UTC (roughly)
          
          console.log(`📅 Estimated GW${estimatedGameweek} with deadline: ${fallbackDeadline.toISOString()}`);
          currentGameweek = await storage.createGameweek(estimatedGameweek, fallbackDeadline);
        }
      } else if (latestFplGameweek && latestDeadline) {
        // Update existing gameweek if FPL data is different (deadline may have changed)
        const currentDeadlineTime = new Date(currentGameweek.deadline).getTime();
        const latestDeadlineTime = latestDeadline.getTime();
        const gameweekNumberChanged = currentGameweek.gameweekNumber !== latestFplGameweek.id;
        const deadlineChanged = Math.abs(currentDeadlineTime - latestDeadlineTime) > 60000; // More than 1 minute difference
        
        if (gameweekNumberChanged) {
          console.log(`🔄 Gameweek changed from ${currentGameweek.gameweekNumber} to ${latestFplGameweek.id}`);
          // Mark current gameweek as completed and create new one
          await storage.updateGameweekStatus(currentGameweek.id, true);
          currentGameweek = await storage.createGameweek(latestFplGameweek.id, latestDeadline);
        } else if (deadlineChanged) {
          console.log(`⏰ Deadline updated for GW${currentGameweek.gameweekNumber}`);
          await storage.updateGameweekDeadline(currentGameweek.id, latestDeadline);
          currentGameweek = { ...currentGameweek, deadline: latestDeadline };
        }
      }
      
      // Check if gameweek should be completed (deadline passed + matches started)
      const deadlineTime = new Date(currentGameweek.deadline);
      const isDeadlinePassed = now > deadlineTime;
      
      if (isDeadlinePassed && !currentGameweek.isCompleted) {
        // Check if matches have actually started by checking fixtures
        try {
          const fixtures = await hybridFplService.getFixtures(currentGameweek.gameweekNumber);
          const anyMatchStarted = fixtures.some(f => 
            f.event === currentGameweek.gameweekNumber && 
            (f.started || f.finished)
          );
          
          if (anyMatchStarted) {
            console.log(`⚽ GW${currentGameweek.gameweekNumber} matches started - marking as completed`);
            await storage.updateGameweekStatus(currentGameweek.id, true);
            currentGameweek = { ...currentGameweek, isCompleted: true };
          }
        } catch (error) {
          console.warn('Could not check match status:', error.message);
        }
      }
      
      // Calculate response data
      const canModifyTeam = now <= deadlineTime && !currentGameweek.isCompleted;
      const timeUntilDeadline = Math.max(0, deadlineTime.getTime() - now.getTime());
      
      const response = {
        ...currentGameweek,
        canModifyTeam,
        timeUntilDeadline,
        deadlineFormatted: deadlineTime.toISOString(),
        hoursUntilDeadline: timeUntilDeadline / (1000 * 60 * 60),
        isLive: latestFplGameweek ? true : false,
        lastUpdated: now.toISOString()
      };
      
      console.log(`📊 GW${response.gameweekNumber}: ${response.hoursUntilDeadline.toFixed(1)}h until deadline (${canModifyTeam ? 'OPEN' : 'CLOSED'})`);
      
      res.json(response);
    } catch (error) {
      console.error("❌ Error in gameweek endpoint:", error);
      
      // Final emergency fallback
      const emergencyDeadline = new Date('2024-08-17T10:30:00.000Z'); // GW1 2024/25
      const now = new Date();
      
      res.json({
        id: 1,
        gameweekNumber: 1,
        deadline: emergencyDeadline.toISOString(),
        isActive: true,
        isCompleted: false,
        canModifyTeam: now <= emergencyDeadline,
        timeUntilDeadline: Math.max(0, emergencyDeadline.getTime() - now.getTime()),
        deadlineFormatted: emergencyDeadline.toISOString(),
        hoursUntilDeadline: Math.max(0, (emergencyDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)),
        isLive: false,
        error: "Using emergency fallback data - check FPL API connection",
        lastUpdated: now.toISOString()
      });
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
      
      // Get first team for current gameweek (for backward compatibility)
      const userTeams = await storage.getUserTeamsForGameweek(req.user!.id, currentGameweek.id);
      const team = userTeams.length > 0 ? userTeams[0] : null;
      
      if (!team) {
        return res.json(null);
      }
      
      // Check payment status for this team
      const paymentStatus = await db
        .select()
        .from(paymentProofs)
        .where(
          and(
            eq(paymentProofs.userId, req.user!.id),
            eq(paymentProofs.gameweekId, currentGameweek.id),
            eq(paymentProofs.teamNumber, team.teamNumber),
            eq(paymentProofs.status, 'approved')
          )
        )
        .limit(1);
      
      // Return the player IDs directly from the team.players field
      res.json({ 
        ...team, 
        players: team.players || [], // This is already an array of player IDs
        canEdit: paymentStatus.length > 0 && new Date() <= currentGameweek.deadline,
        paymentStatus: paymentStatus.length > 0 ? 'approved' : 'pending'
      });
    } catch (error) {
      console.error("Error fetching user team:", error);
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });
  
  // Get specific team by team number
  app.get("/api/team/:teamNumber", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const teamNumber = parseInt(req.params.teamNumber);
      const currentGameweek = await storage.getCurrentGameweek();
      if (!currentGameweek) {
        return res.status(404).json({ error: "No active gameweek" });
      }
      
      const team = await db
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.userId, req.user!.id),
            eq(teams.gameweekId, currentGameweek.id),
            eq(teams.teamNumber, teamNumber)
          )
        )
        .limit(1);
      
      if (team.length === 0) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Check payment status
      const paymentStatus = await db
        .select()
        .from(paymentProofs)
        .where(
          and(
            eq(paymentProofs.userId, req.user!.id),
            eq(paymentProofs.gameweekId, currentGameweek.id),
            eq(paymentProofs.teamNumber, teamNumber)
          )
        )
        .limit(1);
      
      // Return the player IDs directly from the team.players field
      res.json({ 
        ...team[0], 
        players: team[0].players || [], // This is already an array of player IDs
        canEdit: paymentStatus.length > 0 && paymentStatus[0].status === 'approved' && new Date() <= currentGameweek.deadline,
        paymentStatus: paymentStatus.length > 0 ? paymentStatus[0].status : 'not_submitted'
      });
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  // Team save endpoint - saves team to DB BEFORE payment approval
  app.post("/api/team/save", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const currentGameweek = await storage.getCurrentGameweek();
      if (!currentGameweek) {
        return res.status(404).json({ error: "No active gameweek" });
      }

      // COMPREHENSIVE DEADLINE CHECK (admins are exempt)
      const now = new Date();
      const deadline = new Date(currentGameweek.deadline);
      const isDeadlinePassed = now > deadline;
      const isGameweekCompleted = currentGameweek.isCompleted;
      
      if (!req.user!.isAdmin && (isDeadlinePassed || isGameweekCompleted)) {
        console.log(`TEAM SAVE BLOCKED: Non-admin user ${req.user!.email} tried to save team after deadline`);
        console.log(`Deadline: ${deadline.toISOString()}, Current time: ${now.toISOString()}`);
        
        return res.status(403).json({ 
          error: isGameweekCompleted 
            ? "Gameweek is completed - no more team changes allowed" 
            : "Deadline has passed - team creation/editing is now closed",
          deadline: deadline.toISOString(),
          currentTime: now.toISOString(),
          gameweekNumber: currentGameweek.gameweekNumber,
          isDeadlinePassed,
          isGameweekCompleted,
          hoursAfterDeadline: (now.getTime() - deadline.getTime()) / (1000 * 60 * 60),
          message: "You can still view the leaderboard to see results once matches are completed"
        });
      }
      
      if (req.user!.isAdmin && (isDeadlinePassed || isGameweekCompleted)) {
        console.log(`ADMIN OVERRIDE: ${req.user!.email} saving team after deadline - allowed for admin`);
      }
      
      // Extract team data and additional fields separately
      const { teamNumber, ...teamFields } = req.body;
      const teamData = insertTeamSchema.parse(teamFields);
      
      // Validate team constraints
      if (teamData.players && teamData.players.length !== 11) {
        return res.status(400).json({ error: "Team must have exactly 11 players" });
      }
      
      // Validate budget constraint using hybrid service (with fallback)
      let players;
      try {
        players = await hybridFplService.getPlayers();
      } catch (error) {
        console.warn("Failed to fetch players for validation, skipping budget validation:", error);
        // Continue without budget validation if API fails
        players = [];
      }
      
      if (players && players.length > 0) {
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
      }
      
      // Determine team number for this user in this gameweek
      const existingTeams = await storage.getUserTeamsForGameweek(req.user!.id, currentGameweek.id);
      const nextTeamNumber = teamNumber || (existingTeams.length + 1);
      
      // **CRITICAL: Check if this is an edit to any approved team**
      // Get all user's approved payments for this gameweek
      const allApprovedPayments = await db
        .select()
        .from(paymentProofs)
        .where(
          and(
            eq(paymentProofs.userId, req.user!.id),
            eq(paymentProofs.gameweekId, currentGameweek.id),
            eq(paymentProofs.status, 'approved')
          )
        )
        .orderBy(paymentProofs.teamNumber);
      
      // Check if user is trying to edit ANY team they have approved payment for
      const approvedTeamNumbers = allApprovedPayments.map(p => p.teamNumber);
      const isEditingApprovedTeam = teamNumber && approvedTeamNumbers.includes(teamNumber);
      
      if (isEditingApprovedTeam) {
        // User is editing their approved team - allow updates
        const existingTeam = await db
          .select()
          .from(teams)
          .where(
            and(
              eq(teams.userId, req.user!.id),
              eq(teams.gameweekId, currentGameweek.id),
              eq(teams.teamNumber, teamNumber)
            )
          )
          .limit(1);
        
        if (existingTeam.length > 0) {
          // Update existing approved team
          const [updatedTeam] = await db
            .update(teams)
            .set({
              ...teamData,
              teamNumber: teamNumber
            })
            .where(eq(teams.id, existingTeam[0].id))
            .returning();
            
          return res.json({
            success: true,
            team: updatedTeam,
            message: "Team updated successfully!"
          });
        }
      }
      
      // **CRITICAL: For new teams, ALWAYS save to DB first, then redirect to payment**
      // Check if team already exists (for this team number)
      const existingTeam = await db
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.userId, req.user!.id),
            eq(teams.gameweekId, currentGameweek.id),
            eq(teams.teamNumber, nextTeamNumber)
          )
        )
        .limit(1);
      
      let savedTeam;
      if (existingTeam.length > 0) {
        // Update existing team
        const [updatedTeam] = await db
          .update(teams)
          .set({
            ...teamData,
            teamNumber: nextTeamNumber
          })
          .where(eq(teams.id, existingTeam[0].id))
          .returning();
        savedTeam = updatedTeam;
      } else {
        // Create new team in DB BEFORE payment
        const [newTeam] = await db
          .insert(teams)
          .values({
            ...teamData,
            userId: req.user!.id,
            gameweekId: currentGameweek.id,
            teamNumber: nextTeamNumber,
            isActive: false // Team is inactive until payment is approved
          })
          .returning();
        savedTeam = newTeam;
      }
      
      // Check if payment already exists for this team
      console.log(`Checking payment for user ${req.user!.id}, gameweek ${currentGameweek.id}, team ${nextTeamNumber}`);
      const existingPaymentProof = await db
        .select()
        .from(paymentProofs)
        .where(
          and(
            eq(paymentProofs.userId, req.user!.id),
            eq(paymentProofs.gameweekId, currentGameweek.id),
            eq(paymentProofs.teamNumber, nextTeamNumber)
          )
        )
        .limit(1);
      
      console.log("Existing payment proof:", existingPaymentProof);
      
      if (existingPaymentProof.length > 0) {
        const proof = existingPaymentProof[0];
        if (proof.status === 'approved') {
          // Payment already approved, activate team
          await db
            .update(teams)
            .set({ isActive: true })
            .where(eq(teams.id, savedTeam.id));
            
          return res.json({
            success: true,
            team: { ...savedTeam, isActive: true },
            message: "Team saved successfully!"
          });
        } else if (proof.status === 'pending') {
          return res.json({
            success: true,
            team: savedTeam,
            message: "Team saved! Payment is pending admin approval.",
            paymentStatus: 'pending'
          });
        } else if (proof.status === 'rejected') {
          // Payment was rejected, redirect to payment again
          return res.json({ 
            success: true,
            requiresPayment: true,
            redirectTo: `/manual-payment?gameweek=${currentGameweek.id}&team=${nextTeamNumber}`,
            message: "Team saved. Previous payment was rejected - please submit payment again.",
            gameweekId: currentGameweek.id,
            teamNumber: nextTeamNumber,
            teamId: savedTeam.id,
            amount: 20
          });
        }
      }
      
      // No payment proof exists, redirect to payment
      res.json({ 
        success: true,
        requiresPayment: true,
        redirectTo: `/manual-payment?gameweek=${currentGameweek.id}&team=${nextTeamNumber}`,
        message: "Team saved successfully! Please complete payment to activate your team.",
        gameweekId: currentGameweek.id,
        teamNumber: nextTeamNumber,
        teamId: savedTeam.id,
        amount: 20
      });
    } catch (error) {
      console.error("Error saving team:", error);
      console.error("Request body:", req.body);
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
      
      if (error instanceof z.ZodError) {
        console.error("Zod validation errors:", error.errors);
        return res.status(400).json({ error: "Invalid team data", details: error.errors });
      }
      
      res.status(500).json({ 
        error: "Failed to save team",
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : error) : undefined
      });
    }
  });

  // Complete team registration after payment approval
  app.post("/api/team/complete-registration", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { paymentProofId } = req.body;
      
      // Verify payment proof is approved
      const [proof] = await db
        .select()
        .from(paymentProofs)
        .where(
          and(
            eq(paymentProofs.id, paymentProofId),
            eq(paymentProofs.userId, req.user!.id),
            eq(paymentProofs.status, 'approved')
          )
        )
        .limit(1);
        
      if (!proof) {
        return res.status(400).json({ error: "Payment proof not found or not approved" });
      }
      
      // Get pending team data from session or reconstruct from payment proof
      const teamData = req.session.pendingTeam;
      if (!teamData) {
        return res.status(400).json({ error: "No pending team data found" });
      }
      
      // Create the team
      const [newTeam] = await db
        .insert(teams)
        .values({
          ...teamData,
          userId: req.user!.id,
          teamNumber: proof.teamNumber,
          isActive: true
        })
        .returning();
        
      // Link payment proof to team
      await db
        .update(paymentProofs)
        .set({ teamId: newTeam.id })
        .where(eq(paymentProofs.id, paymentProofId));
        
      // Clear pending team data
      delete req.session.pendingTeam;
      
      res.json(newTeam);
    } catch (error) {
      console.error("Error completing team registration:", error);
      res.status(500).json({ error: "Failed to complete team registration" });
    }
  });

  app.post("/api/team", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const currentGameweek = await storage.getCurrentGameweek();
      if (!currentGameweek) {
        return res.status(404).json({ error: "No active gameweek" });
      }

      // Check if user has paid for this gameweek (unless admin)
      if (!req.user!.isAdmin) {
        const approvedPayment = await db
          .select()
          .from(paymentProofs)
          .where(
            and(
              eq(paymentProofs.userId, req.user!.id),
              eq(paymentProofs.gameweekId, currentGameweek.id),
              eq(paymentProofs.status, 'approved')
            )
          )
          .limit(1);

        if (approvedPayment.length === 0) {
          return res.status(402).json({ 
            error: "Payment required", 
            message: "Please complete payment for this gameweek to create teams",
            redirectTo: "/manual-payment",
            gameweekId: currentGameweek.id
          });
        }
      }
      
      // COMPREHENSIVE DEADLINE CHECK (admins are exempt)
      const now = new Date();
      const deadline = new Date(currentGameweek.deadline);
      const isDeadlinePassed = now > deadline;
      const isGameweekCompleted = currentGameweek.isCompleted;
      
      if (!req.user!.isAdmin && (isDeadlinePassed || isGameweekCompleted)) {
        console.log(`TEAM CREATE BLOCKED: Non-admin user ${req.user!.email} tried to create team after deadline`);
        console.log(`Deadline: ${deadline.toISOString()}, Current time: ${now.toISOString()}`);
        
        return res.status(403).json({ 
          error: isGameweekCompleted 
            ? "Gameweek is completed - no more team changes allowed" 
            : "Deadline has passed - team creation is now closed",
          deadline: deadline.toISOString(),
          currentTime: now.toISOString(),
          gameweekNumber: currentGameweek.gameweekNumber,
          isDeadlinePassed,
          isGameweekCompleted,
          hoursAfterDeadline: (now.getTime() - deadline.getTime()) / (1000 * 60 * 60),
          message: "You can still view the leaderboard to see results once matches are completed"
        });
      }
      
      if (req.user!.isAdmin && (isDeadlinePassed || isGameweekCompleted)) {
        console.log(`ADMIN OVERRIDE: ${req.user!.email} creating team after deadline - allowed for admin`);
      }
      
      const teamData = insertTeamSchema.parse(req.body);
      const { teamNumber } = req.body; // Get team number from request
      
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
      
      // Check existing teams count for this user in this gameweek (enforce 5 team limit)
      const existingTeamsCount = await db
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.userId, req.user!.id),
            eq(teams.gameweekId, currentGameweek.id)
          )
        );
      
      // If trying to create a new team (not update), check the limit
      const requestedTeamNumber = teamNumber || 1;
      const existingTeamWithNumber = existingTeamsCount.find(t => t.teamNumber === requestedTeamNumber);
      
      if (!existingTeamWithNumber && existingTeamsCount.length >= 5) {
        return res.status(400).json({ 
          error: "Maximum 5 teams allowed per person per gameweek",
          message: "You have already created the maximum number of teams for this gameweek."
        });
      }
      
      // Check if user already has this specific team number for this gameweek
      const existingTeam = await db
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.userId, req.user!.id),
            eq(teams.gameweekId, currentGameweek.id),
            eq(teams.teamNumber, requestedTeamNumber)
          )
        )
        .limit(1);
      
      let team;
      if (existingTeam.length > 0) {
        // Update existing team
        const [updatedTeam] = await db
          .update(teams)
          .set({
            ...teamData,
            teamNumber: teamNumber || 1
          })
          .where(eq(teams.id, existingTeam[0].id))
          .returning();
        team = updatedTeam;
      } else {
        // Create new team
        const [newTeam] = await db
          .insert(teams)
          .values({
            ...teamData,
            userId: req.user!.id,
            gameweekId: currentGameweek.id,
            teamNumber: teamNumber || 1,
            isActive: true
          })
          .returning();
        team = newTeam;
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
      // Fetch actual payment proofs from the database
      const userPayments = await db
        .select({
          id: paymentProofs.id,
          gameweekId: paymentProofs.gameweekId,
          teamNumber: paymentProofs.teamNumber,
          paymentMethod: paymentProofs.paymentMethod,
          transactionId: paymentProofs.transactionId,
          amount: paymentProofs.amount,
          status: paymentProofs.status,
          submittedAt: paymentProofs.submittedAt,
          verifiedAt: paymentProofs.verifiedAt,
          notes: paymentProofs.notes,
          gameweekNumber: gameweeks.gameweekNumber
        })
        .from(paymentProofs)
        .leftJoin(gameweeks, eq(paymentProofs.gameweekId, gameweeks.id))
        .where(eq(paymentProofs.userId, req.user!.id))
        .orderBy(desc(paymentProofs.submittedAt));
      
      // Transform to expected format
      const paymentHistory = userPayments.map(payment => ({
        id: payment.id,
        gameweekNumber: payment.gameweekNumber || payment.gameweekId, // Fallback to gameweekId if gameweekNumber is null
        amount: parseFloat(payment.amount || "20"),
        status: payment.status,
        paymentMethod: payment.paymentMethod.toUpperCase(),
        transactionId: payment.transactionId,
        createdAt: payment.submittedAt || new Date().toISOString(),
        verifiedAt: payment.verifiedAt,
        teamNumber: payment.teamNumber,
        notes: payment.notes
      }));
      
      res.json(paymentHistory);
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
      
      // Calculate scores using FPL API before completing gameweek
      const scores = await fplScoringService.triggerScoreCalculation(gameweekId);
      
      res.json({ 
        success: true, 
        message: `Gameweek ${gameweekId} completed and scores calculated`,
        scoresCalculated: scores.length,
        totalPoints: scores.reduce((sum, s) => sum + s.totalPoints, 0)
      });
    } catch (error) {
      console.error("Error completing gameweek:", error);
      res.status(500).json({ error: "Failed to complete gameweek" });
    }
  });

  // FPL Scoring Service Endpoints
  app.post("/api/admin/calculate-scores/:gameweekId?", sessionManager.requireAdmin(), async (req, res) => {
    try {
      const gameweekId = req.params.gameweekId ? parseInt(req.params.gameweekId) : undefined;
      const scores = await fplScoringService.triggerScoreCalculation(gameweekId);
      
      res.json({
        message: "Scores calculated successfully",
        gameweekId: gameweekId || "current",
        teamsProcessed: scores.length,
        totalPoints: scores.reduce((sum, s) => sum + s.totalPoints, 0),
        topTeam: scores.length > 0 ? {
          teamId: scores[0].teamId,
          userId: scores[0].userId,
          points: scores[0].totalPoints
        } : null
      });
    } catch (error) {
      console.error("Error calculating scores:", error);
      res.status(500).json({ error: error.message || "Failed to calculate scores" });
    }
  });

  // Enhanced leaderboard with user's team details and top 10
  app.get("/api/leaderboard/enhanced/:gameweekId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const gameweekId = parseInt(req.params.gameweekId);
      if (isNaN(gameweekId)) {
        return res.status(400).json({ error: "Invalid gameweek ID" });
      }

      // Get top 10 teams
      const topTeams = await storage.getGameweekLeaderboard(gameweekId, 10);
      
      // Get user's teams for this gameweek with detailed scoring
      const userTeams = await storage.getUserTeamsForGameweek(req.user!.id, gameweekId);
      
      const userTeamDetails = await Promise.all(
        userTeams.map(async (team) => {
          const players = await storage.getTeamPlayers(team.id);
          
          // Get user's rank from leaderboard
          const allResults = await storage.getGameweekLeaderboard(gameweekId, 1000);
          const userResult = allResults.find(r => r.teamId === team.id);
          
          return {
            teamId: team.id,
            teamName: team.teamName,
            totalPoints: team.totalPoints || 0,
            rank: userResult?.rank || 0,
            players: players.map(p => ({
              playerId: p.fplPlayerId,
              playerName: p.playerName,
              position: p.position,
              points: p.gameweekPoints || 0,
              isCaptain: p.isCaptain,
              isViceCaptain: p.isViceCaptain,
              actualPoints: p.isCaptain ? (p.gameweekPoints || 0) * 2 : (p.gameweekPoints || 0)
            }))
          };
        })
      );

      res.json({
        topTeams,
        userTeams: userTeamDetails,
        gameweekId,
        totalParticipants: topTeams.length > 0 ? Math.max(...topTeams.map(t => t.rank || 0)) : 0
      });
    } catch (error) {
      console.error("Error fetching enhanced leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Get detailed team scoring breakdown
  app.get("/api/team/:teamId/scoring-breakdown", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const teamId = parseInt(req.params.teamId);
      
      // Verify user owns this team or is admin
      const team = await db.select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
        
      if (team.length === 0) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      if (team[0].userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const players = await storage.getTeamPlayers(teamId);
      const gameweek = await storage.getGameweek(team[0].gameweekId);
      
      res.json({
        teamId: team[0].id,
        teamName: team[0].teamName,
        gameweekNumber: gameweek?.gameweekNumber || 0,
        totalPoints: team[0].totalPoints || 0,
        captain: players.find(p => p.isCaptain),
        viceCaptain: players.find(p => p.isViceCaptain),
        players: players.map(p => ({
          playerId: p.fplPlayerId,
          playerName: p.playerName,
          position: p.position,
          basePoints: p.gameweekPoints || 0,
          captainBonus: p.isCaptain ? (p.gameweekPoints || 0) : 0,
          totalPoints: p.isCaptain ? (p.gameweekPoints || 0) * 2 : (p.gameweekPoints || 0),
          isCaptain: p.isCaptain,
          isViceCaptain: p.isViceCaptain
        }))
      });
    } catch (error) {
      console.error("Error fetching team scoring breakdown:", error);
      res.status(500).json({ error: "Failed to fetch scoring breakdown" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
