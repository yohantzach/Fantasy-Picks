import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { fplAPI } from "./fpl-api";
import { insertTeamSchema, insertPlayerSelectionSchema } from "@shared/schema";
import { z } from "zod";

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

  // FPL Data endpoints with hourly caching
  app.get("/api/fpl/players", async (req, res) => {
    try {
      const players = await fplAPI.getPlayers();
      const teams = await fplAPI.getTeams();
      
      // Add team information to players
      const playersWithTeams = players.map(player => ({
        ...player,
        team_name: teams.find(t => t.id === player.team)?.name || "Unknown",
        team_short_name: teams.find(t => t.id === player.team)?.short_name || "UNK",
        position_name: getPositionName(player.element_type),
        price_formatted: formatPrice(player.now_cost),
      }));
      
      res.json(playersWithTeams);
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ error: "Failed to fetch players" });
    }
  });

  app.get("/api/fpl/teams", async (req, res) => {
    try {
      const teams = await fplAPI.getTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  // Updated fixtures endpoint with gameweek parameter
  app.get("/api/fpl/fixtures/:gameweek?", async (req, res) => {
    try {
      const gameweek = req.params.gameweek ? parseInt(req.params.gameweek) : undefined;
      const fixtures = await fplAPI.getFixturesWithTeamNames(gameweek);
      res.json(fixtures);
    } catch (error) {
      console.error("Error fetching fixtures:", error);
      res.status(500).json({ error: "Failed to fetch fixtures" });
    }
  });

  // Cache statistics endpoint for monitoring
  app.get("/api/fpl/cache-stats", async (req, res) => {
    try {
      const stats = fplAPI.getCacheStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({ error: "Failed to fetch cache stats" });
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

  // Admin endpoints
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
