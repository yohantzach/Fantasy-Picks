interface CachedFPLData {
  bootstrapData: any;
  liveGameweekData: Map<number, any>; // gameweekNumber -> live data
  lastUpdated: Date;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class FPLAPICache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly BOOTSTRAP_TTL = 6 * 60 * 60 * 1000; // 6 hours
  private readonly LIVE_DATA_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_REQUESTS_PER_MINUTE = 10;
  private requestCount = 0;
  private lastResetTime = Date.now();

  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.lastResetTime > 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      console.warn('FPL API rate limit exceeded, using cached data');
      return false;
    }

    this.requestCount++;
    return true;
  }

  private isValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private async fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        if (!this.checkRateLimit()) {
          throw new Error('Rate limit exceeded');
        }

        console.log(`Fetching FPL API: ${url} (attempt ${i + 1})`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Successfully fetched FPL API: ${url}`);
        return data;
      } catch (error) {
        console.error(`FPL API fetch attempt ${i + 1} failed:`, error);
        if (i === retries - 1) throw error;
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  async getBootstrapData(): Promise<any> {
    const cacheKey = 'bootstrap-static';
    const cached = this.cache.get(cacheKey);

    if (cached && this.isValid(cached)) {
      console.log('Using cached bootstrap data');
      return cached.data;
    }

    try {
      const data = await this.fetchWithRetry('https://fantasy.premierleague.com/api/bootstrap-static/');
      
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: this.BOOTSTRAP_TTL
      });

      return data;
    } catch (error) {
      console.error('Failed to fetch bootstrap data:', error);
      
      // Return cached data even if expired if available
      if (cached) {
        console.log('Returning expired cached bootstrap data due to API failure');
        return cached.data;
      }
      
      throw new Error('Bootstrap data unavailable and no cache available');
    }
  }

  async getLiveGameweekData(gameweekNumber: number): Promise<any> {
    const cacheKey = `live-gw-${gameweekNumber}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isValid(cached)) {
      console.log(`Using cached live data for gameweek ${gameweekNumber}`);
      return cached.data;
    }

    try {
      const data = await this.fetchWithRetry(`https://fantasy.premierleague.com/api/event/${gameweekNumber}/live/`);
      
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: this.LIVE_DATA_TTL
      });

      return data;
    } catch (error) {
      console.error(`Failed to fetch live data for gameweek ${gameweekNumber}:`, error);
      
      // Return cached data even if expired if available
      if (cached) {
        console.log(`Returning expired cached live data for gameweek ${gameweekNumber} due to API failure`);
        return cached.data;
      }
      
      throw new Error(`Live gameweek ${gameweekNumber} data unavailable and no cache available`);
    }
  }

  // Get player info by FPL ID from bootstrap data
  async getPlayerInfo(fplPlayerId: number): Promise<any> {
    const bootstrapData = await this.getBootstrapData();
    return bootstrapData.elements.find((player: any) => player.id === fplPlayerId);
  }

  // Get player stats from live data
  async getPlayerStats(gameweekNumber: number, fplPlayerId: number): Promise<any> {
    const liveData = await this.getLiveGameweekData(gameweekNumber);
    
    if (!liveData.elements || !Array.isArray(liveData.elements)) {
      return null;
    }

    return liveData.elements.find((element: any) => element.id === fplPlayerId)?.stats || null;
  }

  // Get position name from element type
  getPositionName(elementType: number): string {
    switch (elementType) {
      case 1: return "GKP";
      case 2: return "DEF";
      case 3: return "MID";
      case 4: return "FWD";
      default: return "UNK";
    }
  }

  // Clear cache (useful for testing or manual refresh)
  clearCache(): void {
    this.cache.clear();
    console.log('FPL API cache cleared');
  }

  // Get cache stats
  getCacheStats(): any {
    const stats = {
      entries: this.cache.size,
      requestCount: this.requestCount,
      lastResetTime: new Date(this.lastResetTime).toISOString(),
      cacheEntries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl,
        expired: !this.isValid(entry)
      }))
    };
    return stats;
  }
}

export const fplAPICache = new FPLAPICache();
