import { storage } from './storage';
import { db } from './db';
import { teams, users, playerSelections, gameweekResults, gameweeks } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface FPLLiveElement {
  id: number;
  stats: {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    own_goals: number;
    penalties_saved: number;
    penalties_missed: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
    bps: number;
    influence: string;
    creativity: string;
    threat: string;
    ict_index: string;
  };
  explain?: Array<{
    fixture: number;
    stats: Array<{
      identifier: string;
      points: number;
      value: number;
    }>;
  }>;
}

interface FPLFixture {
  id: number;
  event: number;
  team_h: number;
  team_a: number;
  finished: boolean;
  finished_provisional: boolean;
  kickoff_time: string;
  stats: any[];
}

interface TeamScoreResult {
  teamId: number;
  userId: number;
  totalPoints: number;
  playerScores: Array<{
    playerId: number;
    playerName: string;
    points: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
    actualCaptain: boolean; // true if this player was the effective captain
  }>;
}

export class FPLScoringService {
  private baseUrl = 'https://fantasy.premierleague.com/api';
  private lastScoringTime: number = 0;
  private scoringInProgress: boolean = false;
  private dailyScoringTracker = new Map<number, number>(); // gameweekId -> timestamp of last scoring
  private scoringInterval?: NodeJS.Timeout;

  constructor() {}

  /**
   * Check if all fixtures for a gameweek are finished
   */
  async areAllFixturesFinished(gameweekNumber: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/fixtures/?event=${gameweekNumber}`);
      const fixtures: FPLFixture[] = await response.json();
      
      return fixtures.every(fixture => fixture.finished);
    } catch (error) {
      console.error('Error checking fixture status:', error);
      return false;
    }
  }

  /**
   * Get the kickoff time of the last fixture in a gameweek
   */
  async getLastFixtureKickoffTime(gameweekNumber: number): Promise<Date | null> {
    try {
      const response = await fetch(`${this.baseUrl}/fixtures/?event=${gameweekNumber}`);
      const fixtures: FPLFixture[] = await response.json();
      
      if (fixtures.length === 0) return null;

      // Find the fixture with the latest kickoff time
      const lastFixture = fixtures.reduce((latest, current) => {
        const currentKickoff = new Date(current.kickoff_time);
        const latestKickoff = new Date(latest.kickoff_time);
        return currentKickoff > latestKickoff ? current : latest;
      });

      return new Date(lastFixture.kickoff_time);
    } catch (error) {
      console.error('Error getting last fixture time:', error);
      return null;
    }
  }

  /**
   * Check if it's time to calculate scores (1 hour after last fixture)
   */
  async shouldCalculateScores(gameweekNumber: number): Promise<boolean> {
    try {
      // Check if all fixtures are finished
      const allFinished = await this.areAllFixturesFinished(gameweekNumber);
      if (!allFinished) return false;

      // Get the last fixture kickoff time
      const lastKickoffTime = await this.getLastFixtureKickoffTime(gameweekNumber);
      if (!lastKickoffTime) return false;

      // Add 3 hours to account for match duration + 1 hour buffer
      const scoringTime = new Date(lastKickoffTime.getTime() + (4 * 60 * 60 * 1000));
      const now = new Date();

      return now >= scoringTime;
    } catch (error) {
      console.error('Error checking if should calculate scores:', error);
      return false;
    }
  }

  /**
   * Get live scores for all players in a gameweek
   */
  async getLiveScores(gameweekNumber: number): Promise<Map<number, FPLLiveElement>> {
    try {
      const response = await fetch(`${this.baseUrl}/event/${gameweekNumber}/live/`);
      const data = await response.json();
      
      const scoresMap = new Map<number, FPLLiveElement>();
      
      if (data.elements && Array.isArray(data.elements)) {
        data.elements.forEach((element: FPLLiveElement) => {
          scoresMap.set(element.id, element);
        });
      }

      return scoresMap;
    } catch (error) {
      console.error('Error fetching live scores:', error);
      return new Map();
    }
  }

  /**
   * Calculate FPL points for a player based on their stats and position
   */
  private calculatePlayerPoints(element: FPLLiveElement, playerPosition: string): number {
    const stats = element.stats;
    let points = 0;

    // Minutes played
    if (stats.minutes > 0) {
      points += stats.minutes >= 60 ? 2 : 1;
    }

    // Goals scored
    if (playerPosition === 'GKP' || playerPosition === 'DEF') {
      points += stats.goals_scored * 6;
    } else if (playerPosition === 'MID') {
      points += stats.goals_scored * 5;
    } else if (playerPosition === 'FWD') {
      points += stats.goals_scored * 4;
    }

    // Assists
    points += stats.assists * 3;

    // Clean sheets
    if ((playerPosition === 'GKP' || playerPosition === 'DEF') && stats.clean_sheets > 0) {
      points += stats.clean_sheets * 4;
    } else if (playerPosition === 'MID' && stats.clean_sheets > 0) {
      points += stats.clean_sheets * 1;
    }

    // Goals conceded (GKP and DEF lose points for every 2 goals conceded)
    if (playerPosition === 'GKP' || playerPosition === 'DEF') {
      points -= Math.floor(stats.goals_conceded / 2);
    }

    // Penalties saved (GKP only)
    if (playerPosition === 'GKP') {
      points += stats.penalties_saved * 5;
    }

    // Penalties missed
    points -= stats.penalties_missed * 2;

    // Cards
    points -= stats.yellow_cards * 1;
    points -= stats.red_cards * 3;

    // Own goals
    points -= stats.own_goals * 2;

    // Saves (GKP only, 1 point per 3 saves)
    if (playerPosition === 'GKP') {
      points += Math.floor(stats.saves / 3);
    }

    // Bonus points
    points += stats.bonus;

    return Math.max(0, points); // Points cannot be negative
  }

  /**
   * Get player position from FPL API
   */
  async getPlayerPositions(): Promise<Map<number, string>> {
    try {
      const response = await fetch(`${this.baseUrl}/bootstrap-static/`);
      const data = await response.json();
      
      const positionsMap = new Map<number, string>();
      const elementTypes = data.element_types;
      
      // Create element type mapping (1: GKP, 2: DEF, 3: MID, 4: FWD)
      const typeMapping: { [key: number]: string } = {};
      elementTypes.forEach((type: any) => {
        typeMapping[type.id] = type.singular_name_short;
      });

      // Map players to their positions
      data.elements.forEach((player: any) => {
        positionsMap.set(player.id, typeMapping[player.element_type] || 'FWD');
      });

      return positionsMap;
    } catch (error) {
      console.error('Error fetching player positions:', error);
      return new Map();
    }
  }

  /**
   * Calculate scores for a specific team
   */
  async calculateTeamScore(teamId: number, gameweekNumber: number): Promise<TeamScoreResult | null> {
    try {
      // Get team details
      const team = await db.select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      if (team.length === 0) return null;

      const teamData = team[0];

      // Get live scores and player positions
      const [liveScores, playerPositions] = await Promise.all([
        this.getLiveScores(gameweekNumber),
        this.getPlayerPositions()
      ]);

      // Get team players from database (if stored there) or from team.players array
      let teamPlayers = [];
      
      // Try to get detailed player info from playerSelections table
      const playerSelections = await db.select()
        .from(playerSelections)
        .where(eq(playerSelections.teamId, teamId));

      if (playerSelections.length > 0) {
        teamPlayers = playerSelections.map(ps => ({
          playerId: ps.fplPlayerId,
          playerName: ps.playerName,
          position: ps.position,
          isCaptain: ps.isCaptain,
          isViceCaptain: ps.isViceCaptain
        }));
      } else {
        // Fallback to players array in team data
        teamPlayers = teamData.players.map((playerId: number) => ({
          playerId,
          playerName: `Player ${playerId}`,
          position: playerPositions.get(playerId) || 'FWD',
          isCaptain: playerId === teamData.captainId,
          isViceCaptain: playerId === teamData.viceCaptainId
        }));
      }

      // Calculate points for each player
      const playerScores = teamPlayers.map(player => {
        const liveData = liveScores.get(player.playerId);
        const position = playerPositions.get(player.playerId) || player.position || 'FWD';
        
        let points = 0;
        if (liveData && liveData.stats.minutes > 0) {
          points = this.calculatePlayerPoints(liveData, position);
        }

        return {
          playerId: player.playerId,
          playerName: player.playerName,
          points,
          isCaptain: player.isCaptain,
          isViceCaptain: player.isViceCaptain,
          actualCaptain: false
        };
      });

      // Handle captain logic (captain gets double points, vice-captain becomes captain if captain plays 0 minutes)
      let captain = playerScores.find(p => p.isCaptain);
      let viceCaptain = playerScores.find(p => p.isViceCaptain);

      let effectiveCaptain = captain;

      // If captain played 0 minutes, make vice-captain the effective captain
      if (captain && captain.points === 0 && viceCaptain && viceCaptain.points > 0) {
        effectiveCaptain = viceCaptain;
        console.log(`Team ${teamId}: Captain played 0 minutes, vice-captain becomes effective captain`);
      }

      // Apply captain bonus (double points)
      if (effectiveCaptain) {
        effectiveCaptain.points *= 2;
        effectiveCaptain.actualCaptain = true;
      }

      // Calculate total points
      const totalPoints = playerScores.reduce((sum, player) => sum + player.points, 0);

      return {
        teamId,
        userId: teamData.userId,
        totalPoints,
        playerScores
      };
    } catch (error) {
      console.error(`Error calculating team score for team ${teamId}:`, error);
      return null;
    }
  }

  /**
   * Calculate scores for all teams in a gameweek
   */
  async calculateGameweekScores(gameweekId: number): Promise<TeamScoreResult[]> {
    if (this.scoringInProgress) {
      console.log('Scoring already in progress, skipping...');
      return [];
    }

    try {
      this.scoringInProgress = true;
      console.log(`Starting score calculation for gameweek ${gameweekId}...`);

      // Get gameweek details
      const gameweek = await storage.getGameweek(gameweekId);
      if (!gameweek) {
        throw new Error(`Gameweek ${gameweekId} not found`);
      }

      // Check if it's time to calculate scores
      const shouldCalculate = await this.shouldCalculateScores(gameweek.gameweekNumber);
      if (!shouldCalculate) {
        console.log(`Not yet time to calculate scores for gameweek ${gameweek.gameweekNumber}`);
        return [];
      }

      // Get all teams for this gameweek
      const gameweekTeams = await db.select()
        .from(teams)
        .where(eq(teams.gameweekId, gameweekId));

      console.log(`Found ${gameweekTeams.length} teams for gameweek ${gameweek.gameweekNumber}`);

      // Calculate scores for all teams
      const teamScores: TeamScoreResult[] = [];
      
      for (const team of gameweekTeams) {
        console.log(`Calculating scores for team ${team.id} (${team.teamName})...`);
        const scoreResult = await this.calculateTeamScore(team.id, gameweek.gameweekNumber);
        
        if (scoreResult) {
          teamScores.push(scoreResult);
          
          // Update team total points in database
          await db.update(teams)
            .set({ totalPoints: scoreResult.totalPoints })
            .where(eq(teams.id, team.id));

          // Update individual player points if we have playerSelections
          for (const playerScore of scoreResult.playerScores) {
            await db.update(playerSelections)
              .set({ gameweekPoints: playerScore.points })
              .where(and(
                eq(playerSelections.teamId, team.id),
                eq(playerSelections.fplPlayerId, playerScore.playerId)
              ));
          }
        }
      }

      // Sort teams by total points and assign ranks
      teamScores.sort((a, b) => b.totalPoints - a.totalPoints);

      // Clear existing gameweek results
      await db.delete(gameweekResults)
        .where(eq(gameweekResults.gameweekId, gameweekId));

      // Save gameweek results
      for (let i = 0; i < teamScores.length; i++) {
        const teamScore = teamScores[i];
        await storage.createGameweekResult({
          gameweekId,
          userId: teamScore.userId,
          teamId: teamScore.teamId,
          totalPoints: teamScore.totalPoints,
          rank: i + 1
        });
      }

      // Mark gameweek as completed
      await storage.updateGameweekStatus(gameweekId, true);

      console.log(`Score calculation completed for gameweek ${gameweek.gameweekNumber}. Processed ${teamScores.length} teams.`);
      this.lastScoringTime = Date.now();

      return teamScores;
    } catch (error) {
      console.error('Error calculating gameweek scores:', error);
      throw error;
    } finally {
      this.scoringInProgress = false;
    }
  }

  /**
   * Check if we should run scoring for a gameweek (only once per day after matches start)
   */
  private hasGameweekBeenScoredToday(gameweekId: number): boolean {
    const lastScored = this.dailyScoringTracker.get(gameweekId);
    if (!lastScored) return false;
    
    // Check if we've scored within the last 20 hours
    const twentyHoursAgo = Date.now() - (20 * 60 * 60 * 1000);
    return lastScored > twentyHoursAgo;
  }

  /**
   * Check if any matches have started for a gameweek
   */
  private async haveMatchesStarted(gameweekNumber: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/fixtures/?event=${gameweekNumber}`);
      const fixtures: FPLFixture[] = await response.json();
      
      // Check if any fixture has started (kickoff time has passed)
      const now = new Date();
      return fixtures.some(fixture => {
        const kickoffTime = new Date(fixture.kickoff_time);
        return now > kickoffTime;
      });
    } catch (error) {
      console.error('Error checking if matches started:', error);
      return false;
    }
  }

  /**
   * Run scheduled scoring check (hourly)
   */
  private async runScheduledScoring() {
    try {
      const currentGameweek = await storage.getCurrentGameweek();
      if (!currentGameweek || currentGameweek.isCompleted) {
        return;
      }

      // Check if we've already scored this gameweek today
      if (this.hasGameweekBeenScoredToday(currentGameweek.id)) {
        return;
      }

      // Check if matches have started for this gameweek
      const matchesStarted = await this.haveMatchesStarted(currentGameweek.gameweekNumber);
      if (!matchesStarted) {
        console.log(`⏳ GW${currentGameweek.gameweekNumber}: Matches haven't started yet`);
        return;
      }

      // Check if we should calculate scores (after matches finish)
      const shouldCalculate = await this.shouldCalculateScores(currentGameweek.gameweekNumber);
      if (!shouldCalculate) {
        console.log(`⏳ GW${currentGameweek.gameweekNumber}: Matches still in progress, waiting...`);
        return;
      }

      console.log(`🎯 GW${currentGameweek.gameweekNumber}: All matches finished, calculating scores...`);
      await this.calculateGameweekScores(currentGameweek.id);
      
      // Mark that we've scored this gameweek today
      this.dailyScoringTracker.set(currentGameweek.id, Date.now());
      
    } catch (error) {
      console.error('Error in scheduled scoring:', error);
    }
  }

  /**
   * Start automatic scoring process - runs hourly but scores only once per day after matches
   */
  startAutoScoring() {
    console.log('🚀 Starting FPL automatic scoring service...');
    console.log('📅 Scoring will run ONCE PER DAY after all matches in a gameweek are completed');
    
    // Check every hour for scoring opportunities
    this.scoringInterval = setInterval(() => {
      this.runScheduledScoring();
    }, 60 * 60 * 1000); // Every hour
    
    // Run initial check after 30 seconds
    setTimeout(() => this.runScheduledScoring(), 30000);
  }

  /**
   * Stop the automatic scoring service
   */
  stopAutoScoring() {
    if (this.scoringInterval) {
      clearInterval(this.scoringInterval);
      this.scoringInterval = undefined;
      console.log('🛑 Stopped FPL automatic scoring service');
    }
  }

  /**
   * Manual trigger for score calculation (for testing/admin use)
   */
  async triggerScoreCalculation(gameweekId?: number): Promise<TeamScoreResult[]> {
    try {
      let targetGameweekId = gameweekId;
      
      if (!targetGameweekId) {
        const currentGameweek = await storage.getCurrentGameweek();
        if (!currentGameweek) {
          throw new Error('No active gameweek found');
        }
        targetGameweekId = currentGameweek.id;
      }

      console.log(`Manual score calculation triggered for gameweek ${targetGameweekId}`);
      return await this.calculateGameweekScores(targetGameweekId);
    } catch (error) {
      console.error('Error in manual score calculation:', error);
      throw error;
    }
  }
}

export const fplScoringService = new FPLScoringService();
