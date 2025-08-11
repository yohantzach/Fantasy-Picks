import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { paymentProofs } from "@shared/schema";
import { and, eq } from "drizzle-orm";

const router = Router();

// Schema for team creation/update
const teamSchema = z.object({
  teamName: z.string().min(1, "Team name is required").max(50, "Team name must be less than 50 characters"),
  formation: z.string().min(1, "Formation is required"),
  players: z.array(z.number()).min(11, "Team must have exactly 11 players").max(11, "Team must have exactly 11 players"),
  captainId: z.number().min(1, "Captain is required"),
  viceCaptainId: z.number().min(1, "Vice captain is required"),
  totalValue: z.number().min(0, "Total value must be positive"),
});

// Get all teams for the current user
router.get("/", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = req.user!.id;
    
    const userTeams = await storage.getUserTeams(userId);
    res.json(userTeams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

// Get a specific team by ID
router.get("/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = req.user!.id;
    const teamId = parseInt(req.params.id);

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const team = await storage.getUserTeam(userId, teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    res.json(team);
  } catch (error) {
    console.error("Error fetching team:", error);
    res.status(500).json({ error: "Failed to fetch team" });
  }
});

// Create a new team
router.post("/", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = req.user!.id;
    const teamData = teamSchema.parse(req.body);

    // Check current gameweek and deadline
    const currentGameweek = await storage.getCurrentGameweek();
    if (!currentGameweek) {
      return res.status(400).json({ error: "No active gameweek found" });
    }

    const deadline = new Date(currentGameweek.deadline);
    if (new Date() > deadline) {
      return res.status(400).json({ error: "Cannot create team after deadline" });
    }

    // Check team count limit (assuming max 5 teams per user per gameweek)
    const existingTeams = await storage.getUserTeamsForGameweek(userId, currentGameweek.id);
    const nextTeamNumber = existingTeams.length + 1;
    
    if (nextTeamNumber > 5) {
      return res.status(400).json({ error: "Maximum 5 teams allowed per gameweek" });
    }

    // **CRITICAL: Check if payment has been approved for this specific team**
    const paymentProof = await db
      .select()
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.userId, userId),
          eq(paymentProofs.gameweekId, currentGameweek.id),
          eq(paymentProofs.teamNumber, nextTeamNumber),
          eq(paymentProofs.status, 'approved')
        )
      )
      .limit(1);

    if (paymentProof.length === 0) {
      return res.status(402).json({
        error: "Payment required",
        message: `You need to pay ₹20 for team ${nextTeamNumber}. Please complete payment verification first.`,
        redirectTo: `/payment?gameweek=${currentGameweek.id}&team=${nextTeamNumber}`,
        requiresPayment: true,
        gameweekId: currentGameweek.id,
        teamNumber: nextTeamNumber
      });
    }

    // Validate captain and vice captain are different
    if (teamData.captainId === teamData.viceCaptainId) {
      return res.status(400).json({ error: "Captain and vice captain must be different players" });
    }

    // Validate captain and vice captain are in the selected players
    if (!teamData.players.includes(teamData.captainId)) {
      return res.status(400).json({ error: "Captain must be one of the selected players" });
    }
    
    if (!teamData.players.includes(teamData.viceCaptainId)) {
      return res.status(400).json({ error: "Vice captain must be one of the selected players" });
    }

    // Check if team name is unique for the user in this gameweek
    const existingTeamName = existingTeams.find(team => team.teamName === teamData.teamName);
    if (existingTeamName) {
      return res.status(400).json({ error: "Team name already exists for this gameweek" });
    }

    // Create the team with the correct team number
    const newTeam = await storage.createTeam({
      ...teamData,
      userId,
      gameweekId: currentGameweek.id,
      teamNumber: nextTeamNumber,
      isLocked: false,
      totalPoints: 0,
    });

    // Update the payment proof to link it to the created team
    await db
      .update(paymentProofs)
      .set({ teamId: newTeam.id })
      .where(eq(paymentProofs.id, paymentProof[0].id));

    res.status(201).json(newTeam);
  } catch (error) {
    console.error("Error creating team:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid team data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create team" });
  }
});

// Update an existing team
router.put("/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = req.user!.id;
    const teamId = parseInt(req.params.id);
    const teamData = teamSchema.parse(req.body);

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    // Find the team
    const existingTeam = await storage.getUserTeam(userId, teamId);
    if (!existingTeam) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Check if team is locked
    if (existingTeam.isLocked) {
      return res.status(400).json({ error: "Cannot update locked team" });
    }

    // Check deadline
    const gameweek = await storage.getGameweek(existingTeam.gameweekId);
    if (gameweek) {
      const deadline = new Date(gameweek.deadline);
      if (new Date() > deadline) {
        return res.status(400).json({ error: "Cannot update team after deadline" });
      }
    }

    // Validate captain and vice captain are different
    if (teamData.captainId === teamData.viceCaptainId) {
      return res.status(400).json({ error: "Captain and vice captain must be different players" });
    }

    // Validate captain and vice captain are in the selected players
    if (!teamData.players.includes(teamData.captainId)) {
      return res.status(400).json({ error: "Captain must be one of the selected players" });
    }
    
    if (!teamData.players.includes(teamData.viceCaptainId)) {
      return res.status(400).json({ error: "Vice captain must be one of the selected players" });
    }

    // Check if team name is unique for the user in this gameweek (excluding current team)
    if (teamData.teamName !== existingTeam.teamName) {
      const existingTeams = await storage.getUserTeamsForGameweek(userId, existingTeam.gameweekId);
      const existingTeamName = existingTeams.find(team => team.teamName === teamData.teamName && team.id !== teamId);
      if (existingTeamName) {
        return res.status(400).json({ error: "Team name already exists for this gameweek" });
      }
    }

    // Update the team
    const updatedTeam = await storage.updateTeam(teamId, teamData);
    res.json(updatedTeam);
  } catch (error) {
    console.error("Error updating team:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid team data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update team" });
  }
});

// Delete a team
router.delete("/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = req.user!.id;
    const teamId = parseInt(req.params.id);

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    // Find the team
    const existingTeam = await storage.getUserTeam(userId, teamId);
    if (!existingTeam) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Check if team is locked
    if (existingTeam.isLocked) {
      return res.status(400).json({ error: "Cannot delete locked team" });
    }

    // Delete the team
    await storage.deleteTeam(teamId);
    res.json({ message: "Team deleted successfully" });
  } catch (error) {
    console.error("Error deleting team:", error);
    res.status(500).json({ error: "Failed to delete team" });
  }
});

// Lock/Unlock a team (admin functionality)
router.patch("/:id/lock", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = req.user!.id;
    const teamId = parseInt(req.params.id);

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    // Find the team
    const existingTeam = await storage.getUserTeam(userId, teamId);
    if (!existingTeam) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Toggle lock status
    const updatedTeam = await storage.updateTeamLockStatus(teamId, !existingTeam.isLocked);
    res.json(updatedTeam);
  } catch (error) {
    console.error("Error updating team lock status:", error);
    res.status(500).json({ error: "Failed to update team lock status" });
  }
});

export default router;
