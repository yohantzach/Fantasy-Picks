import { pgTable, text, serial, integer, boolean, timestamp, decimal, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  isAdmin: boolean("is_admin").default(false),
  hasPaid: boolean("has_paid").default(false),
  paymentId: text("payment_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gameweeks = pgTable("gameweeks", {
  id: serial("id").primaryKey(),
  gameweekNumber: integer("gameweek_number").notNull().unique(),
  deadline: timestamp("deadline").notNull(),
  isActive: boolean("is_active").default(true),
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  gameweekId: integer("gameweek_id").references(() => gameweeks.id),
  teamName: text("team_name").notNull(),
  formation: text("formation").notNull().default("4-4-2"),
  totalValue: decimal("total_value", { precision: 4, scale: 1 }).notNull().default("100.0"),
  players: json("players").$type<number[]>().notNull().default([]),
  captainId: integer("captain_id"),
  viceCaptainId: integer("vice_captain_id"),
  totalPoints: integer("total_points").default(0),
  isLocked: boolean("is_locked").default(false),
  teamNumber: integer("team_number").notNull().default(1), // Allow multiple teams
  isActive: boolean("is_active").default(true), // Track which team is currently active
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerSelections = pgTable("player_selections", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id),
  fplPlayerId: integer("fpl_player_id").notNull(),
  playerName: text("player_name").notNull(),
  position: text("position").notNull(),
  price: decimal("price", { precision: 3, scale: 1 }).notNull(),
  teamCode: integer("team_code").notNull(),
  isCaptain: boolean("is_captain").default(false),
  isViceCaptain: boolean("is_vice_captain").default(false),
  gameweekPoints: integer("gameweek_points").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gameweekResults = pgTable("gameweek_results", {
  id: serial("id").primaryKey(),
  gameweekId: integer("gameweek_id").references(() => gameweeks.id),
  userId: integer("user_id").references(() => users.id),
  teamId: integer("team_id").references(() => teams.id),
  totalPoints: integer("total_points").notNull(),
  rank: integer("rank"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const paymentProofs = pgTable("payment_proofs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  gameweekId: integer("gameweek_id").references(() => gameweeks.id).notNull(), // Still need gameweek for context
  teamId: integer("team_id").references(() => teams.id), // Payment per team (null for initial payment, set after team creation)
  teamNumber: integer("team_number").notNull().default(1), // Which team number this payment is for
  paymentMethod: text("payment_method").notNull(),
  transactionId: text("transaction_id").notNull(),
  amount: decimal("amount", { precision: 8, scale: 2 }).notNull(),
  notes: text("notes"),
  proofFilePath: text("proof_file_path"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  submittedAt: timestamp("submitted_at").defaultNow(),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: integer("verified_by").references(() => users.id),
  adminNotes: text("admin_notes"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  teams: many(teams),
  gameweekResults: many(gameweekResults),
  paymentProofs: many(paymentProofs),
}));

export const paymentProofsRelations = relations(paymentProofs, ({ one }) => ({
  user: one(users, {
    fields: [paymentProofs.userId],
    references: [users.id],
  }),
  verifier: one(users, {
    fields: [paymentProofs.verifiedBy],
    references: [users.id],
  }),
}));

export const gameweeksRelations = relations(gameweeks, ({ many }) => ({
  teams: many(teams),
  gameweekResults: many(gameweekResults),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  user: one(users, {
    fields: [teams.userId],
    references: [users.id],
  }),
  gameweek: one(gameweeks, {
    fields: [teams.gameweekId],
    references: [gameweeks.id],
  }),
  playerSelections: many(playerSelections),
  gameweekResult: one(gameweekResults),
}));

export const playerSelectionsRelations = relations(playerSelections, ({ one }) => ({
  team: one(teams, {
    fields: [playerSelections.teamId],
    references: [teams.id],
  }),
}));

export const gameweekResultsRelations = relations(gameweekResults, ({ one }) => ({
  user: one(users, {
    fields: [gameweekResults.userId],
    references: [users.id],
  }),
  gameweek: one(gameweeks, {
    fields: [gameweekResults.gameweekId],
    references: [gameweeks.id],
  }),
  team: one(teams, {
    fields: [gameweekResults.teamId],
    references: [teams.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  phone: true,
  age: true,
  gender: true,
}).extend({
  email: z.string()
    .email("Please enter a valid email address")
    .refine((email) => email.endsWith("@gmail.com"), {
      message: "Only Gmail addresses (@gmail.com) are allowed"
    }),
  password: z.string().min(6),
  name: z.string().min(2),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number is too long"),
  age: z.number().min(13).max(100),
  gender: z.enum(["male", "female", "other"]),
});

export const insertTeamSchema = createInsertSchema(teams).pick({
  teamName: true,
  formation: true,
  players: true,
  captainId: true,
  viceCaptainId: true,
});

export const insertPlayerSelectionSchema = createInsertSchema(playerSelections).pick({
  fplPlayerId: true,
  playerName: true,
  position: true,
  price: true,
  teamCode: true,
  isCaptain: true,
  isViceCaptain: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type PlayerSelection = typeof playerSelections.$inferSelect;
export type InsertPlayerSelection = z.infer<typeof insertPlayerSelectionSchema>;
export type Gameweek = typeof gameweeks.$inferSelect;
export type GameweekResult = typeof gameweekResults.$inferSelect;
export type PaymentProof = typeof paymentProofs.$inferSelect;

// FPL Player type for API integration
export type FPLPlayer = {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  element_type: number;
  team: number;
  team_code: number;
  now_cost: number;
  total_points: number;
  form: string;
  selected_by_percent: string;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
};

export type FPLTeam = {
  id: number;
  name: string;
  short_name: string;
  code: number;
};

export type FPLFixture = {
  id: number;
  event: number;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  kickoff_time: string;
  finished: boolean;
  finished_provisional: boolean;
  stats: any[];
};

export type FPLBootstrapData = {
  elements: FPLPlayer[];
  teams: FPLTeam[];
  events: any[];
  element_types: any[];
  element_stats: any[];
};
