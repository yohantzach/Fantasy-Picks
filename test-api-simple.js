const http = require('http');

function testAPI(path, description) {
  return new Promise((resolve, reject) => {
    console.log(`Testing ${description}...`);
    
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          console.log(`✅ ${description}:`, parsedData);
          resolve(parsedData);
        } catch (e) {
          console.log(`❌ ${description} - Invalid JSON:`, data);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ ${description} - Request error:`, e.message);
      reject(e);
    });

    req.setTimeout(5000, () => {
      console.error(`❌ ${description} - Timeout`);
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('🔍 Testing FPL Scoring System APIs...\n');
  
  try {
    // Test current gameweek
    const gameweek = await testAPI('/api/gameweek/current', 'Current Gameweek');
    
    // Test leaderboard
    if (gameweek && gameweek.id) {
      await testAPI(`/api/leaderboard/${gameweek.id}`, 'Leaderboard');
      await testAPI(`/api/leaderboard/enhanced/${gameweek.id}`, 'Enhanced Leaderboard');
    }
    
    // Test previous winners
    await testAPI('/api/leaderboard/previous-winners', 'Previous Winners');
    
    console.log('\n🎉 All API tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

runTests();
