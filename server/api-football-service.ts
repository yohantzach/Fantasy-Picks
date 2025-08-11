// API-Football service integration for reliable data with proper rate limits
import { EventEmitter } from 'events';

interface APIFootballConfig {
  apiKey: string;
  baseUrl: string;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  timeout: number;
}

interface APIFootballCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  etag?: string;
}

interface APIFootballRateLimit {
  requestsThisMinute: number;
  requestsToday: number;
  minuteWindowStart: number;
  dayStart: number;
  remainingDaily: number;
  remainingMinute: number;
}

interface APIFootballFixture {
  fixture: {
    id: number;
    referee: string;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number;
      second: number;
    };
    venue: {
      id: number;
      name: string;
      city: string;
    };
    status: {
      long: string;
      short: string;
      elapsed: number;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
}

interface APIFootballTeam {
  team: {
    id: number;
    name: string;
    code: string;
    country: string;
    founded: number;
    national: boolean;
    logo: string;
  };
  venue: {
    id: number;
    name: string;
    address: string;
    city: string;
    capacity: number;
    surface: string;
    image: string;
  };
}

interface APIFootballPlayer {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number;
    birth: {
      date: string;
      place: string;
      country: string;
    };
    nationality: string;
    height: string;
    weight: string;
    injured: boolean;
    photo: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    league: {
      id: number;
      name: string;
      country: string;
      logo: string;
      flag: string;
      season: number;
    };
    games: {
      appearences: number;
      lineups: number;
      minutes: number;
      number: number | null;
      position: string;
      rating: string | null;
      captain: boolean;
    };
    substitutes: {
      in: number;
      out: number;
      bench: number;
    };
    shots: {
      total: number | null;
      on: number | null;
    };
    goals: {
      total: number | null;
      conceded: number | null;
      assists: number | null;
      saves: number | null;
    };
    passes: {
      total: number | null;
      key: number | null;
      accuracy: number | null;
    };
    tackles: {
      total: number | null;
      blocks: number | null;
      interceptions: number | null;
    };
    duels: {
      total: number | null;
      won: number | null;
    };
    dribbles: {
      attempts: number | null;
      success: number | null;
      past: number | null;
    };
    fouls: {
      drawn: number | null;
      committed: number | null;
    };
    cards: {
      yellow: number | null;
      yellowred: number | null;
      red: number | null;
    };
    penalty: {
      won: number | null;
      commited: number | null;
      scored: number | null;
      missed: number | null;
      saved: number | null;
    };
  }>;
}

class APIFootballService extends EventEmitter {
  private config: APIFootballConfig;
  private cache: Map<string, APIFootballCacheEntry> = new Map();
  private rateLimit: APIFootballRateLimit;
  
  private readonly PREMIER_LEAGUE_ID = 39;
  private readonly CURRENT_SEASON = 2025;
  
  // Cache TTL settings (in milliseconds)
  private readonly CACHE_TTL = {
    teams: 24 * 60 * 60 * 1000,        // 24 hours (teams rarely change)
    fixtures: 60 * 60 * 1000,          // 1 hour (fixture updates)
    liveFixtures: 2 * 60 * 1000,       // 2 minutes (during matches)
    players: 6 * 60 * 60 * 1000,       // 6 hours (player data)
    standings: 30 * 60 * 1000,          // 30 minutes (standings)
    playerStats: 12 * 60 * 60 * 1000,  // 12 hours (player statistics)
    injuries: 60 * 60 * 1000,           // 1 hour (injury updates)
  };

  constructor(config: Partial<APIFootballConfig> = {}) {
    super();
    
    this.config = {
      apiKey: config.apiKey || process.env.API_FOOTBALL_KEY || '1ad76774bemshedd3d1cee65e951p14c61ejsn7432633e9952',
      baseUrl: config.baseUrl || 'https://api-football-v1.p.rapidapi.com/v3',
      rateLimitPerMinute: config.rateLimitPerMinute || 30, // API-Football free tier
      rateLimitPerDay: config.rateLimitPerDay || 100,      // API-Football free tier
      timeout: config.timeout || 10000, // 10 seconds
      ...config
    };

    if (!this.config.apiKey) {
      console.warn('⚠️  API-Football API key not provided. Set API_FOOTBALL_KEY environment variable.');
    } else {
      console.log('✅ API-Football service initialized with API key');
    }

    // Initialize rate limiting
    this.rateLimit = {
      requestsThisMinute: 0,
      requestsToday: 0,
      minuteWindowStart: Date.now(),
      dayStart: this.getDayStart(),
      remainingDaily: this.config.rateLimitPerDay,
      remainingMinute: this.config.rateLimitPerMinute
    };

    this.startCacheCleanup();
    this.startRateLimitReset();
  }

  // ==================== PUBLIC API METHODS ====================

  /**
   * Get Premier League fixtures for a specific gameweek/round
   */
  async getFixtures(round?: number): Promise<APIFootballFixture[]> {
    const cacheKey = round ? `fixtures_round_${round}` : 'fixtures_all';
    const endpoint = round 
      ? `/fixtures?league=${this.PREMIER_LEAGUE_ID}&season=${this.CURRENT_SEASON}&round=Regular Season - ${round}`
      : `/fixtures?league=${this.PREMIER_LEAGUE_ID}&season=${this.CURRENT_SEASON}`;

    return this.makeRequest(endpoint, cacheKey, this.CACHE_TTL.fixtures);
  }

  /**
   * Get live fixtures (currently playing matches)
   */
  async getLiveFixtures(): Promise<APIFootballFixture[]> {
    const endpoint = `/fixtures?league=${this.PREMIER_LEAGUE_ID}&season=${this.CURRENT_SEASON}&live=all`;
    return this.makeRequest(endpoint, 'live_fixtures', this.CACHE_TTL.liveFixtures);
  }

  /**
   * Get Premier League teams
   */
  async getTeams(): Promise<APIFootballTeam[]> {
    const endpoint = `/teams?league=${this.PREMIER_LEAGUE_ID}&season=${this.CURRENT_SEASON}`;
    return this.makeRequest(endpoint, 'teams', this.CACHE_TTL.teams);
  }

  /**
   * Get Premier League standings
   */
  async getStandings(): Promise<any> {
    const endpoint = `/standings?league=${this.PREMIER_LEAGUE_ID}&season=${this.CURRENT_SEASON}`;
    return this.makeRequest(endpoint, 'standings', this.CACHE_TTL.standings);
  }

  /**
   * Get players for a specific team
   */
  async getPlayersByTeam(teamId: number): Promise<APIFootballPlayer[]> {
    const endpoint = `/players?team=${teamId}&season=${this.CURRENT_SEASON}&league=${this.PREMIER_LEAGUE_ID}`;
    return this.makeRequest(endpoint, `players_team_${teamId}`, this.CACHE_TTL.players);
  }

  /**
   * Get all Premier League players (expensive operation)
   */
  async getAllPlayers(): Promise<APIFootballPlayer[]> {
    const teams = await this.getTeams();
    const allPlayers: APIFootballPlayer[] = [];
    
    // Process teams in batches to respect rate limits
    for (let i = 0; i < teams.length; i += 5) {
      const batch = teams.slice(i, i + 5);
      
      const batchPromises = batch.map(teamData => 
        this.getPlayersByTeam(teamData.team.id)
      );
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(players => allPlayers.push(...players));
      
      // Wait between batches to respect rate limits
      if (i + 5 < teams.length) {
        await this.sleep(2000); // 2 second delay between batches
      }
    }
    
    return allPlayers;
  }

  /**
   * Get injured players
   */
  async getInjuries(): Promise<any> {
    const endpoint = `/injuries?league=${this.PREMIER_LEAGUE_ID}&season=${this.CURRENT_SEASON}`;
    return this.makeRequest(endpoint, 'injuries', this.CACHE_TTL.injuries);
  }

  /**
   * Get player statistics for a specific player
   */
  async getPlayerStats(playerId: number): Promise<APIFootballPlayer> {
    const endpoint = `/players?id=${playerId}&season=${this.CURRENT_SEASON}&league=${this.PREMIER_LEAGUE_ID}`;
    return this.makeRequest(endpoint, `player_${playerId}`, this.CACHE_TTL.playerStats);
  }

  // ==================== ENHANCED METHODS FOR FPL COMPATIBILITY ====================

  /**
   * Get fixtures in FPL-compatible format
   */
  async getFixturesWithTeamNames(gameweek?: number): Promise<any[]> {
    const fixtures = await this.getFixtures(gameweek);
    
    return fixtures.map(fixture => ({
      id: fixture.fixture.id,
      code: fixture.fixture.id,
      event: gameweek || this.extractGameweekFromRound(fixture.league.round),
      finished: fixture.fixture.status.short === 'FT',
      finished_provisional: fixture.fixture.status.short === 'FT',
      kickoff_time: fixture.fixture.date,
      kickoff_time_formatted: this.formatKickoffTime(fixture.fixture.date),
      minutes: fixture.fixture.status.elapsed || 0,
      provisional_start_time: false,
      started: ['1H', '2H', 'HT', 'FT', 'AET', 'PEN'].includes(fixture.fixture.status.short),
      team_a: fixture.teams.away.id,
      team_a_score: fixture.goals.away,
      team_a_name: fixture.teams.away.name,
      team_a_short: this.generateShortName(fixture.teams.away.name),
      team_h: fixture.teams.home.id,
      team_h_score: fixture.goals.home,
      team_h_name: fixture.teams.home.name,
      team_h_short: this.generateShortName(fixture.teams.home.name),
      team_h_difficulty: 3, // Default difficulty - could be enhanced
      team_a_difficulty: 3, // Default difficulty - could be enhanced
      stats: [], // Would need additional API calls for detailed stats
      pulse_id: fixture.fixture.id
    }));
  }

  /**
   * Get teams in FPL-compatible format
   */
  async getTeamsInFPLFormat(): Promise<any[]> {
    const teams = await this.getTeams();
    const standings = await this.getStandings();
    
    return teams.map(teamData => {
      const standing = standings[0]?.league?.standings?.[0]?.find(
        (s: any) => s.team.id === teamData.team.id
      );
      
      return {
        id: teamData.team.id,
        name: teamData.team.name,
        short_name: this.generateShortName(teamData.team.name),
        code: teamData.team.code || teamData.team.id,
        draw: standing?.all?.draw || 0,
        form: standing?.form || null,
        loss: standing?.all?.lose || 0,
        played: standing?.all?.played || 0,
        points: standing?.points || 0,
        position: standing?.rank || 0,
        strength: 3, // Default strength - could be enhanced
        team_division: null,
        unavailable: false,
        win: standing?.all?.win || 0,
        strength_overall_home: 3,
        strength_overall_away: 3,
        strength_attack_home: 3,
        strength_attack_away: 3,
        strength_defence_home: 3,
        strength_defence_away: 3,
        pulse_id: teamData.team.id
      };
    });
  }

  /**
   * Get current gameweek information
   */
  async getCurrentGameweek(): Promise<any> {
    const fixtures = await this.getFixtures();
    const now = new Date();
    
    // Find the current or next gameweek
    const upcomingFixtures = fixtures.filter(f => 
      new Date(f.fixture.date) > now || 
      ['1H', '2H', 'HT'].includes(f.fixture.status.short)
    );
    
    if (upcomingFixtures.length === 0) {
      // Season might be over, return the last gameweek
      const lastFixture = fixtures[fixtures.length - 1];
      return {
        id: this.extractGameweekFromRound(lastFixture.league.round),
        name: `Gameweek ${this.extractGameweekFromRound(lastFixture.league.round)}`,
        deadline_time: lastFixture.fixture.date,
        is_current: false,
        is_next: false,
        finished: true
      };
    }
    
    const nextFixture = upcomingFixtures[0];
    const gameweek = this.extractGameweekFromRound(nextFixture.league.round);
    
    return {
      id: gameweek,
      name: `Gameweek ${gameweek}`,
      deadline_time: nextFixture.fixture.date,
      is_current: ['1H', '2H', 'HT'].includes(nextFixture.fixture.status.short),
      is_next: nextFixture.fixture.status.short === 'NS',
      finished: false
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async makeRequest(endpoint: string, cacheKey: string, ttl: number): Promise<any> {
    // Check cache first
    const cached = this.getCachedData(cacheKey, ttl);
    if (cached) {
      console.log(`📦 API-Football cache hit for ${cacheKey}`);
      this.emit('cache-hit', { endpoint, cacheKey });
      return cached;
    }

    // Check rate limits
    if (!this.canMakeRequest()) {
      const waitTime = this.getWaitTime();
      console.log(`⏳ API-Football rate limited. Waiting ${Math.ceil(waitTime / 1000)}s`);
      await this.sleep(waitTime);
    }

    try {
      console.log(`🌐 Making API-Football request to ${endpoint}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);
      
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': this.config.apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(`Rate limited by API-Football. Status: ${response.status}`);
        }
        throw new Error(`API-Football error: ${response.status} ${response.statusText}`);
      }

      // Update rate limit tracking from response headers
      this.updateRateLimitFromHeaders(response);

      const data = await response.json();
      
      // API-Football wraps data in a response object
      const actualData = data.response || data;
      
      // Cache the response
      this.setCachedData(cacheKey, actualData, ttl);
      
      // Update rate limit counters
      this.rateLimit.requestsThisMinute++;
      this.rateLimit.requestsToday++;
      this.rateLimit.remainingMinute = Math.max(0, this.config.rateLimitPerMinute - this.rateLimit.requestsThisMinute);
      this.rateLimit.remainingDaily = Math.max(0, this.config.rateLimitPerDay - this.rateLimit.requestsToday);

      console.log(`✅ API-Football request successful. Remaining: ${this.rateLimit.remainingDaily}/day, ${this.rateLimit.remainingMinute}/minute`);
      this.emit('api-success', { endpoint, cacheKey, remainingDaily: this.rateLimit.remainingDaily });

      return actualData;

    } catch (error) {
      console.error(`❌ API-Football request failed for ${endpoint}:`, error);
      this.emit('api-error', { endpoint, cacheKey, error: error.message });
      throw error;
    }
  }

  private getCachedData(key: string, ttl: number): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCachedData(key: string, data: any, ttl: number) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private canMakeRequest(): boolean {
    this.resetRateLimitWindows();
    return this.rateLimit.remainingMinute > 0 && this.rateLimit.remainingDaily > 0;
  }

  private getWaitTime(): number {
    if (this.rateLimit.remainingDaily === 0) {
      // Wait until tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime() - Date.now();
    }
    
    if (this.rateLimit.remainingMinute === 0) {
      // Wait until next minute
      const nextMinute = this.rateLimit.minuteWindowStart + 60000;
      return nextMinute - Date.now();
    }
    
    return 0;
  }

  private resetRateLimitWindows() {
    const now = Date.now();
    
    // Reset minute window
    if (now - this.rateLimit.minuteWindowStart >= 60000) {
      this.rateLimit.requestsThisMinute = 0;
      this.rateLimit.minuteWindowStart = now;
      this.rateLimit.remainingMinute = this.config.rateLimitPerMinute;
    }
    
    // Reset daily window
    const todayStart = this.getDayStart();
    if (todayStart !== this.rateLimit.dayStart) {
      this.rateLimit.requestsToday = 0;
      this.rateLimit.dayStart = todayStart;
      this.rateLimit.remainingDaily = this.config.rateLimitPerDay;
    }
  }

  private updateRateLimitFromHeaders(response: Response) {
    const remaining = response.headers.get('x-ratelimit-requests-remaining');
    const limit = response.headers.get('x-ratelimit-requests-limit');
    
    if (remaining && limit) {
      this.rateLimit.remainingDaily = parseInt(remaining);
      console.log(`📊 API-Football rate limit from headers: ${remaining}/${limit}`);
    }
  }

  private getDayStart(): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }

  private startCacheCleanup() {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  private startRateLimitReset() {
    setInterval(() => {
      this.resetRateLimitWindows();
    }, 60 * 1000); // Every minute
  }

  private cleanupExpiredCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 API-Football cache cleaned: ${cleaned} entries removed`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractGameweekFromRound(round: string): number {
    // Extract gameweek number from round string like "Regular Season - 15"
    const match = round.match(/Regular Season - (\d+)/);
    return match ? parseInt(match[1]) : 1;
  }

  private generateShortName(fullName: string): string {
    // Generate short names for teams
    const shortNames: { [key: string]: string } = {
      'Manchester United': 'MUN',
      'Manchester City': 'MCI',
      'Liverpool': 'LIV',
      'Chelsea': 'CHE',
      'Arsenal': 'ARS',
      'Tottenham': 'TOT',
      'Newcastle': 'NEW',
      'Brighton': 'BHA',
      'Aston Villa': 'AVL',
      'West Ham': 'WHU',
      'Crystal Palace': 'CRY',
      'Fulham': 'FUL',
      'Wolverhampton Wanderers': 'WOL',
      'Everton': 'EVE',
      'Brentford': 'BRE',
      'Nottingham Forest': 'NFO',
      'Luton': 'LUT',
      'Burnley': 'BUR',
      'Sheffield United': 'SHU',
      'Bournemouth': 'BOU'
    };
    
    return shortNames[fullName] || fullName.substring(0, 3).toUpperCase();
  }

  private formatKickoffTime(dateString: string): string {
    const date = new Date(dateString);
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000)); // Convert to IST
    
    return istDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) + ' at ' + istDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // ==================== MONITORING & STATISTICS ====================

  getRateLimitStatus() {
    this.resetRateLimitWindows();
    return {
      daily: {
        used: this.rateLimit.requestsToday,
        remaining: this.rateLimit.remainingDaily,
        limit: this.config.rateLimitPerDay,
        resetTime: new Date(this.rateLimit.dayStart + 24 * 60 * 60 * 1000).toISOString()
      },
      minute: {
        used: this.rateLimit.requestsThisMinute,
        remaining: this.rateLimit.remainingMinute,
        limit: this.config.rateLimitPerMinute,
        resetTime: new Date(this.rateLimit.minuteWindowStart + 60 * 1000).toISOString()
      }
    };
  }

  getCacheStats() {
    const stats = {
      totalEntries: this.cache.size,
      cacheByType: {} as { [key: string]: number },
      memoryUsage: 0
    };

    for (const [key, entry] of this.cache) {
      const type = key.split('_')[0];
      stats.cacheByType[type] = (stats.cacheByType[type] || 0) + 1;
      stats.memoryUsage += JSON.stringify(entry.data).length;
    }

    return {
      ...stats,
      rateLimits: this.getRateLimitStatus(),
      config: {
        baseUrl: this.config.baseUrl,
        hasApiKey: !!this.config.apiKey,
        rateLimits: {
          daily: this.config.rateLimitPerDay,
          minute: this.config.rateLimitPerMinute
        }
      }
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down API-Football Service...');
    this.removeAllListeners();
    console.log('✅ API-Football Service shut down gracefully');
  }
}

export const apiFootballService = new APIFootballService();
export { APIFootballService, APIFootballConfig, APIFootballFixture, APIFootballTeam, APIFootballPlayer };
