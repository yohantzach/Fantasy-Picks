// API Usage Monitor for RapidAPI Basic Plan (500 requests/month)
import { EventEmitter } from 'events';
import { rapidAPIFPLService } from './rapidapi-fpl-service';

interface UsageStats {
  daily: {
    requests: number;
    cacheHits: number;
    cacheMisses: number;
    averageResponseTime: number;
    lastReset: number;
  };
  monthly: {
    requests: number;
    remaining: number;
    limit: number;
    resetDate: Date;
    projectedUsage: number;
  };
  endpoints: {
    [endpoint: string]: {
      calls: number;
      cacheHitRate: number;
      avgResponseTime: number;
      lastCalled: number;
    };
  };
  traffic: {
    peakHours: { hour: number; requests: number }[];
    userCount: number;
    concurrentUsers: number;
    deadlinePeriods: {
      timestamp: number;
      userCount: number;
      requests: number;
    }[];
  };
}

class APIUsageMonitor extends EventEmitter {
  private stats: UsageStats;
  private requestTimes: Map<string, number> = new Map();
  private hourlyRequests: number[] = new Array(24).fill(0);
  private currentHour: number = new Date().getHours();
  
  constructor() {
    super();
    
    this.stats = {
      daily: {
        requests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        lastReset: this.getDayStart()
      },
      monthly: {
        requests: 0,
        remaining: 500,
        limit: 500,
        resetDate: this.getMonthStart(),
        projectedUsage: 0
      },
      endpoints: {},
      traffic: {
        peakHours: [],
        userCount: 0,
        concurrentUsers: 0,
        deadlinePeriods: []
      }
    };
    
    this.setupEventListeners();
    this.startPeriodicReports();
    
    console.log('📊 API Usage Monitor initialized for Basic Plan (500 requests/month)');
  }

  private setupEventListeners() {
    // Listen to RapidAPI FPL service events
    rapidAPIFPLService.on('api-success', (data) => {
      this.recordAPIRequest(data.endpoint, false);
    });
    
    rapidAPIFPLService.on('cache-hit', (data) => {
      this.recordCacheHit(data.endpoint);
    });
    
    rapidAPIFPLService.on('circuit-breaker-open', () => {
      this.emit('alert', {
        type: 'circuit-breaker',
        message: 'RapidAPI FPL circuit breaker opened - check rate limits!',
        severity: 'high'
      });
    });
  }

  private recordAPIRequest(endpoint: string, fromCache: boolean = false) {
    const now = Date.now();
    const hour = new Date().getHours();
    
    // Update daily stats
    if (now - this.stats.daily.lastReset > 24 * 60 * 60 * 1000) {
      this.resetDailyStats();
    }
    
    if (!fromCache) {
      this.stats.daily.requests++;
      this.stats.monthly.requests++;
      this.stats.monthly.remaining = Math.max(0, this.stats.monthly.limit - this.stats.monthly.requests);
      this.hourlyRequests[hour]++;
      
      // Check if we're approaching limits
      this.checkLimits();
    }
    
    // Update endpoint stats
    if (!this.stats.endpoints[endpoint]) {
      this.stats.endpoints[endpoint] = {
        calls: 0,
        cacheHitRate: 0,
        avgResponseTime: 0,
        lastCalled: now
      };
    }
    
    const endpointStats = this.stats.endpoints[endpoint];
    if (!fromCache) {
      endpointStats.calls++;
    }
    endpointStats.lastCalled = now;
    
    // Update traffic stats
    this.updateTrafficStats();
  }

  private recordCacheHit(endpoint: string) {
    this.stats.daily.cacheHits++;
    this.recordAPIRequest(endpoint, true);
    
    // Update cache hit rate for endpoint
    if (this.stats.endpoints[endpoint]) {
      const endpointStats = this.stats.endpoints[endpoint];
      const totalRequests = endpointStats.calls + this.stats.daily.cacheHits;
      endpointStats.cacheHitRate = (this.stats.daily.cacheHits / totalRequests) * 100;
    }
  }

  private updateTrafficStats() {
    const hour = new Date().getHours();
    
    // Update peak hours
    this.stats.traffic.peakHours = this.hourlyRequests
      .map((requests, index) => ({ hour: index, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);
    
    // Detect deadline periods (high traffic spikes)
    if (this.hourlyRequests[hour] > this.getAverageHourlyRequests() * 3) {
      this.stats.traffic.deadlinePeriods.push({
        timestamp: Date.now(),
        userCount: this.stats.traffic.concurrentUsers,
        requests: this.hourlyRequests[hour]
      });
      
      // Keep only last 10 deadline periods
      if (this.stats.traffic.deadlinePeriods.length > 10) {
        this.stats.traffic.deadlinePeriods.shift();
      }
      
      this.emit('alert', {
        type: 'traffic-spike',
        message: `High traffic detected: ${this.hourlyRequests[hour]} requests this hour`,
        severity: 'medium'
      });
    }
  }

  private getAverageHourlyRequests(): number {
    const nonZeroHours = this.hourlyRequests.filter(h => h > 0);
    return nonZeroHours.length > 0 ? 
      nonZeroHours.reduce((a, b) => a + b, 0) / nonZeroHours.length : 0;
  }

  private checkLimits() {
    const monthlyUsagePercent = (this.stats.monthly.requests / this.stats.monthly.limit) * 100;
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysPassed = new Date().getDate();
    const expectedUsagePercent = (daysPassed / daysInMonth) * 100;
    
    // Update projected usage
    this.stats.monthly.projectedUsage = Math.round(
      (this.stats.monthly.requests / daysPassed) * daysInMonth
    );
    
    // Check various thresholds
    if (monthlyUsagePercent > 90) {
      this.emit('alert', {
        type: 'quota-critical',
        message: `🚨 CRITICAL: Using ${monthlyUsagePercent.toFixed(1)}% of monthly quota (${this.stats.monthly.requests}/${this.stats.monthly.limit})`,
        severity: 'critical'
      });
    } else if (monthlyUsagePercent > 75) {
      this.emit('alert', {
        type: 'quota-warning',
        message: `⚠️ WARNING: Using ${monthlyUsagePercent.toFixed(1)}% of monthly quota (${this.stats.monthly.requests}/${this.stats.monthly.limit})`,
        severity: 'high'
      });
    } else if (monthlyUsagePercent > expectedUsagePercent + 20) {
      this.emit('alert', {
        type: 'quota-ahead',
        message: `📈 Using quota faster than expected. Projected: ${this.stats.monthly.projectedUsage}/month`,
        severity: 'medium'
      });
    }
    
    // Daily limit check (we set conservative 15/day limit)
    if (this.stats.daily.requests > 12) {
      this.emit('alert', {
        type: 'daily-limit',
        message: `Daily API usage high: ${this.stats.daily.requests} requests today`,
        severity: 'medium'
      });
    }
  }

  private resetDailyStats() {
    this.stats.daily = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      lastReset: this.getDayStart()
    };
    
    // Reset hourly requests
    this.hourlyRequests.fill(0);
    
    console.log('🔄 Daily API stats reset');
  }

  private startPeriodicReports() {
    // Daily summary report
    setInterval(() => {
      this.generateDailyReport();
    }, 24 * 60 * 60 * 1000);
    
    // Hourly monitoring
    setInterval(() => {
      this.hourlyCheck();
    }, 60 * 60 * 1000);
    
    // Real-time monitoring every 5 minutes
    setInterval(() => {
      this.realtimeCheck();
    }, 5 * 60 * 1000);
  }

  private generateDailyReport() {
    const report = {
      date: new Date().toISOString().split('T')[0],
      summary: {
        apiRequests: this.stats.daily.requests,
        cacheHits: this.stats.daily.cacheHits,
        cacheHitRate: this.stats.daily.requests > 0 ? 
          (this.stats.daily.cacheHits / (this.stats.daily.requests + this.stats.daily.cacheHits)) * 100 : 0,
        monthlyProgress: {
          used: this.stats.monthly.requests,
          remaining: this.stats.monthly.remaining,
          projected: this.stats.monthly.projectedUsage,
          onTrack: this.stats.monthly.projectedUsage <= this.stats.monthly.limit
        }
      },
      topEndpoints: Object.entries(this.stats.endpoints)
        .map(([endpoint, stats]) => ({ endpoint, ...stats }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 5),
      recommendations: this.generateRecommendations()
    };
    
    console.log('📊 Daily API Usage Report:', JSON.stringify(report, null, 2));
    this.emit('daily-report', report);
  }

  private hourlyCheck() {
    const currentHour = new Date().getHours();
    if (currentHour !== this.currentHour) {
      console.log(`📊 Hour ${this.currentHour} summary: ${this.hourlyRequests[this.currentHour]} API requests`);
      this.currentHour = currentHour;
    }
  }

  private realtimeCheck() {
    const cacheStats = rapidAPIFPLService.getCacheStats();
    
    // Update concurrent users (simplified - would need real user tracking)
    this.stats.traffic.concurrentUsers = Math.max(1, Math.floor(Math.random() * 50)); // Placeholder
    
    // Log current status
    console.log(`📊 API Status - Daily: ${this.stats.daily.requests}/15, Monthly: ${this.stats.monthly.requests}/500, Cache Hit Rate: ${((this.stats.daily.cacheHits / (this.stats.daily.requests + this.stats.daily.cacheHits || 1)) * 100).toFixed(1)}%`);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const cacheHitRate = this.stats.daily.requests > 0 ? 
      (this.stats.daily.cacheHits / (this.stats.daily.requests + this.stats.daily.cacheHits)) * 100 : 0;
    
    // Cache optimization recommendations
    if (cacheHitRate < 80) {
      recommendations.push('🔄 Increase cache TTL for static data (bootstrap, fixtures)');
    }
    
    // Quota management
    if (this.stats.monthly.projectedUsage > this.stats.monthly.limit) {
      recommendations.push('🚨 Consider upgrading to Pro plan or optimizing API usage');
    }
    
    // Endpoint optimization
    const mostCalledEndpoint = Object.entries(this.stats.endpoints)
      .sort((a, b) => b[1].calls - a[1].calls)[0];
    
    if (mostCalledEndpoint && mostCalledEndpoint[1].calls > this.stats.daily.requests * 0.5) {
      recommendations.push(`📊 Optimize caching for ${mostCalledEndpoint[0]} (most called endpoint)`);
    }
    
    // Traffic pattern recommendations
    if (this.stats.traffic.deadlinePeriods.length > 3) {
      recommendations.push('⏰ Pre-cache data before deadline periods to reduce API calls');
    }
    
    // Conservative usage
    if (this.stats.daily.requests > 10) {
      recommendations.push('📉 Daily usage high - consider more aggressive caching');
    }
    
    return recommendations;
  }

  // Public methods for external monitoring
  
  public getUsageStats(): UsageStats {
    return { ...this.stats };
  }

  public getCacheEfficiency(): {
    hitRate: number;
    missRate: number;
    savingsPercent: number;
  } {
    const totalRequests = this.stats.daily.requests + this.stats.daily.cacheHits;
    const hitRate = totalRequests > 0 ? (this.stats.daily.cacheHits / totalRequests) * 100 : 0;
    
    return {
      hitRate,
      missRate: 100 - hitRate,
      savingsPercent: hitRate // Each cache hit saves one API call
    };
  }

  public getQuotaStatus(): {
    monthly: { used: number; remaining: number; percentUsed: number };
    daily: { used: number; limit: number; percentUsed: number };
    projected: { monthlyUsage: number; willExceed: boolean };
  } {
    return {
      monthly: {
        used: this.stats.monthly.requests,
        remaining: this.stats.monthly.remaining,
        percentUsed: (this.stats.monthly.requests / this.stats.monthly.limit) * 100
      },
      daily: {
        used: this.stats.daily.requests,
        limit: 15, // Our conservative daily limit
        percentUsed: (this.stats.daily.requests / 15) * 100
      },
      projected: {
        monthlyUsage: this.stats.monthly.projectedUsage,
        willExceed: this.stats.monthly.projectedUsage > this.stats.monthly.limit
      }
    };
  }

  public simulateDeadlineTraffic(userCount: number): {
    estimatedRequests: number;
    willExceedQuota: boolean;
    recommendations: string[];
  } {
    // Estimate requests during deadline period
    // Assumptions: Each user makes 3-5 requests (teams, players, fixtures)
    const avgRequestsPerUser = 4;
    const estimatedRequests = userCount * avgRequestsPerUser;
    const currentUsage = this.stats.monthly.requests;
    const projectedTotal = currentUsage + estimatedRequests;
    
    const recommendations: string[] = [];
    
    if (projectedTotal > this.stats.monthly.limit) {
      recommendations.push('🚨 CRITICAL: Deadline traffic will exceed monthly quota!');
      recommendations.push('💡 Pre-cache all static data (bootstrap, fixtures) before deadline');
      recommendations.push('💡 Consider implementing aggressive client-side caching');
      recommendations.push('💡 Upgrade to Pro plan for higher limits');
    } else if (projectedTotal > this.stats.monthly.limit * 0.9) {
      recommendations.push('⚠️ WARNING: Deadline traffic will use 90%+ of quota');
      recommendations.push('💡 Pre-cache data and monitor usage closely');
    } else {
      recommendations.push('✅ Quota should handle expected deadline traffic');
    }
    
    return {
      estimatedRequests,
      willExceedQuota: projectedTotal > this.stats.monthly.limit,
      recommendations
    };
  }

  private getDayStart(): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }

  private getMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  // Method to record user activity (call this when users access the app)
  public recordUserActivity(userId: string, endpoint: string) {
    this.stats.traffic.userCount++;
    // In a real implementation, you'd track unique users properly
  }

  // Emergency method to force aggressive caching during high traffic
  public enableEmergencyCaching() {
    console.log('🚨 Emergency caching mode enabled - extending all cache TTLs by 4x');
    
    // This would need to be implemented in the RapidAPI FPL service
    this.emit('emergency-caching', {
      multiplier: 4,
      reason: 'High traffic detected, conserving API quota'
    });
  }
}

export const apiUsageMonitor = new APIUsageMonitor();
export { APIUsageMonitor, UsageStats };
