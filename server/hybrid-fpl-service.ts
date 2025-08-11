// Hybrid FPL service that switches between RapidAPI FPL API and API-Football based on availability
import { EventEmitter } from 'events';
import { rapidAPIFPLService } from './rapidapi-fpl-service';
import { apiFootballService } from './api-football-service';

type DataSource = 'rapidapi-fpl' | 'api-football' | 'hybrid';
type FallbackStrategy = 'api-football-first' | 'rapidapi-fpl-first' | 'api-football-only' | 'rapidapi-fpl-only';

interface HybridConfig {
  primarySource: DataSource;
  fallbackStrategy: FallbackStrategy;
  enableAutoSwitching: boolean;
  apiFootballApiKey?: string;
  maxRetries: number;
  retryDelay: number;
}

interface DataSourceStatus {
  name: string;
  available: boolean;
  lastSuccess: number;
  lastError: number | null;
  errorCount: number;
  rateLimitHit: boolean;
  nextAvailable?: number;
}

class HybridFPLService extends EventEmitter {
  private config: HybridConfig;
  private sourceStatus: Map<string, DataSourceStatus> = new Map();
  private currentSource: DataSource = 'rapidapi-fpl';
  
  constructor(config: Partial<HybridConfig> = {}) {
    super();
    
    this.config = {
      primarySource: config.primarySource || 'rapidapi-fpl',
      fallbackStrategy: config.fallbackStrategy || 'rapidapi-fpl-first',
      enableAutoSwitching: config.enableAutoSwitching !== false,
      apiFootballApiKey: config.apiFootballApiKey || process.env.API_FOOTBALL_KEY,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 2000,
      ...config
    };

    this.initializeSourceStatus();
    this.startHealthCheck();
    
    // Listen to source events
    this.setupEventListeners();
  }

  // ==================== PUBLIC API METHODS ====================

  // ALWAYS use RapidAPI FPL for players (critical for scoring and player data accuracy)
  async getPlayers(): Promise<any[]> {
    console.log('🎯 Using RapidAPI FPL for players (required for scoring accuracy)');
    return this.executeOnSource('rapidapi-fpl', 'getPlayers');
  }

  // Use RapidAPI FPL for teams (consistent with player data)
  async getTeams(): Promise<any[]> {
    console.log('🎯 Using RapidAPI FPL for teams');
    return this.executeOnSource('rapidapi-fpl', 'getTeams');
  }

  // ALWAYS use API-Football for fixtures (better reliability and real-time data)
  async getFixtures(gameweek?: number): Promise<any[]> {
    if (this.config.apiFootballApiKey && this.isSourceAvailable('api-football')) {
      console.log('⚽ Using API-Football for fixtures (enhanced reliability)');
      try {
        return await this.executeOnSource('api-football', 'getFixtures', gameweek);
      } catch (error) {
        console.warn('⚠️ API-Football failed for fixtures, falling back to RapidAPI FPL:', error.message);
        return this.executeOnSource('rapidapi-fpl', 'getFixtures', gameweek);
      }
    }
    console.log('🎯 Using RapidAPI FPL for fixtures (API-Football not available)');
    return this.executeOnSource('rapidapi-fpl', 'getFixtures', gameweek);
  }

  // Use API-Football for fixtures with team names for better real-time data
  async getFixturesWithTeamNames(gameweek?: number): Promise<any[]> {
    if (this.config.apiFootballApiKey && this.isSourceAvailable('api-football')) {
      console.log('⚽ Using API-Football for fixtures with team names');
      try {
        return await this.executeOnSource('api-football', 'getFixturesWithTeamNames', gameweek);
      } catch (error) {
        console.warn('⚠️ API-Football failed, falling back to RapidAPI FPL for fixtures:', error.message);
        // Fall back to RapidAPI FPL with team name formatting
        const fixtures = await this.executeOnSource('rapidapi-fpl', 'getFixtures', gameweek);
        const teams = await this.executeOnSource('rapidapi-fpl', 'getTeams');
        return this.formatFixturesWithTeamNames(fixtures, teams);
      }
    }
    
    console.log('🎯 Using RapidAPI FPL for fixtures with team names');
    const fixtures = await this.executeOnSource('rapidapi-fpl', 'getFixtures', gameweek);
    const teams = await this.executeOnSource('rapidapi-fpl', 'getTeams');
    return this.formatFixturesWithTeamNames(fixtures, teams);
  }

  // Always use RapidAPI FPL for gameweek data (critical for scoring)
  async getCurrentGameweek(): Promise<any> {
    console.log('🎯 Using RapidAPI FPL for current gameweek (required for scoring)');
    return this.executeOnSource('rapidapi-fpl', 'getCurrentGameweek');
  }

  // ALWAYS use RapidAPI FPL for live data and scoring
  async getLiveData(gameweek: number): Promise<any> {
    console.log('🎯 Using RapidAPI FPL for live data (required for accurate scoring)');
    if (this.isSourceAvailable('rapidapi-fpl')) {
      return this.executeOnSource('rapidapi-fpl', 'getLiveData', gameweek);
    }
    throw new Error('Live data not available - RapidAPI FPL is not accessible');
  }

  // ==================== SOURCE MANAGEMENT ====================

  private async executeWithFallback(method: string, ...args: any[]): Promise<any> {
    const strategy = this.config.fallbackStrategy;
    const sources = this.getFallbackOrder(strategy);
    
    let lastError: Error | null = null;
    
    for (const source of sources) {
      if (!this.isSourceAvailable(source)) {
        console.log(`⚠️ Skipping ${source} - not available`);
        continue;
      }

      try {
        console.log(`🔄 Attempting ${method} with ${source}`);
        const result = await this.executeOnSource(source, method, ...args);
        
        // Update success status
        this.updateSourceStatus(source, true);
        
        // Switch current source if auto-switching is enabled
        if (this.config.enableAutoSwitching && this.currentSource !== source) {
          console.log(`🔀 Auto-switching to ${source} for better performance`);
          this.currentSource = source as DataSource;
          this.emit('source-switched', { from: this.currentSource, to: source, reason: 'success' });
        }
        
        return result;
        
      } catch (error) {
        console.error(`❌ ${method} failed with ${source}:`, error.message);
        lastError = error as Error;
        
        // Update error status
        this.updateSourceStatus(source, false, error as Error);
        
        // Check if it's a rate limit error
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          this.markSourceRateLimited(source);
        }
        
        // Continue to next source
        continue;
      }
    }
    
    // All sources failed
    throw new Error(`All data sources failed for ${method}. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  private async executeOnSource(source: string, method: string, ...args: any[]): Promise<any> {
    switch (source) {
      case 'rapidapi-fpl':
        return this.executeOnRapidAPIFPL(method, ...args);
        
      case 'api-football':
        return this.executeOnAPIFootball(method, ...args);
        
      default:
        throw new Error(`Unknown data source: ${source}`);
    }
  }

  private async executeOnRapidAPIFPL(method: string, ...args: any[]): Promise<any> {
    switch (method) {
      case 'getPlayers':
        return rapidAPIFPLService.getPlayers();
      case 'getTeams':
        return rapidAPIFPLService.getTeams();
      case 'getFixtures':
        return rapidAPIFPLService.getFixtures(...args);
      case 'getFixturesWithTeamNames':
        return rapidAPIFPLService.getFixturesWithTeamNames(...args);
      case 'getCurrentGameweek':
        return rapidAPIFPLService.getCurrentGameweek();
      case 'getLiveData':
        return rapidAPIFPLService.getLiveData(...args);
      case 'getElementSummary':
        return rapidAPIFPLService.getElementSummary(...args);
      default:
        throw new Error(`Method ${method} not supported on RapidAPI FPL`);
    }
  }

  private async executeOnAPIFootball(method: string, ...args: any[]): Promise<any> {
    if (!this.config.apiFootballApiKey) {
      throw new Error('API-Football API key not configured');
    }

    switch (method) {
      case 'getPlayers':
        // Convert API-Football players to FPL format
        return this.convertAPIFootballPlayersToFPL(await apiFootballService.getAllPlayers());
      case 'getTeams':
        return apiFootballService.getTeamsInFPLFormat();
      case 'getFixtures':
        return apiFootballService.getFixtures(...args);
      case 'getFixturesWithTeamNames':
        return apiFootballService.getFixturesWithTeamNames(...args);
      case 'getCurrentGameweek':
        return apiFootballService.getCurrentGameweek();
      default:
        throw new Error(`Method ${method} not supported on API-Football`);
    }
  }

  // ==================== DATA CONVERSION HELPERS ====================

  private async formatFixturesWithTeamNames(fixtures: any[], teams: any[]): Promise<any[]> {
    return fixtures.map(fixture => {
      const homeTeam = teams.find(team => team.id === fixture.team_h);
      const awayTeam = teams.find(team => team.id === fixture.team_a);
      
      return {
        ...fixture,
        team_h_name: homeTeam?.name || 'Unknown',
        team_a_name: awayTeam?.name || 'Unknown',
        team_h_short: homeTeam?.short_name || 'UNK',
        team_a_short: awayTeam?.short_name || 'UNK',
      };
    });
  }

  private convertAPIFootballPlayersToFPL(apiFootballPlayers: any[]): any[] {
    // This is a complex conversion that would need to map API-Football player data
    // to FPL format. For now, return empty array with warning.
    console.warn('⚠️ API-Football to FPL player conversion not fully implemented');
    
    return apiFootballPlayers.map((playerData, index) => ({
      // Basic mapping - would need extensive work for full compatibility
      id: playerData.player.id || index + 1000000, // Offset to avoid conflicts
      first_name: playerData.player.firstname || '',
      second_name: playerData.player.lastname || playerData.player.name,
      web_name: playerData.player.name,
      team: playerData.statistics[0]?.team?.id || 1,
      element_type: this.mapPositionToElementType(playerData.statistics[0]?.games?.position || 'Unknown'),
      now_cost: 50, // Default price - would need actual FPL pricing
      total_points: playerData.statistics[0]?.goals?.total || 0,
      status: playerData.player.injured ? 'i' : 'a',
      // ... many more fields would need mapping
    }));
  }

  private mapPositionToElementType(position: string): number {
    const positionMap: { [key: string]: number } = {
      'Goalkeeper': 1,
      'Defender': 2,
      'Midfielder': 3,
      'Attacker': 4,
      'Forward': 4,
    };
    
    return positionMap[position] || 3; // Default to midfielder
  }

  // ==================== SOURCE STATUS MANAGEMENT ====================

  private initializeSourceStatus() {
    this.sourceStatus.set('rapidapi-fpl', {
      name: 'RapidAPI FPL',
      available: true,
      lastSuccess: Date.now(),
      lastError: null,
      errorCount: 0,
      rateLimitHit: false
    });

    this.sourceStatus.set('api-football', {
      name: 'API-Football',
      available: !!this.config.apiFootballApiKey,
      lastSuccess: this.config.apiFootballApiKey ? Date.now() : 0,
      lastError: this.config.apiFootballApiKey ? null : Date.now(),
      errorCount: this.config.apiFootballApiKey ? 0 : 1,
      rateLimitHit: false
    });
  }

  private updateSourceStatus(source: string, success: boolean, error?: Error) {
    const status = this.sourceStatus.get(source);
    if (!status) return;

    if (success) {
      status.lastSuccess = Date.now();
      status.errorCount = 0;
      status.available = true;
      status.rateLimitHit = false;
      status.nextAvailable = undefined;
    } else {
      status.lastError = Date.now();
      status.errorCount++;
      
      // Mark as unavailable if too many errors
      if (status.errorCount >= this.config.maxRetries) {
        status.available = false;
        // Try again in 5 minutes
        status.nextAvailable = Date.now() + 5 * 60 * 1000;
      }
    }
    
    this.emit('source-status-updated', { source, status });
  }

  private markSourceRateLimited(source: string) {
    const status = this.sourceStatus.get(source);
    if (!status) return;

    status.rateLimitHit = true;
    status.available = false;
    
    // Different recovery times for different sources
    if (source === 'rapidapi-fpl') {
      // RapidAPI FPL - wait 1 hour
      status.nextAvailable = Date.now() + 60 * 60 * 1000;
    } else if (source === 'api-football') {
      // API-Football - check rate limit type
      const rateLimitStatus = apiFootballService.getRateLimitStatus();
      if (rateLimitStatus.daily.remaining === 0) {
        // Daily limit hit - wait until tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        status.nextAvailable = tomorrow.getTime();
      } else {
        // Minute limit hit - wait 1 minute
        status.nextAvailable = Date.now() + 60 * 1000;
      }
    }
    
    this.emit('source-rate-limited', { source, nextAvailable: status.nextAvailable });
  }

  private isSourceAvailable(source: string): boolean {
    const status = this.sourceStatus.get(source);
    if (!status) return false;

    // Check if source is marked as available
    if (!status.available) {
      // Check if it should be available again
      if (status.nextAvailable && Date.now() > status.nextAvailable) {
        status.available = true;
        status.rateLimitHit = false;
        status.nextAvailable = undefined;
        status.errorCount = 0;
        console.log(`🟢 ${source} is available again`);
        return true;
      }
      return false;
    }

    return true;
  }

  private getFallbackOrder(strategy: FallbackStrategy): string[] {
    switch (strategy) {
      case 'api-football-first':
        return ['api-football', 'rapidapi-fpl'];
      case 'rapidapi-fpl-first':
        return ['rapidapi-fpl', 'api-football'];
      case 'api-football-only':
        return ['api-football'];
      case 'rapidapi-fpl-only':
        return ['rapidapi-fpl'];
      default:
        return ['rapidapi-fpl', 'api-football'];
    }
  }

  // ==================== HEALTH CHECK & MONITORING ====================

  private startHealthCheck() {
    // Check source health every 5 minutes
    setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  private async performHealthCheck() {
    for (const [sourceName] of this.sourceStatus) {
      try {
        // Simple health check - try to get teams (usually cached)
        await this.executeOnSource(sourceName, 'getTeams');
        this.updateSourceStatus(sourceName, true);
      } catch (error) {
        // Don't update error status for health checks to avoid false negatives
        console.log(`🔍 Health check failed for ${sourceName}:`, error.message);
      }
    }
  }

  private setupEventListeners() {
    // Listen to circuit breaker events from RapidAPI FPL
    rapidAPIFPLService.on('circuit-breaker-open', () => {
      console.log('🔴 RapidAPI FPL circuit breaker opened, switching to API-Football');
      this.updateSourceStatus('rapidapi-fpl', false);
      this.emit('source-switched', { from: 'rapidapi-fpl', to: 'api-football', reason: 'circuit-breaker' });
    });

    // Listen to API-Football events
    apiFootballService.on('api-error', (data) => {
      if (data.error.includes('rate limit')) {
        this.markSourceRateLimited('api-football');
      }
    });
  }

  // ==================== PUBLIC MONITORING METHODS ====================

  getSourceStatus(): Map<string, DataSourceStatus> {
    return this.sourceStatus;
  }

  getCurrentSource(): DataSource {
    return this.currentSource;
  }

  async switchSource(source: DataSource): Promise<void> {
    if (!this.isSourceAvailable(source)) {
      throw new Error(`Cannot switch to ${source} - source is not available`);
    }
    
    const oldSource = this.currentSource;
    this.currentSource = source;
    
    console.log(`🔀 Manually switched from ${oldSource} to ${source}`);
    this.emit('source-switched', { from: oldSource, to: source, reason: 'manual' });
  }

  getComprehensiveStatus() {
    const rapidAPIFPLStats = rapidAPIFPLService.getCacheStats();
    const apiFootballStats = apiFootballService.getCacheStats();
    
    return {
      currentSource: this.currentSource,
      config: {
        primarySource: this.config.primarySource,
        fallbackStrategy: this.config.fallbackStrategy,
        enableAutoSwitching: this.config.enableAutoSwitching,
        hasApiFootballKey: !!this.config.apiFootballApiKey
      },
      sources: {
        'rapidapi-fpl': {
          status: this.sourceStatus.get('rapidapi-fpl'),
          stats: rapidAPIFPLStats
        },
        'api-football': {
          status: this.sourceStatus.get('api-football'),
          stats: apiFootballStats
        }
      },
      recommendations: this.generateRecommendations()
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const rapidAPIFPLStatus = this.sourceStatus.get('rapidapi-fpl');
    const apiFootballStatus = this.sourceStatus.get('api-football');
    
    if (!this.config.apiFootballApiKey) {
      recommendations.push('⚽ Add API-Football API key for enhanced fixture reliability and real-time data');
    }
    
    if (rapidAPIFPLStatus?.rateLimitHit) {
      recommendations.push('🎯 RapidAPI FPL rate limit hit - this affects player data and scoring. Increase cache TTL.');
    }
    
    if (apiFootballStatus?.rateLimitHit) {
      recommendations.push('⚽ API-Football rate limit hit - fixtures fallback to RapidAPI FPL. Consider optimizing fixture requests.');
    }
    
    if (rapidAPIFPLStatus?.errorCount && rapidAPIFPLStatus.errorCount > 0) {
      recommendations.push('❌ RapidAPI FPL experiencing issues - this impacts player data and scoring accuracy!');
    }
    
    if (apiFootballStatus?.errorCount && apiFootballStatus.errorCount > 0) {
      recommendations.push('⚽ API-Football issues detected - fixtures will fallback to RapidAPI FPL');
    }
    
    recommendations.push('ℹ️ Configuration: API-Football for fixtures only, RapidAPI FPL for players and scoring');
    
    return recommendations;
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down Hybrid FPL Service...');
    
    await Promise.all([
      rapidAPIFPLService.shutdown(),
      apiFootballService.shutdown()
    ]);
    
    this.removeAllListeners();
    console.log('✅ Hybrid FPL Service shut down gracefully');
  }
}

export const hybridFplService = new HybridFPLService({
  primarySource: 'rapidapi-fpl', // RapidAPI FPL is primary for players and scoring
  fallbackStrategy: 'rapidapi-fpl-first', // RapidAPI FPL first for non-fixture data
  enableAutoSwitching: false, // Manual control for specialized usage
  maxRetries: 2,
  retryDelay: 1000
});

export { HybridFPLService, HybridConfig, DataSource, FallbackStrategy, DataSourceStatus };
