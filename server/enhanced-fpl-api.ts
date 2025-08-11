// Enhanced FPL API service with multi-layer caching, intelligent rate limiting, and request optimization
import { EventEmitter } from 'events';

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
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

class EnhancedFPLAPIService extends EventEmitter {
  // Cache layers
  private memoryCache: Map<string, CacheEntry> = new Map();
  private persistentCache: Map<string, CacheEntry> = new Map();
  
  // Request management
  private requestQueue: QueuedRequest[] = [];
  private activeRequests: Map<string, Promise<any>> = new Map();
  private isProcessingQueue = false;
  
  // Rate limiting
  private rateLimitInfo: RateLimitInfo = {
    requestsInWindow: 0,
    windowStart: Date.now(),
    windowSize: 60 * 60 * 1000, // 1 hour
    maxRequests: 22, // Conservative limit (24 - 2 buffer)
    nextResetTime: Date.now() + 60 * 60 * 1000
  };
  
  // Circuit breaker
  private circuitBreaker: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0
  };
  
  // Configuration
  private readonly BASE_URL = 'https://fantasy.premierleague.com/api';
  private readonly DEFAULT_CACHE_TTL = {
    'bootstrap-static': 4 * 60 * 60 * 1000, // 4 hours (rarely changes)
    'fixtures': 2 * 60 * 60 * 1000, // 2 hours
    'fixtures-gameweek': 30 * 60 * 1000, // 30 minutes for specific gameweek
    'event-live': 5 * 60 * 1000, // 5 minutes during matches
    'entry': 10 * 60 * 1000, // 10 minutes for user data
    default: 60 * 60 * 1000 // 1 hour default
  };
  
  private readonly RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  
  constructor() {
    super();
    this.startQueueProcessor();
    this.startCacheCleanup();
    this.loadPersistentCache();
  }

  // ==================== PUBLIC API METHODS ====================

  async getBootstrapData(): Promise<any> {
    return this.makeRequest('/bootstrap-static/', { 
      priority: 'high',
      cacheTTL: this.DEFAULT_CACHE_TTL['bootstrap-static']
    });
  }

  async getFixtures(gameweek?: number): Promise<any> {
    const endpoint = gameweek ? `/fixtures/?event=${gameweek}` : '/fixtures/';
    const cacheKey = gameweek ? 'fixtures-gameweek' : 'fixtures';
    
    return this.makeRequest(endpoint, { 
      priority: 'medium',
      cacheTTL: this.DEFAULT_CACHE_TTL[cacheKey]
    });
  }

  async getLiveData(gameweek: number): Promise<any> {
    return this.makeRequest(`/event/${gameweek}/live/`, {
      priority: 'high',
      cacheTTL: this.DEFAULT_CACHE_TTL['event-live']
    });
  }

  async getManagerData(managerId: number): Promise<any> {
    return this.makeRequest(`/entry/${managerId}/`, {
      priority: 'low',
      cacheTTL: this.DEFAULT_CACHE_TTL['entry']
    });
  }

  // Enhanced versions of your existing methods
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

  // ==================== ENHANCED REQUEST HANDLING ====================

  private async makeRequest(endpoint: string, config: RequestConfig = { priority: 'medium' }): Promise<any> {
    const cacheKey = this.generateCacheKey(endpoint);
    
    // Check if request is already in progress (deduplication)
    const activeRequest = this.activeRequests.get(cacheKey);
    if (activeRequest) {
      console.log(`🔄 Deduplicating request for ${endpoint}`);
      return activeRequest;
    }

    // Check cache first
    const cached = this.getCachedData(cacheKey, config.cacheTTL);
    if (cached) {
      console.log(`📦 Cache hit for ${endpoint} (age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
      this.emit('cache-hit', { endpoint, age: Date.now() - cached.timestamp });
      return cached.data;
    }

    // Check circuit breaker
    if (this.circuitBreaker.state === 'open') {
      if (Date.now() < this.circuitBreaker.nextAttemptTime) {
        throw new Error(`Circuit breaker is open. Next attempt allowed at ${new Date(this.circuitBreaker.nextAttemptTime).toISOString()}`);
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
    console.log(`📥 Queued ${request.config.priority} priority request for ${request.endpoint} (queue size: ${this.requestQueue.length})`);
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
        console.log(`⏳ Rate limited. Waiting ${Math.ceil(waitTime / 1000)}s for next request`);
        setTimeout(() => { this.isProcessingQueue = false; }, waitTime);
        return;
      }

      const request = this.requestQueue.shift()!;
      console.log(`🚀 Processing request: ${request.endpoint} (${request.config.priority} priority)`);
      
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
    const url = `${this.BASE_URL}${endpoint}`;
    
    // Calculate delay based on current load and recent failures
    const delay = this.calculateRequestDelay();
    if (delay > 0) {
      console.log(`⏱️ Adding ${delay}ms delay before request`);
      await this.sleep(delay);
    }

    const cacheKey = this.generateCacheKey(endpoint);
    const cachedEntry = this.memoryCache.get(cacheKey);
    
    // Prepare request headers for conditional requests
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    
    if (cachedEntry?.etag) {
      headers['If-None-Match'] = cachedEntry.etag;
    }
    if (cachedEntry?.lastModified) {
      headers['If-Modified-Since'] = cachedEntry.lastModified;
    }

    console.log(`🌐 Making API call to ${endpoint} (attempt ${request.retryCount + 1})`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeout || 30000);
    
    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      // Handle 304 Not Modified
      if (response.status === 304 && cachedEntry) {
        console.log(`📦 Server returned 304, using cached data for ${endpoint}`);
        this.updateCacheMetadata(cacheKey, cachedEntry);
        return cachedEntry.data;
      }
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.getExponentialBackoffDelay(request.retryCount);
          throw new Error(`Rate limited. Retry after ${waitTime}ms`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
      
      console.log(`✅ Successfully cached ${endpoint}`);
      this.emit('api-success', { endpoint, size: JSON.stringify(data).length });
      
      return data;
      
    } finally {
      clearTimeout(timeout);
    }
  }

  // ==================== CACHING SYSTEM ====================

  private generateCacheKey(endpoint: string): string {
    return `fpl:${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
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
    return key.includes('bootstrap-static') || key.includes('fixtures');
  }

  // ==================== RATE LIMITING ====================

  private canMakeRequest(): boolean {
    this.updateRateLimitWindow();
    return this.rateLimitInfo.requestsInWindow < this.rateLimitInfo.maxRequests;
  }

  private updateRateLimitWindow() {
    const now = Date.now();
    if (now - this.rateLimitInfo.windowStart > this.rateLimitInfo.windowSize) {
      this.rateLimitInfo.requestsInWindow = 0;
      this.rateLimitInfo.windowStart = now;
      this.rateLimitInfo.nextResetTime = now + this.rateLimitInfo.windowSize;
      console.log(`🔄 Rate limit window reset. Available requests: ${this.rateLimitInfo.maxRequests}`);
    }
  }

  private getWaitTimeForNextRequest(): number {
    const now = Date.now();
    return Math.max(0, this.rateLimitInfo.nextResetTime - now);
  }

  private updateRateLimitFromHeaders(response: Response) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    
    if (remaining) {
      this.rateLimitInfo.requestsInWindow = this.rateLimitInfo.maxRequests - parseInt(remaining);
    }
    
    if (reset) {
      this.rateLimitInfo.nextResetTime = parseInt(reset) * 1000;
    }
  }

  private calculateRequestDelay(): number {
    // Base delay to be respectful
    let delay = 500; // 500ms base delay
    
    // Increase delay based on recent failures
    if (this.circuitBreaker.failureCount > 0) {
      delay += this.circuitBreaker.failureCount * 1000;
    }
    
    // Increase delay based on current request rate
    const requestRate = this.rateLimitInfo.requestsInWindow / (this.rateLimitInfo.maxRequests * 0.8);
    if (requestRate > 0.5) {
      delay += Math.floor(requestRate * 2000);
    }
    
    // Add some jitter to prevent thundering herd
    delay += Math.random() * 500;
    
    return Math.min(delay, 10000); // Cap at 10 seconds
  }

  // ==================== ERROR HANDLING & CIRCUIT BREAKER ====================

  private async handleRequestError(request: QueuedRequest, error: Error) {
    console.error(`❌ Request failed: ${request.endpoint}`, error.message);
    
    this.onRequestFailure();
    
    // Check if we should retry
    if (request.retryCount < (request.config.retries || 3)) {
      const delay = this.getExponentialBackoffDelay(request.retryCount);
      console.log(`🔄 Retrying ${request.endpoint} in ${delay}ms (attempt ${request.retryCount + 2})`);
      
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
    
    // Circuit breaker recovery
    if (this.circuitBreaker.state === 'half-open') {
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failureCount = 0;
      console.log('🟢 Circuit breaker closed - service recovered');
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
      console.log(`🔴 Circuit breaker opened due to ${this.circuitBreaker.failureCount} failures`);
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
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
    }
  }

  private loadPersistentCache() {
    // In a production environment, this would load from Redis, file system, or database
    console.log('📚 Persistent cache loaded');
  }

  private savePersistentCache() {
    // In a production environment, this would save to Redis, file system, or database
    console.log('💾 Persistent cache saved');
  }

  // ==================== MONITORING & STATISTICS ====================

  getCacheStats() {
    const memoryStats = this.getCacheStatsForMap(this.memoryCache);
    const persistentStats = this.getCacheStatsForMap(this.persistentCache);
    
    return {
      memory: memoryStats,
      persistent: persistentStats,
      rateLimiting: {
        requestsInWindow: this.rateLimitInfo.requestsInWindow,
        remainingRequests: this.rateLimitInfo.maxRequests - this.rateLimitInfo.requestsInWindow,
        windowResetTime: new Date(this.rateLimitInfo.nextResetTime).toISOString()
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

  // ==================== UTILITY METHODS ====================

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down Enhanced FPL API Service...');
    
    // Wait for active requests to complete (with timeout)
    const shutdownPromise = Promise.all(Array.from(this.activeRequests.values()));
    const timeout = new Promise(resolve => setTimeout(resolve, 10000)); // 10 second timeout
    
    await Promise.race([shutdownPromise, timeout]);
    
    // Save persistent cache
    this.savePersistentCache();
    
    console.log('✅ Enhanced FPL API Service shut down gracefully');
  }
}

export const enhancedFplAPI = new EnhancedFPLAPIService();

// Export types for use in other files
export type { CacheEntry, RequestConfig, RateLimitInfo, CircuitBreakerState };
