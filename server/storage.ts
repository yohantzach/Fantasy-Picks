import { 
  users, 
  teams, 
  gameweeks, 
  playerSelections, 
  gameweekResults,
  type User, 
  type InsertUser, 
  type Team,
  type InsertTeam,
  type PlayerSelection,
  type InsertPlayerSelection,
  type Gameweek,
  type GameweekResult
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPayment(userId: number, paymentId: string): Promise<void>;

  // Gameweek management
  getCurrentGameweek(): Promise<Gameweek | undefined>;
  getGameweek(gameweekNumber: number): Promise<Gameweek | undefined>;
  createGameweek(gameweekNumber: number, deadline: Date): Promise<Gameweek>;
  updateGameweekDeadline(gameweekId: number, deadline: Date): Promise<void>;
  updateGameweekStatus(gameweekId: number, isCompleted: boolean): Promise<void>;

  // Team management
  getUserTeamForGameweek(userId: number, gameweekId: number): Promise<Team | undefined>;
  createTeam(teamData: InsertTeam & { userId: number; gameweekId: number }): Promise<Team>;
  updateTeam(teamId: number, updates: Partial<InsertTeam>): Promise<Team>;
  lockTeam(teamId: number): Promise<void>;

  // Player selections
  getTeamPlayers(teamId: number): Promise<PlayerSelection[]>;
  addPlayerToTeam(teamId: number, playerData: InsertPlayerSelection): Promise<PlayerSelection>;
  removePlayerFromTeam(teamId: number, fplPlayerId: number): Promise<void>;
  updatePlayerPoints(selectionId: number, points: number): Promise<void>;

  // Leaderboard
  getGameweekLeaderboard(gameweekId: number, limit?: number): Promise<GameweekResult[]>;
  createGameweekResult(result: Omit<GameweekResult, 'id' | 'createdAt'>): Promise<GameweekResult>;
  getPreviousGameweekWinners(limit?: number): Promise<GameweekResult[]>;

  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Set admin flag for admin email
    const userData = {
      ...insertUser,
      isAdmin: insertUser.email === "admin@gmail.com"
    };
    
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUserPayment(userId: number, paymentId: string): Promise<void> {
    await db
      .update(users)
      .set({ hasPaid: true, paymentId })
      .where(eq(users.id, userId));
  }

  async getCurrentGameweek(): Promise<Gameweek | undefined> {
    const [gameweek] = await db
      .select()
      .from(gameweeks)
      .where(eq(gameweeks.isActive, true))
      .orderBy(desc(gameweeks.gameweekNumber))
      .limit(1);
    return gameweek || undefined;
  }

  async getGameweek(gameweekNumber: number): Promise<Gameweek | undefined> {
    const [gameweek] = await db
      .select()
      .from(gameweeks)
      .where(eq(gameweeks.gameweekNumber, gameweekNumber));
    return gameweek || undefined;
  }

  async createGameweek(gameweekNumber: number, deadline: Date): Promise<Gameweek> {
    const [gameweek] = await db
      .insert(gameweeks)
      .values({ gameweekNumber, deadline })
      .returning();
    return gameweek;
  }

  async updateGameweekStatus(gameweekId: number, isCompleted: boolean): Promise<void> {
    await db
      .update(gameweeks)
      .set({ isCompleted, isActive: !isCompleted })
      .where(eq(gameweeks.id, gameweekId));
  }

  async updateGameweekDeadline(gameweekId: number, deadline: Date): Promise<void> {
    await db
      .update(gameweeks)
      .set({ deadline })
      .where(eq(gameweeks.id, gameweekId));
  }

  async getUserTeamForGameweek(userId: number, gameweekId: number): Promise<Team | undefined> {
    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.userId, userId), eq(teams.gameweekId, gameweekId)));
    return team || undefined;
  }

  async createTeam(teamData: InsertTeam & { userId: number; gameweekId: number }): Promise<Team> {
    const [team] = await db
      .insert(teams)
      .values(teamData)
      .returning();
    return team;
  }

  async updateTeam(teamId: number, updates: Partial<InsertTeam>): Promise<Team> {
    const [team] = await db
      .update(teams)
      .set(updates)
      .where(eq(teams.id, teamId))
      .returning();
    return team;
  }

  async lockTeam(teamId: number): Promise<void> {
    await db
      .update(teams)
      .set({ isLocked: true })
      .where(eq(teams.id, teamId));
  }

  async getTeamPlayers(teamId: number): Promise<PlayerSelection[]> {
    return await db
      .select()
      .from(playerSelections)
      .where(eq(playerSelections.teamId, teamId));
  }

  async addPlayerToTeam(teamId: number, playerData: InsertPlayerSelection): Promise<PlayerSelection> {
    const [selection] = await db
      .insert(playerSelections)
      .values({ ...playerData, teamId })
      .returning();
    return selection;
  }

  async removePlayerFromTeam(teamId: number, fplPlayerId: number): Promise<void> {
    await db
      .delete(playerSelections)
      .where(and(
        eq(playerSelections.teamId, teamId),
        eq(playerSelections.fplPlayerId, fplPlayerId)
      ));
  }

  async updatePlayerPoints(selectionId: number, points: number): Promise<void> {
    await db
      .update(playerSelections)
      .set({ gameweekPoints: points })
      .where(eq(playerSelections.id, selectionId));
  }

  async getGameweekLeaderboard(gameweekId: number, limit = 10): Promise<any[]> {
    return await db
      .select({
        id: gameweekResults.id,
        gameweekId: gameweekResults.gameweekId,
        userId: gameweekResults.userId,
        teamId: gameweekResults.teamId,
        totalPoints: gameweekResults.totalPoints,
        rank: gameweekResults.rank,
        createdAt: gameweekResults.createdAt,
        userName: users.name,
        teamName: teams.teamName,
      })
      .from(gameweekResults)
      .innerJoin(users, eq(gameweekResults.userId, users.id))
      .innerJoin(teams, eq(gameweekResults.teamId, teams.id))
      .where(eq(gameweekResults.gameweekId, gameweekId))
      .orderBy(gameweekResults.rank)
      .limit(limit);
  }

  async createGameweekResult(result: Omit<GameweekResult, 'id' | 'createdAt'>): Promise<GameweekResult> {
    const [gameweekResult] = await db
      .insert(gameweekResults)
      .values(result)
      .returning();
    return gameweekResult;
  }

  async getPreviousGameweekWinners(limit = 3): Promise<any[]> {
    return await db
      .select({
        id: gameweekResults.id,
        gameweekId: gameweekResults.gameweekId,
        userId: gameweekResults.userId,
        teamId: gameweekResults.teamId,
        totalPoints: gameweekResults.totalPoints,
        rank: gameweekResults.rank,
        createdAt: gameweekResults.createdAt,
        userName: users.name,
        teamName: teams.teamName,
        gameweekNumber: gameweeks.gameweekNumber,
      })
      .from(gameweekResults)
      .innerJoin(users, eq(gameweekResults.userId, users.id))
      .innerJoin(teams, eq(gameweekResults.teamId, teams.id))
      .innerJoin(gameweeks, eq(gameweekResults.gameweekId, gameweeks.id))
      .where(and(
        eq(gameweekResults.rank, 1),
        eq(gameweeks.isCompleted, true)
      ))
      .orderBy(desc(gameweeks.gameweekNumber))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
