// FPL API service with hourly caching (max 24 calls per day)

interface CacheEntry {
  data: any;
  timestamp: number;
}

interface FPLBootstrapData {
  events: Array<{
    id: number;
    name: string;
    deadline_time: string;
    is_current: boolean;
    is_next: boolean;
    finished: boolean;
  }>;
  game_settings: {
    league_join_private_max: number;
    league_join_public_max: number;
    league_max_size_public_classic: number;
    league_max_size_public_h2h: number;
    league_max_size_private_h2h: number;
    league_max_ko_rounds_private_h2h: number;
    league_prefix_public: string;
    league_points_h2h_win: number;
    league_points_h2h_lose: number;
    league_points_h2h_draw: number;
    league_ko_first_instead_of_random: boolean;
    cup_start_event_id: number;
    cup_stop_event_id: number;
    cup_qualifying_method: string;
    cup_type: string;
    squad_squadplay: number;
    squad_squadsize: number;
    squad_team_limit: number;
    squad_total_spend: number;
    ui_currency_multiplier: number;
    ui_use_special_shirts: boolean;
    ui_special_shirt_exclusions: any[];
    stats_form_days: number;
    sys_vice_captain_enabled: boolean;
    transfers_cap: number;
    transfers_sell_on_fee: number;
    league_h2h_tiebreak_stats: string[];
    timezone: string;
  };
  phases: Array<{
    id: number;
    name: string;
    start_event: number;
    stop_event: number;
  }>;
  teams: Array<{
    code: number;
    draw: number;
    form: string | null;
    id: number;
    loss: number;
    name: string;
    played: number;
    points: number;
    position: number;
    short_name: string;
    strength: number;
    team_division: number | null;
    unavailable: boolean;
    win: number;
    strength_overall_home: number;
    strength_overall_away: number;
    strength_attack_home: number;
    strength_attack_away: number;
    strength_defence_home: number;
    strength_defence_away: number;
    pulse_id: number;
  }>;
  total_players: number;
  elements: Array<{
    chance_of_playing_next_round: number | null;
    chance_of_playing_this_round: number | null;
    code: number;
    cost_change_event: number;
    cost_change_event_fall: number;
    cost_change_start: number;
    cost_change_start_fall: number;
    dreamteam_count: number;
    element_type: number;
    ep_next: string | null;
    ep_this: string | null;
    event_points: number;
    first_name: string;
    form: string;
    id: number;
    in_dreamteam: boolean;
    news: string;
    news_added: string | null;
    now_cost: number;
    photo: string;
    points_per_game: string;
    second_name: string;
    selected_by_percent: string;
    special: boolean;
    squad_number: number | null;
    status: string;
    team: number;
    team_code: number;
    total_points: number;
    transfers_in: number;
    transfers_in_event: number;
    transfers_out: number;
    transfers_out_event: number;
    value_form: string;
    value_season: string;
    web_name: string;
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
    starts: number;
    expected_goals: string;
    expected_assists: string;
    expected_goal_involvements: string;
    expected_goals_conceded: string;
    influence_rank: number;
    influence_rank_type: number;
    creativity_rank: number;
    creativity_rank_type: number;
    threat_rank: number;
    threat_rank_type: number;
    ict_index_rank: number;
    ict_index_rank_type: number;
    corners_and_indirect_freekicks_order: number | null;
    corners_and_indirect_freekicks_text: string;
    direct_freekicks_order: number | null;
    direct_freekicks_text: string;
    penalties_order: number | null;
    penalties_text: string;
    expected_goals_per_90: number;
    saves_per_90: number;
    expected_assists_per_90: number;
    expected_goal_involvements_per_90: number;
    expected_goals_conceded_per_90: number;
    goals_conceded_per_90: number;
    now_cost_rank: number;
    now_cost_rank_type: number;
    form_rank: number;
    form_rank_type: number;
    points_per_game_rank: number;
    points_per_game_rank_type: number;
    selected_rank: number;
    selected_rank_type: number;
    starts_per_90: number;
    clean_sheets_per_90: number;
  }>;
  element_stats: Array<{
    label: string;
    name: string;
  }>;
  element_types: Array<{
    id: number;
    plural_name: string;
    plural_name_short: string;
    singular_name: string;
    singular_name_short: string;
    squad_select: number;
    squad_min_play: number;
    squad_max_play: number;
    ui_shirt_specific: boolean;
    sub_positions_locked: number[];
    element_count: number;
  }>;
}

interface FPLFixture {
  code: number;
  event: number;
  finished: boolean;
  finished_provisional: boolean;
  id: number;
  kickoff_time: string;
  minutes: number;
  provisional_start_time: boolean;
  started: boolean;
  team_a: number;
  team_a_score: number | null;
  team_h: number;
  team_h_score: number | null;
  stats: any[];
  team_h_difficulty: number;
  team_a_difficulty: number;
  pulse_id: number;
}

class FPLAPIService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly BASE_URL = 'https://fantasy.premierleague.com/api';
  private callCount = 0;
  private lastResetDate = new Date().toDateString();

  private resetDailyCallCount() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.callCount = 0;
      this.lastResetDate = today;
    }
  }

  private canMakeAPICall(): boolean {
    this.resetDailyCallCount();
    return this.callCount < 24;
  }

  private async makeAPICall(endpoint: string): Promise<any> {
    if (!this.canMakeAPICall()) {
      throw new Error('Daily API call limit exceeded (24 calls per day)');
    }

    const cacheKey = endpoint;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // Return cached data if it's still valid
    if (cached && (now - cached.timestamp < this.CACHE_DURATION)) {
      console.log(`Serving ${endpoint} from cache`);
      return cached.data;
    }

    try {
      console.log(`Making API call to ${endpoint} (${this.callCount + 1}/24 calls today)`);
      const response = await fetch(`${this.BASE_URL}${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`FPL API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: now
      });

      this.callCount++;
      console.log(`Successfully cached ${endpoint}. API calls today: ${this.callCount}/24`);
      
      return data;
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error);
      throw error;
    }
  }

  async getBootstrapData(): Promise<FPLBootstrapData> {
    return this.makeAPICall('/bootstrap-static/');
  }

  async getFixtures(gameweek?: number): Promise<FPLFixture[]> {
    const endpoint = gameweek ? `/fixtures/?event=${gameweek}` : '/fixtures/';
    return this.makeAPICall(endpoint);
  }

  async getCurrentGameweek(): Promise<any> {
    const bootstrap = await this.getBootstrapData();
    const currentEvent = bootstrap.events.find(event => event.is_current) || 
                        bootstrap.events.find(event => event.is_next) ||
                        bootstrap.events[0];
    
    return currentEvent;
  }

  async getPlayers(): Promise<any[]> {
    const bootstrap = await this.getBootstrapData();
    return bootstrap.elements;
  }

  async getTeams(): Promise<any[]> {
    const bootstrap = await this.getBootstrapData();
    return bootstrap.teams;
  }

  async getElementTypes(): Promise<any[]> {
    const bootstrap = await this.getBootstrapData();
    return bootstrap.element_types;
  }

  // Get gameweek deadline (2 hours before first match)
  async getGameweekDeadline(gameweek: number): Promise<string> {
    const fixtures = await this.getFixtures(gameweek);
    
    if (fixtures.length === 0) {
      throw new Error(`No fixtures found for gameweek ${gameweek}`);
    }

    // Find the earliest kickoff time for the gameweek
    const earliestFixture = fixtures.reduce((earliest, fixture) => {
      const fixtureKickoff = new Date(fixture.kickoff_time);
      const earliestKickoff = new Date(earliest.kickoff_time);
      return fixtureKickoff < earliestKickoff ? fixture : earliest;
    });

    // Deadline is 2 hours before the first match
    const deadline = new Date(earliestFixture.kickoff_time);
    deadline.setHours(deadline.getHours() - 2);
    
    return deadline.toISOString();
  }

  // Enhanced fixtures with team names
  async getFixturesWithTeamNames(gameweek?: number): Promise<any[]> {
    const fixtures = await this.getFixtures(gameweek);
    const teams = await this.getTeams();
    
    return fixtures.map(fixture => {
      const homeTeam = teams.find(team => team.id === fixture.team_h);
      const awayTeam = teams.find(team => team.id === fixture.team_a);
      
      return {
        ...fixture,
        team_h_name: homeTeam?.name || 'Unknown',
        team_a_name: awayTeam?.name || 'Unknown',
        team_h_short: homeTeam?.short_name || 'UNK',
        team_a_short: awayTeam?.short_name || 'UNK'
      };
    });
  }

  // Get cache statistics
  getCacheStats() {
    this.resetDailyCallCount();
    return {
      cacheSize: this.cache.size,
      apiCallsToday: this.callCount,
      remainingCalls: 24 - this.callCount,
      lastResetDate: this.lastResetDate
    };
  }
}

export const fplAPI = new FPLAPIService();