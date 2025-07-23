import { FPLBootstrapData, FPLPlayer, FPLTeam, FPLFixture } from "@shared/schema";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

export class FPLAPIService {
  private bootstrapData: FPLBootstrapData | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getBootstrapData(): Promise<FPLBootstrapData> {
    const now = Date.now();
    if (this.bootstrapData && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.bootstrapData;
    }

    try {
      const response = await fetch(`${FPL_BASE_URL}/bootstrap-static/`);
      if (!response.ok) {
        throw new Error(`FPL API error: ${response.status}`);
      }
      
      this.bootstrapData = await response.json();
      this.lastFetch = now;
      return this.bootstrapData!;
    } catch (error) {
      console.error("Error fetching FPL bootstrap data:", error);
      throw new Error("Failed to fetch FPL data");
    }
  }

  async getPlayers(): Promise<FPLPlayer[]> {
    const data = await this.getBootstrapData();
    return data.elements;
  }

  async getTeams(): Promise<FPLTeam[]> {
    const data = await this.getBootstrapData();
    return data.teams;
  }

  async getPlayer(playerId: number): Promise<FPLPlayer | undefined> {
    const players = await this.getPlayers();
    return players.find(p => p.id === playerId);
  }

  async getFixtures(gameweek?: number): Promise<FPLFixture[]> {
    try {
      let url = `${FPL_BASE_URL}/fixtures/`;
      if (gameweek) {
        url += `?event=${gameweek}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`FPL API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching FPL fixtures:", error);
      throw new Error("Failed to fetch fixtures");
    }
  }

  async getCurrentGameweek(): Promise<number> {
    const data = await this.getBootstrapData();
    const currentEvent = data.events.find(event => event.is_current);
    return currentEvent ? currentEvent.id : 1;
  }

  async getGameweekDeadline(gameweek: number): Promise<Date | null> {
    const data = await this.getBootstrapData();
    const event = data.events.find(e => e.id === gameweek);
    return event ? new Date(event.deadline_time) : null;
  }

  async getGameweekLiveData(gameweek: number): Promise<any> {
    try {
      const response = await fetch(`${FPL_BASE_URL}/event/${gameweek}/live/`);
      if (!response.ok) {
        throw new Error(`FPL API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching live gameweek data:", error);
      throw new Error("Failed to fetch live data");
    }
  }

  calculatePlayerPoints(playerStats: any): number {
    let points = 0;
    
    // Minutes played (2 points for 60+ minutes, 1 point for 1-59 minutes)
    if (playerStats.minutes >= 60) points += 2;
    else if (playerStats.minutes > 0) points += 1;
    
    // Goals scored (varies by position)
    const position = playerStats.element_type;
    if (position === 1) { // Goalkeeper
      points += playerStats.goals_scored * 6;
    } else if (position === 2) { // Defender
      points += playerStats.goals_scored * 6;
    } else if (position === 3) { // Midfielder
      points += playerStats.goals_scored * 5;
    } else if (position === 4) { // Forward
      points += playerStats.goals_scored * 4;
    }
    
    // Assists (3 points each)
    points += playerStats.assists * 3;
    
    // Clean sheets (varies by position)
    if (position === 1 || position === 2) { // GK or Defender
      points += playerStats.clean_sheets * 4;
    } else if (position === 3) { // Midfielder
      points += playerStats.clean_sheets * 1;
    }
    
    // Goals conceded (GK and Defenders lose 1 point per 2 goals)
    if (position === 1 || position === 2) {
      points -= Math.floor(playerStats.goals_conceded / 2);
    }
    
    // Cards
    points -= playerStats.yellow_cards * 1;
    points -= playerStats.red_cards * 3;
    
    // Own goals
    points -= playerStats.own_goals * 2;
    
    // Penalties missed
    points -= playerStats.penalties_missed * 2;
    
    // Penalties saved (GK only)
    if (position === 1) {
      points += playerStats.penalties_saved * 5;
    }
    
    // Saves (GK only, 1 point per 3 saves)
    if (position === 1) {
      points += Math.floor(playerStats.saves / 3);
    }
    
    // Bonus points
    points += playerStats.bonus;
    
    return Math.max(0, points); // Ensure points don't go negative
  }

  getPositionName(elementType: number): string {
    switch (elementType) {
      case 1: return "GKP";
      case 2: return "DEF";
      case 3: return "MID";
      case 4: return "FWD";
      default: return "UNK";
    }
  }

  formatPrice(price: number): string {
    return (price / 10).toFixed(1);
  }
}

export const fplApiService = new FPLAPIService();
