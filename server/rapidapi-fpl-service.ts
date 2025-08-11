// RapidAPI Fantasy Premier League service with advanced rate limiting and caching
import { EventEmitter } from 'events';

interface RapidAPIFPLConfig {
  apiKey: string;
  baseUrl: string;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  timeout: number;
}

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
  lastModified?: string;
  hitCount: number;
}

interface RequestConfig {
  priority: 'low' | 'medium' | 'high';
  retries?: number;
  timeout?: number;
  cacheTTL?: number;
}

interface QueuedRequest {
  id: string;
  endpoint: string;
  config: RequestConfig;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  retryCount: number;
}

interface RateLimitInfo {
  requestsInWindow: number;
  windowStart: number;
  windowSize: number;
  maxRequests: number;
  nextResetTime: number;
  requestsToday: number;
  dailyWindowStart: number;
  maxDailyRequests: number;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

class RapidAPIFPLService extends EventEmitter {
  // Cache layers
  private memoryCache: Map<string, CacheEntry> = new Map();
  private persistentCache: Map<string, CacheEntry> = new Map();
  
  // Request management
  private requestQueue: QueuedRequest[] = [];
  private activeRequests: Map<string, Promise<any>> = new Map();
  private isProcessingQueue = false;
  
  // Rate limiting
  private rateLimitInfo: RateLimitInfo;
  
  // Circuit breaker
  private circuitBreaker: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0
  };
  
  // Configuration
  private config: RapidAPIFPLConfig;
  
  private readonly DEFAULT_CACHE_TTL = {
    'bootstrap-static': 24 * 60 * 60 * 1000,     // 24 hours (almost never changes during season)
    'fixtures': 12 * 60 * 60 * 1000,             // 12 hours (fixtures don't change often)
    'fixtures-gameweek': 6 * 60 * 60 * 1000,     // 6 hours for specific gameweek
    'element-summary': 8 * 60 * 60 * 1000,       // 8 hours for player data
    'event-live': 30 * 60 * 1000,                // 30 minutes during matches
    'event-live-active': 10 * 60 * 1000,         // 10 minutes when matches are active
    'entry': 60 * 60 * 1000,                     // 1 hour for user data
    'leagues': 2 * 60 * 60 * 1000,               // 2 hours for league data
    default: 4 * 60 * 60 * 1000                  // 4 hours default
  };
  
  private readonly RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  constructor(config: Partial<RapidAPIFPLConfig> = {}) {
    super();
    
    this.config = {
      apiKey: config.apiKey || process.env.RAPIDAPI_KEY || '1ad76774bemshedd3d1cee65e951p14c61ejsn7432633e9952',
      baseUrl: config.baseUrl || 'https://fantasy-premier-league-fpl-api.p.rapidapi.com',
      rateLimitPerMinute: config.rateLimitPerMinute || 5,  // Very conservative for Basic plan
      rateLimitPerDay: config.rateLimitPerDay || 15,      // Very conservative daily limit (500/month)
      timeout: config.timeout || 15000, // 15 seconds
      ...config
    };

    if (!this.config.apiKey) {
      console.warn('⚠️  RapidAPI FPL API key not provided. Set RAPIDAPI_KEY environment variable.');
    } else {
      console.log('✅ RapidAPI FPL service initialized');
    }

    // Initialize rate limiting
    const now = Date.now();
    this.rateLimitInfo = {
      requestsInWindow: 0,
      windowStart: now,
      windowSize: 60 * 1000, // 1 minute
      maxRequests: this.config.rateLimitPerMinute,
      nextResetTime: now + 60 * 1000,
      requestsToday: 0,
      dailyWindowStart: this.getDayStart(),
      maxDailyRequests: this.config.rateLimitPerDay
    };

    this.startQueueProcessor();
    this.startCacheCleanup();
    this.loadPersistentCache();
    console.log('🚀 RapidAPI FPL Service fully initialized with enhanced caching and rate limiting');
  }

  // ==================== PUBLIC API METHODS ====================

  async getBootstrapData(): Promise<any> {
    return this.makeRequest('/api/bootstrap-static/', { 
      priority: 'high',
      cacheTTL: this.DEFAULT_CACHE_TTL['bootstrap-static']
    });
  }

  async getFixtures(gameweek?: number): Promise<any> {
    const endpoint = gameweek ? `/api/fixtures/?event=${gameweek}` : '/api/fixtures/';
    const cacheKey = gameweek ? 'fixtures-gameweek' : 'fixtures';
    
    return this.makeRequest(endpoint, { 
      priority: 'medium',
      cacheTTL: this.DEFAULT_CACHE_TTL[cacheKey]
    });
  }

  async getElementSummary(playerId: number): Promise<any> {
    return this.makeRequest(`/api/element-summary/${playerId}/`, {
      priority: 'medium',
      cacheTTL: this.DEFAULT_CACHE_TTL['element-summary']
    });
  }

  async getLiveData(gameweek: number): Promise<any> {
    // Check if matches are currently active for shorter cache
    const isMatchDay = await this.isMatchDayActive(gameweek);
    const cacheTTL = isMatchDay 
      ? this.DEFAULT_CACHE_TTL['event-live-active']
      : this.DEFAULT_CACHE_TTL['event-live'];

    return this.makeRequest(`/api/event/${gameweek}/live/`, {
      priority: 'high',
      cacheTTL
    });
  }

  async getManagerData(managerId: number): Promise<any> {
    return this.makeRequest(`/api/entry/${managerId}/`, {
      priority: 'low',
      cacheTTL: this.DEFAULT_CACHE_TTL['entry']
    });
  }

  async getManagerHistory(managerId: number): Promise<any> {
    return this.makeRequest(`/api/entry/${managerId}/history/`, {
      priority: 'low',
      cacheTTL: this.DEFAULT_CACHE_TTL['entry']
    });
  }

  async getManagerPicks(managerId: number, gameweek: number): Promise<any> {
    return this.makeRequest(`/api/entry/${managerId}/event/${gameweek}/picks/`, {
      priority: 'low',
      cacheTTL: this.DEFAULT_CACHE_TTL['entry']
    });
  }

  async getClassicLeague(leagueId: number, page: number = 1): Promise<any> {
    return this.makeRequest(`/api/leagues-classic/${leagueId}/standings/?page_standings=${page}`, {
      priority: 'low',
      cacheTTL: this.DEFAULT_CACHE_TTL['leagues']
    });
  }

  // Enhanced versions of existing methods for compatibility
  async getCurrentGameweek(): Promise<any> {
    const bootstrap = await this.getBootstrapData();
    return bootstrap.events.find((event: any) => event.is_current) || 
           bootstrap.events.find((event: any) => event.is_next) ||
           bootstrap.events[0];
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

  // Enhanced fixtures with team names and IST times (maintaining compatibility)
  async getFixturesWithTeamNames(gameweek?: number): Promise<any[]> {
    const fixtures = await this.getFixtures(gameweek);
    const teams = await this.getTeams();
    
    return fixtures.map((fixture: any) => {
      const homeTeam = teams.find((team: any) => team.id === fixture.team_h);
      const awayTeam = teams.find((team: any) => team.id === fixture.team_a);
      const kickoffIST = this.convertToIST(fixture.kickoff_time);
      
      return {
        ...fixture,
        team_h_name: homeTeam?.name || 'Unknown',
        team_a_name: awayTeam?.name || 'Unknown',
        team_h_short: homeTeam?.short_name || 'UNK',
        team_a_short: awayTeam?.short_name || 'UNK',
        kickoff_time_utc: kickoffIST.utc,
        kickoff_time_ist: kickoffIST.ist,
        kickoff_time_ist_formatted: `${kickoffIST.istDate} at ${kickoffIST.istTime}`,
        kickoff_date_ist: kickoffIST.istDate,
        kickoff_time_ist_only: kickoffIST.istTime
      };
    });
  }

  async getGameweekDeadline(gameweek: number): Promise<string> {
    const fixtures = await this.getFixtures(gameweek);
    
    if (fixtures.length === 0) {
      throw new Error(`No fixtures found for gameweek ${gameweek}`);
    }

    // Find the earliest kickoff time for the gameweek
    const earliestFixture = fixtures.reduce((earliest: any, fixture: any) => {
      const fixtureKickoff = new Date(fixture.kickoff_time);
      const earliestKickoff = new Date(earliest.kickoff_time);
      return fixtureKickoff < earliestKickoff ? fixture : earliest;
    });

    // Deadline is 2 hours before the first match
    const deadline = new Date(earliestFixture.kickoff_time);
    deadline.setHours(deadline.getHours() - 2);
    
    return deadline.toISOString();
  }

  // ==================== ENHANCED REQUEST HANDLING ====================

  private async makeRequest(endpoint: string, config: RequestConfig = { priority: 'medium' }): Promise<any> {
    const cacheKey = this.generateCacheKey(endpoint);
    
    // Check if request is already in progress (deduplication)
    const activeRequest = this.activeRequests.get(cacheKey);
    if (activeRequest) {
      console.log(`🔄 Deduplicating RapidAPI FPL request for ${endpoint}`);
      return activeRequest;
    }

    // Check cache first
    const cached = this.getCachedData(cacheKey, config.cacheTTL);
    if (cached) {
      console.log(`📦 RapidAPI FPL cache hit for ${endpoint} (age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
      this.emit('cache-hit', { endpoint, age: Date.now() - cached.timestamp });
      return cached.data;
    }

    // Check circuit breaker
    if (this.circuitBreaker.state === 'open') {
      if (Date.now() < this.circuitBreaker.nextAttemptTime) {
        throw new Error(`RapidAPI FPL circuit breaker is open. Next attempt allowed at ${new Date(this.circuitBreaker.nextAttemptTime).toISOString()}`);
      } else {
        this.circuitBreaker.state = 'half-open';
      }
    }

    // Create and queue the request
    const requestPromise = new Promise<any>((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: `${endpoint}-${Date.now()}`,
        endpoint,
        config,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0
      };
      
      // Insert based on priority
      this.insertRequestByPriority(queuedRequest);
    });

    this.activeRequests.set(cacheKey, requestPromise);
    
    // Clean up active requests when done
    requestPromise.finally(() => {
      this.activeRequests.delete(cacheKey);
    });

    return requestPromise;
  }

  private insertRequestByPriority(request: QueuedRequest) {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const requestPriority = priorityOrder[request.config.priority];
    
    let insertIndex = this.requestQueue.length;
    for (let i = 0; i < this.requestQueue.length; i++) {
      const queuePriority = priorityOrder[this.requestQueue[i].config.priority];
      if (requestPriority < queuePriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.requestQueue.splice(insertIndex, 0, request);
    console.log(`📥 Queued ${request.config.priority} priority RapidAPI FPL request for ${request.endpoint} (queue size: ${this.requestQueue.length})`);
  }

  // ==================== QUEUE PROCESSOR ====================

  private startQueueProcessor() {
    setInterval(async () => {
      if (!this.isProcessingQueue && this.requestQueue.length > 0) {
        await this.processQueue();
      }
    }, 100); // Check every 100ms
  }

  private async processQueue() {
    if (this.requestQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Check if we can make a request (rate limiting)
      if (!this.canMakeRequest()) {
        const waitTime = this.getWaitTimeForNextRequest();
        console.log(`⏳ RapidAPI FPL rate limited. Waiting ${Math.ceil(waitTime / 1000)}s for next request`);
        setTimeout(() => { this.isProcessingQueue = false; }, waitTime);
        return;
      }

      const request = this.requestQueue.shift()!;
      console.log(`🚀 Processing RapidAPI FPL request: ${request.endpoint} (${request.config.priority} priority)`);
      
      try {
        const data = await this.executeRequest(request);
        request.resolve(data);
        this.onRequestSuccess();
      } catch (error) {
        await this.handleRequestError(request, error as Error);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async executeRequest(request: QueuedRequest): Promise<any> {
    const { endpoint, config } = request;
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Calculate delay based on current load and recent failures
    const delay = this.calculateRequestDelay();
    if (delay > 0) {
      console.log(`⏱️ Adding ${delay}ms delay before RapidAPI FPL request`);
      await this.sleep(delay);
    }

    const cacheKey = this.generateCacheKey(endpoint);
    const cachedEntry = this.memoryCache.get(cacheKey);
    
    // Prepare request headers
    const headers: Record<string, string> = {
      'X-RapidAPI-Key': this.config.apiKey,
      'X-RapidAPI-Host': 'fantasy-premier-league-fpl-api.p.rapidapi.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    };
    
    if (cachedEntry?.etag) {
      headers['If-None-Match'] = cachedEntry.etag;
    }
    if (cachedEntry?.lastModified) {
      headers['If-Modified-Since'] = cachedEntry.lastModified;
    }

    console.log(`🌐 Making RapidAPI FPL call to ${endpoint} (attempt ${request.retryCount + 1})`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeout || this.config.timeout);
    
    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      // Handle 304 Not Modified
      if (response.status === 304 && cachedEntry) {
        console.log(`📦 RapidAPI FPL server returned 304, using cached data for ${endpoint}`);
        this.updateCacheMetadata(cacheKey, cachedEntry);
        return cachedEntry.data;
      }
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.getExponentialBackoffDelay(request.retryCount);
          throw new Error(`RapidAPI FPL rate limited. Retry after ${waitTime}ms`);
        }
        throw new Error(`RapidAPI FPL HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Update rate limiting info from response headers
      this.updateRateLimitFromHeaders(response);
      
      const data = await response.json();
      
      // Cache the response
      this.setCachedData(cacheKey, data, {
        ttl: config.cacheTTL || this.DEFAULT_CACHE_TTL.default,
        etag: response.headers.get('etag') || undefined,
        lastModified: response.headers.get('last-modified') || undefined
      });
      
      console.log(`✅ RapidAPI FPL successfully cached ${endpoint}`);
      this.emit('api-success', { endpoint, size: JSON.stringify(data).length });
      
      return data;
      
    } finally {
      clearTimeout(timeout);
    }
  }

  // ==================== RATE LIMITING ====================

  private canMakeRequest(): boolean {
    this.updateRateLimitWindow();
    return this.rateLimitInfo.requestsInWindow < this.rateLimitInfo.maxRequests &&
           this.rateLimitInfo.requestsToday < this.rateLimitInfo.maxDailyRequests;
  }

  private updateRateLimitWindow() {
    const now = Date.now();
    
    // Update minute window
    if (now - this.rateLimitInfo.windowStart > this.rateLimitInfo.windowSize) {
      this.rateLimitInfo.requestsInWindow = 0;
      this.rateLimitInfo.windowStart = now;
      this.rateLimitInfo.nextResetTime = now + this.rateLimitInfo.windowSize;
      console.log(`🔄 RapidAPI FPL rate limit window reset. Available requests: ${this.rateLimitInfo.maxRequests}/min`);
    }
    
    // Update daily window
    const todayStart = this.getDayStart();
    if (todayStart !== this.rateLimitInfo.dailyWindowStart) {
      this.rateLimitInfo.requestsToday = 0;
      this.rateLimitInfo.dailyWindowStart = todayStart;
      console.log(`🔄 RapidAPI FPL daily rate limit reset. Available requests: ${this.rateLimitInfo.maxDailyRequests}/day`);
    }
  }

  private getWaitTimeForNextRequest(): number {
    const now = Date.now();
    
    // Check daily limit first
    if (this.rateLimitInfo.requestsToday >= this.rateLimitInfo.maxDailyRequests) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime() - now;
    }
    
    // Check minute limit
    if (this.rateLimitInfo.requestsInWindow >= this.rateLimitInfo.maxRequests) {
      return Math.max(0, this.rateLimitInfo.nextResetTime - now);
    }
    
    return 0;
  }

  private updateRateLimitFromHeaders(response: Response) {
    // RapidAPI headers (if available)
    const remaining = response.headers.get('x-ratelimit-requests-remaining');
    const limit = response.headers.get('x-ratelimit-requests-limit');
    
    if (remaining && limit) {
      const remainingCount = parseInt(remaining);
      const limitCount = parseInt(limit);
      
      // Update daily counters from headers if available
      if (limitCount >= 100) { // Likely daily limit
        this.rateLimitInfo.requestsToday = limitCount - remainingCount;
        console.log(`📊 RapidAPI FPL daily rate limit from headers: ${remainingCount}/${limitCount}`);
      }
    }
  }

  private calculateRequestDelay(): number {
    // Base delay to be respectful
    let delay = 300; // 300ms base delay
    
    // Increase delay based on recent failures
    if (this.circuitBreaker.failureCount > 0) {
      delay += this.circuitBreaker.failureCount * 500;
    }
    
    // Increase delay based on current request rate
    const requestRate = this.rateLimitInfo.requestsInWindow / (this.rateLimitInfo.maxRequests * 0.8);
    if (requestRate > 0.5) {
      delay += Math.floor(requestRate * 1000);
    }
    
    // Add some jitter to prevent thundering herd
    delay += Math.random() * 200;
    
    return Math.min(delay, 5000); // Cap at 5 seconds
  }

  // ==================== CACHING SYSTEM ====================

  private generateCacheKey(endpoint: string): string {
    return `rapidapi-fpl:${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  private getCachedData(key: string, customTTL?: number): CacheEntry | null {
    // Try memory cache first
    let entry = this.memoryCache.get(key);
    
    // Fallback to persistent cache
    if (!entry) {
      entry = this.persistentCache.get(key);
      if (entry) {
        // Promote to memory cache
        this.memoryCache.set(key, entry);
      }
    }
    
    if (!entry) return null;
    
    const ttl = customTTL || entry.ttl;
    const age = Date.now() - entry.timestamp;
    
    if (age > ttl) {
      this.memoryCache.delete(key);
      this.persistentCache.delete(key);
      return null;
    }
    
    // Update hit count
    entry.hitCount++;
    return entry;
  }

  private setCachedData(key: string, data: any, options: {
    ttl: number;
    etag?: string;
    lastModified?: string;
  }) {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl,
      etag: options.etag,
      lastModified: options.lastModified,
      hitCount: 0
    };
    
    this.memoryCache.set(key, entry);
    
    // Also store in persistent cache for important data
    if (this.shouldPersistCache(key)) {
      this.persistentCache.set(key, entry);
    }
  }

  private updateCacheMetadata(key: string, entry: CacheEntry) {
    entry.timestamp = Date.now();
    entry.hitCount++;
  }

  private shouldPersistCache(key: string): boolean {
    return key.includes('bootstrap-static') || key.includes('fixtures') || key.includes('element-summary');
  }

  // ==================== ERROR HANDLING & CIRCUIT BREAKER ====================

  private async handleRequestError(request: QueuedRequest, error: Error) {
    console.error(`❌ RapidAPI FPL request failed: ${request.endpoint}`, error.message);
    
    this.onRequestFailure();
    
    // Check if we should retry
    if (request.retryCount < (request.config.retries || 3)) {
      const delay = this.getExponentialBackoffDelay(request.retryCount);
      console.log(`🔄 Retrying RapidAPI FPL ${request.endpoint} in ${delay}ms (attempt ${request.retryCount + 2})`);
      
      setTimeout(() => {
        request.retryCount++;
        this.requestQueue.unshift(request); // High priority for retries
      }, delay);
      
      return;
    }
    
    request.reject(error);
  }

  private onRequestSuccess() {
    this.rateLimitInfo.requestsInWindow++;
    this.rateLimitInfo.requestsToday++;
    
    // Circuit breaker recovery
    if (this.circuitBreaker.state === 'half-open') {
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failureCount = 0;
      console.log('🟢 RapidAPI FPL circuit breaker closed - service recovered');
    } else if (this.circuitBreaker.failureCount > 0) {
      this.circuitBreaker.failureCount = Math.max(0, this.circuitBreaker.failureCount - 1);
    }
  }

  private onRequestFailure() {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.state = 'open';
      this.circuitBreaker.nextAttemptTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;
      console.log(`🔴 RapidAPI FPL circuit breaker opened due to ${this.circuitBreaker.failureCount} failures`);
      this.emit('circuit-breaker-open', { failureCount: this.circuitBreaker.failureCount });
    }
  }

  private getExponentialBackoffDelay(retryCount: number): number {
    const baseDelay = this.RETRY_DELAYS[Math.min(retryCount, this.RETRY_DELAYS.length - 1)];
    const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
    return baseDelay + jitter;
  }

  // ==================== CACHE MANAGEMENT ====================

  private startCacheCleanup() {
    // Clean up expired entries every 10 minutes
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 10 * 60 * 1000);
    
    // Persist cache every hour
    setInterval(() => {
      this.savePersistentCache();
    }, 60 * 60 * 1000);
  }

  private cleanupExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.memoryCache) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    
    for (const [key, entry] of this.persistentCache) {
      if (now - entry.timestamp > entry.ttl) {
        this.persistentCache.delete(key);
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 RapidAPI FPL cleaned up ${cleaned} expired cache entries`);
    }
  }

  private loadPersistentCache() {
    // In a production environment, this would load from Redis, file system, or database
    console.log('📚 RapidAPI FPL persistent cache loaded');
  }

  private savePersistentCache() {
    // In a production environment, this would save to Redis, file system, or database
    console.log('💾 RapidAPI FPL persistent cache saved');
  }

  // ==================== UTILITY METHODS ====================

  private convertToIST(utcTime: string): { utc: string; ist: string; istDate: string; istTime: string } {
    const utcDate = new Date(utcTime);
    
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istDate = new Date(utcDate.getTime() + istOffset);
    
    // Format IST date and time
    const istDateString = istDate.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
    
    const istTimeString = istDate.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    return {
      utc: utcTime,
      ist: istDate.toISOString(),
      istDate: istDateString,
      istTime: istTimeString
    };
  }

  private async isMatchDayActive(gameweek: number): Promise<boolean> {
    try {
      const fixtures = await this.getFixtures(gameweek);
      const now = new Date();
      
      // Check if any match is currently being played
      return fixtures.some((fixture: any) => {
        const kickoffTime = new Date(fixture.kickoff_time);
        const timeSinceKickoff = now.getTime() - kickoffTime.getTime();
        
        // Consider a match active from 30 minutes before kickoff to 3 hours after
        return timeSinceKickoff > -30 * 60 * 1000 && // 30 minutes before
               timeSinceKickoff < 3 * 60 * 60 * 1000 && // 3 hours after
               !fixture.finished;
      });
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getDayStart(): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }

  // ==================== MONITORING & STATISTICS ====================

  getCacheStats() {
    const memoryStats = this.getCacheStatsForMap(this.memoryCache);
    const persistentStats = this.getCacheStatsForMap(this.persistentCache);
    
    return {
      memory: memoryStats,
      persistent: persistentStats,
      rateLimiting: {
        minute: {
          requestsInWindow: this.rateLimitInfo.requestsInWindow,
          remainingRequests: this.rateLimitInfo.maxRequests - this.rateLimitInfo.requestsInWindow,
          windowResetTime: new Date(this.rateLimitInfo.nextResetTime).toISOString()
        },
        daily: {
          requestsToday: this.rateLimitInfo.requestsToday,
          remainingRequests: this.rateLimitInfo.maxDailyRequests - this.rateLimitInfo.requestsToday,
          dayResetTime: new Date(this.rateLimitInfo.dailyWindowStart + 24 * 60 * 60 * 1000).toISOString()
        }
      },
      circuitBreaker: {
        state: this.circuitBreaker.state,
        failureCount: this.circuitBreaker.failureCount,
        nextAttemptTime: this.circuitBreaker.nextAttemptTime > 0 
          ? new Date(this.circuitBreaker.nextAttemptTime).toISOString() 
          : null
      },
      queue: {
        size: this.requestQueue.length,
        activeRequests: this.activeRequests.size
      }
    };
  }

  private getCacheStatsForMap(cache: Map<string, CacheEntry>) {
    let totalHits = 0;
    let totalSize = 0;
    const entries = [];
    
    for (const [key, entry] of cache) {
      totalHits += entry.hitCount;
      const size = JSON.stringify(entry.data).length;
      totalSize += size;
      
      entries.push({
        key,
        age: Date.now() - entry.timestamp,
        hits: entry.hitCount,
        size
      });
    }
    
    return {
      size: cache.size,
      totalHits,
      totalSize,
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 10) // Top 10 by hits
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down RapidAPI FPL Service...');
    
    // Wait for active requests to complete (with timeout)
    const shutdownPromise = Promise.all(Array.from(this.activeRequests.values()));
    const timeout = new Promise(resolve => setTimeout(resolve, 10000)); // 10 second timeout
    
    await Promise.race([shutdownPromise, timeout]);
    
    // Save persistent cache
    this.savePersistentCache();
    
    this.removeAllListeners();
    console.log('✅ RapidAPI FPL Service shut down gracefully');
  }
}

export const rapidAPIFPLService = new RapidAPIFPLService();

// Export types for use in other files
export type { 
  CacheEntry, 
  RequestConfig, 
  RateLimitInfo, 
  CircuitBreakerState,
  RapidAPIFPLConfig 
};
