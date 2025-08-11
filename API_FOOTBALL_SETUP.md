# API-Football Integration Setup Guide

## Overview

Your Fantasy-Picks application now supports **API-Football** as a reliable fallback to the official FPL API, which will help you avoid rate limiting issues and provide better reliability.

## 🔑 Getting Your API-Football Key

1. **Sign up at RapidAPI**: https://rapidapi.com/api-sports/api/api-football
2. **Subscribe to API-Football** (Free tier available):
   - **Free Plan**: 100 requests/day, 30 requests/minute
   - **Pro Plan**: $19/month for 7,500 requests/day
   - **Mega Plan**: $39/month for 150,000 requests/day

3. **Get your API key** from the RapidAPI dashboard

## 🔧 Configuration

### Environment Variables

Add this to your `.env` file:

```bash
# API-Football configuration
API_FOOTBALL_KEY=your-rapidapi-key-here

# Optional: Customize rate limits based on your plan
API_FOOTBALL_RATE_LIMIT_DAILY=100    # Free tier: 100, Pro: 7500, Mega: 150000
API_FOOTBALL_RATE_LIMIT_MINUTE=30    # Free tier: 30, Pro: 300, Mega: 1000
```

### Hybrid Service Configuration

The hybrid service is automatically configured with these defaults:

```typescript
{
  primarySource: 'fpl-official',           // Start with official FPL API
  fallbackStrategy: 'api-football-first', // Prefer API-Football to avoid rate limits
  enableAutoSwitching: true,               // Automatically switch between sources
  maxRetries: 2,                          // Retry failed requests
  retryDelay: 1000                        // 1 second delay between retries
}
```

## 📊 How It Works

### Automatic Fallback Strategy

1. **Primary Source**: Starts with official FPL API
2. **Smart Switching**: When FPL API hits rate limits or fails, automatically switches to API-Football
3. **Rate Limit Management**: Respects both APIs' rate limits with intelligent caching
4. **Data Compatibility**: Converts API-Football data to FPL-compatible format

### API Usage Optimization

The system includes several optimization features:

#### **Intelligent Caching**
- **Teams data**: 24 hours (rarely changes)
- **Fixtures**: 1 hour (regular updates needed)
- **Live fixtures**: 2 minutes (during matches)
- **Player data**: 6 hours (stats update regularly)
- **Standings**: 30 minutes

#### **Rate Limit Protection**
- **Request queuing**: Prevents burst requests
- **Automatic delays**: Adds delays between requests
- **Circuit breaker**: Stops requests when API is failing
- **Smart retry**: Exponential backoff on failures

## 🎯 API Endpoints

### Premier League Data (API-Football)

The API-Football service provides Premier League data using these endpoints:

```
GET /fixtures?league=39&season=2025                    # All fixtures
GET /fixtures?league=39&season=2025&round=Regular Season - 15  # Specific gameweek
GET /fixtures?league=39&season=2025&live=all          # Live matches
GET /teams?league=39&season=2025                       # All teams
GET /standings?league=39&season=2025                   # League table
GET /players?team={id}&season=2025&league=39          # Team players
GET /injuries?league=39&season=2025                   # Injury list
```

### Your Application Endpoints

Your existing endpoints now use the hybrid service automatically:

```
GET /api/fpl/players          # Uses hybrid service (FPL API → API-Football fallback)
GET /api/fpl/teams           # Uses hybrid service
GET /api/fpl/fixtures/:gameweek  # Uses hybrid service
```

### New Admin Endpoints

```
GET /api/admin/api-status                # Complete system status
GET /api/admin/api/source-status         # Data source availability
POST /api/admin/api/switch-source        # Manually switch data source
GET /api/admin/api-football/status       # API-Football specific status
```

## 📈 Monitoring & Analytics

### Admin Dashboard

Access comprehensive monitoring at:
- `/api/admin/api-status` - Overall system health
- `/api/admin/api/source-status` - Data source status
- `/api/admin/api-football/status` - API-Football metrics

### Monitoring Data

```json
{
  "hybrid": {
    "currentSource": "api-football",
    "sources": {
      "fpl-official": {
        "status": { "available": false, "rateLimitHit": true },
        "stats": { /* cache and performance data */ }
      },
      "api-football": {
        "status": { "available": true, "rateLimitHit": false },
        "stats": { 
          "rateLimits": {
            "daily": { "used": 45, "remaining": 55, "limit": 100 },
            "minute": { "used": 2, "remaining": 28, "limit": 30 }
          }
        }
      }
    },
    "recommendations": [
      "FPL API rate limit hit - API-Football fallback active"
    ]
  }
}
```

## 🚀 Usage Examples

### Basic Usage (Automatic)

Your existing code doesn't need to change! The hybrid service works transparently:

```typescript
// This automatically uses the best available data source
const players = await hybridFplService.getPlayers();
const fixtures = await hybridFplService.getFixtures(15);
const teams = await hybridFplService.getTeams();
```

### Manual Source Control (Admin)

```typescript
// Manually switch to API-Football
await hybridFplService.switchSource('api-football');

// Check current source
const currentSource = hybridFplService.getCurrentSource();
console.log('Using:', currentSource); // 'api-football'

// Get comprehensive status
const status = hybridFplService.getComprehensiveStatus();
```

### Event Handling

```typescript
// Listen for automatic source switches
hybridFplService.on('source-switched', (data) => {
  console.log(`Switched from ${data.from} to ${data.to} (reason: ${data.reason})`);
});

// Listen for rate limit events
hybridFplService.on('source-rate-limited', (data) => {
  console.log(`${data.source} rate limited until ${data.nextAvailable}`);
});
```

## ⚠️ Important Notes

### Data Differences

1. **Player Data**: API-Football doesn't have FPL-specific pricing or ownership data. The service provides default values and focuses on fixtures/team data.

2. **Live Data**: Currently, live gameweek data is only available from the official FPL API.

3. **Historical Data**: API-Football provides more detailed match statistics than the official FPL API.

### Rate Limits

**Free Tier Recommendations:**
- **Daily limit**: 100 requests (monitor usage carefully)
- **Minute limit**: 30 requests (well-handled by caching)
- **Best for**: Development, small user bases, backup data source

**Paid Tier Benefits:**
- **Much higher limits**: 7,500+ requests/day
- **Better performance**: More requests per minute
- **Commercial use**: Licensed for production applications

## 🔧 Troubleshooting

### Common Issues

1. **"API-Football API key not configured"**
   ```bash
   # Add to your .env file
   API_FOOTBALL_KEY=your-actual-key-here
   ```

2. **Rate limit exceeded**
   ```bash
   # Check your usage
   curl http://localhost:3000/api/admin/api-football/status
   
   # Consider upgrading your API-Football plan
   ```

3. **Data format issues**
   ```bash
   # Check which source is being used
   curl http://localhost:3000/api/admin/api/source-status
   ```

### Debug Mode

Enable detailed logging:

```bash
DEBUG=hybrid-fpl-service,api-football-service npm run dev
```

### Health Checks

The system performs automatic health checks every 5 minutes and switches sources as needed.

## 🎛️ Configuration Options

### Custom Configuration

You can customize the hybrid service behavior:

```typescript
import { HybridFPLService } from './server/hybrid-fpl-service';

const customService = new HybridFPLService({
  primarySource: 'api-football',      // Start with API-Football
  fallbackStrategy: 'fpl-first',      // Try FPL API first
  enableAutoSwitching: false,         // Manual control only
  maxRetries: 3,                      // More retry attempts
  retryDelay: 2000                    // 2 second delays
});
```

### API-Football Custom Settings

```typescript
import { APIFootballService } from './server/api-football-service';

const customAPIFootball = new APIFootballService({
  apiKey: 'your-key',
  rateLimitPerMinute: 300,  // Pro tier
  rateLimitPerDay: 7500,    // Pro tier
  timeout: 15000            // 15 second timeout
});
```

## 📋 Migration Checklist

- [ ] Sign up for API-Football on RapidAPI
- [ ] Add `API_FOOTBALL_KEY` to your environment variables
- [ ] Test the hybrid service with: `GET /api/admin/api-status`
- [ ] Monitor rate limit usage: `GET /api/admin/api-football/status`
- [ ] Verify automatic fallback by temporarily blocking FPL API
- [ ] Update your deployment environment with the API key
- [ ] Consider upgrading to a paid API-Football plan for production

## 💡 Best Practices

1. **Start with Free Tier**: Test the integration before committing to paid plans
2. **Monitor Usage**: Keep an eye on your daily API-Football usage
3. **Cache Aggressively**: Let the built-in caching handle efficiency
4. **Plan for Growth**: Upgrade API-Football plan as your user base grows
5. **Use FPL for Live Data**: Keep using official FPL API for live gameweek data
6. **Set Alerts**: Monitor the admin endpoints for API health

---

This setup gives you a robust, reliable data source that automatically handles rate limits and provides fallback capabilities. The hybrid approach ensures your Fantasy-Picks application stays online even when the official FPL API is having issues!
