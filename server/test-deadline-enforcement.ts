import { Request, Response } from 'express';
import { storage } from './storage';
import { fplAPI } from './fpl-api';
import { checkDeadlineMiddleware, requireActiveDeadline } from './deadline-middleware';

// Mock request and response objects for testing
function createMockRequest(user?: any, path?: string, method?: string): Partial<Request> {
  return {
    user,
    path: path || '/api/team',
    method: method || 'POST',
    isAuthenticated: () => !!user,
  };
}

function createMockResponse(): { res: Partial<Response>; responseData: any } {
  const responseData: any = {};
  
  const res: Partial<Response> = {
    status: (code: number) => {
      responseData.statusCode = code;
      return res as Response;
    },
    json: (data: any) => {
      responseData.json = data;
      return res as Response;
    },
    sendStatus: (code: number) => {
      responseData.statusCode = code;
      return res as Response;
    },
  };
  
  return { res, responseData };
}

async function testDeadlineEnforcement() {
  console.log('🧪 Testing Deadline Enforcement Logic...\n');
  
  try {
    // Test 1: Check if current gameweek exists and has proper deadline
    console.log('1️⃣ Testing Current Gameweek Setup...');
    let currentGameweek = await storage.getCurrentGameweek();
    
    if (!currentGameweek) {
      console.log('   No current gameweek found. Creating one...');
      const fplGameweek = await fplAPI.getCurrentGameweek();
      const deadline = await fplAPI.getGameweekDeadline(fplGameweek.id);
      currentGameweek = await storage.createGameweek(fplGameweek.id, new Date(deadline));
      console.log(`   ✅ Created gameweek ${currentGameweek.gameweekNumber} with deadline: ${currentGameweek.deadline}`);
    } else {
      console.log(`   ✅ Current gameweek: ${currentGameweek.gameweekNumber}, Deadline: ${currentGameweek.deadline}`);
    }
    
    const now = new Date();
    const deadline = new Date(currentGameweek.deadline);
    const timeUntilDeadline = deadline.getTime() - now.getTime();
    const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
    
    console.log(`   Current time: ${now.toISOString()}`);
    console.log(`   Deadline: ${deadline.toISOString()}`);
    console.log(`   Hours until deadline: ${hoursUntilDeadline.toFixed(2)}`);
    console.log(`   Deadline ${timeUntilDeadline > 0 ? 'has NOT' : 'HAS'} passed\n`);
    
    // Test 2: Test middleware with regular user before deadline
    console.log('2️⃣ Testing Middleware - Regular User Before Deadline...');
    const regularUser = { id: 1, email: 'user@test.com', isAdmin: false };
    const req1 = createMockRequest(regularUser, '/api/team/save', 'POST');
    const { res: res1, responseData: data1 } = createMockResponse();
    
    let middlewareCalled = false;
    const next1 = () => { middlewareCalled = true; };
    
    await checkDeadlineMiddleware(req1 as Request, res1 as Response, next1);
    
    if (timeUntilDeadline > 0) {
      // Before deadline
      if (middlewareCalled && req1.deadlineInfo?.canModifyTeam) {
        console.log('   ✅ Regular user can modify team before deadline');
      } else {
        console.log('   ❌ Regular user should be able to modify team before deadline');
      }
    } else {
      // After deadline
      if (data1.statusCode === 403) {
        console.log('   ✅ Regular user blocked after deadline');
      } else {
        console.log('   ❌ Regular user should be blocked after deadline');
      }
    }
    
    // Test 3: Test middleware with admin user
    console.log('\n3️⃣ Testing Middleware - Admin User...');
    const adminUser = { id: 2, email: 'fantasypicks09@gmail.com', isAdmin: true };
    const req2 = createMockRequest(adminUser, '/api/team/save', 'POST');
    const { res: res2, responseData: data2 } = createMockResponse();
    
    middlewareCalled = false;
    const next2 = () => { middlewareCalled = true; };
    
    await checkDeadlineMiddleware(req2 as Request, res2 as Response, next2);
    
    if (middlewareCalled && req2.deadlineInfo?.canModifyTeam) {
      console.log('   ✅ Admin user can always modify teams');
    } else {
      console.log('   ❌ Admin user should always be able to modify teams');
    }
    
    // Test 4: Test deadline calculation accuracy
    console.log('\n4️⃣ Testing Deadline Calculation Accuracy...');
    try {
      const fixtures = await fplAPI.getFixtures(currentGameweek.gameweekNumber);
      if (fixtures.length > 0) {
        // Find earliest fixture
        const earliestFixture = fixtures.reduce((earliest, fixture) => {
          const fixtureKickoff = new Date(fixture.kickoff_time);
          const earliestKickoff = new Date(earliest.kickoff_time);
          return fixtureKickoff < earliestKickoff ? fixture : earliest;
        });
        
        const firstMatchTime = new Date(earliestFixture.kickoff_time);
        const calculatedDeadline = new Date(firstMatchTime.getTime() - (2 * 60 * 60 * 1000)); // 2 hours before
        
        console.log(`   First match: ${firstMatchTime.toISOString()}`);
        console.log(`   Calculated deadline: ${calculatedDeadline.toISOString()}`);
        console.log(`   Stored deadline: ${currentGameweek.deadline}`);
        
        const deadlineDiff = Math.abs(calculatedDeadline.getTime() - new Date(currentGameweek.deadline).getTime());
        if (deadlineDiff < 60000) { // Within 1 minute
          console.log('   ✅ Deadline is correctly set to 2 hours before first match');
        } else {
          console.log('   ⚠️ Deadline might not be exactly 2 hours before first match');
        }
      } else {
        console.log('   ⚠️ No fixtures found for current gameweek');
      }
    } catch (error) {
      console.log(`   ⚠️ Could not fetch fixtures: ${error.message}`);
    }
    
    // Test 5: Test GET requests (should not be blocked)
    console.log('\n5️⃣ Testing GET Requests (Should Not Be Blocked)...');
    const req3 = createMockRequest(regularUser, '/api/team/current', 'GET');
    const { res: res3, responseData: data3 } = createMockResponse();
    
    middlewareCalled = false;
    const next3 = () => { middlewareCalled = true; };
    
    await checkDeadlineMiddleware(req3 as Request, res3 as Response, next3);
    
    if (middlewareCalled) {
      console.log('   ✅ GET requests are not blocked by deadline');
    } else {
      console.log('   ❌ GET requests should not be blocked by deadline');
    }
    
    // Test 6: Test requireActiveDeadline middleware
    console.log('\n6️⃣ Testing requireActiveDeadline Middleware...');
    const req4 = createMockRequest(regularUser, '/api/team/save', 'POST');
    req4.deadlineInfo = {
      gameweek: currentGameweek,
      isDeadlinePassed: timeUntilDeadline <= 0,
      isGameweekCompleted: false,
      canModifyTeam: timeUntilDeadline > 0,
      message: timeUntilDeadline > 0 ? 'Team modifications allowed' : 'Deadline has passed'
    };
    
    const { res: res4, responseData: data4 } = createMockResponse();
    middlewareCalled = false;
    const next4 = () => { middlewareCalled = true; };
    
    requireActiveDeadline(req4 as Request, res4 as Response, next4);
    
    if (timeUntilDeadline > 0) {
      if (middlewareCalled) {
        console.log('   ✅ requireActiveDeadline allows access before deadline');
      } else {
        console.log('   ❌ requireActiveDeadline should allow access before deadline');
      }
    } else {
      if (data4.statusCode === 403) {
        console.log('   ✅ requireActiveDeadline blocks access after deadline');
      } else {
        console.log('   ❌ requireActiveDeadline should block access after deadline');
      }
    }
    
    // Test 7: Update deadline to test functionality
    console.log('\n7️⃣ Testing Deadline Update Functionality...');
    try {
      const newDeadline = await fplAPI.getGameweekDeadline(currentGameweek.gameweekNumber);
      await storage.updateGameweekDeadline(currentGameweek.id, new Date(newDeadline));
      console.log(`   ✅ Deadline updated successfully to: ${newDeadline}`);
    } catch (error) {
      console.log(`   ❌ Failed to update deadline: ${error.message}`);
    }
    
    console.log('\n🎯 Summary:');
    console.log(`   • Gameweek ${currentGameweek.gameweekNumber} deadline: ${currentGameweek.deadline}`);
    console.log(`   • Deadline ${timeUntilDeadline > 0 ? 'has not' : 'has'} passed`);
    console.log(`   • Hours until deadline: ${hoursUntilDeadline.toFixed(2)}`);
    console.log(`   • Regular users ${timeUntilDeadline > 0 ? 'CAN' : 'CANNOT'} create/edit teams`);
    console.log(`   • Admin users CAN ALWAYS create/edit teams`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for standalone execution
if (require.main === module) {
  testDeadlineEnforcement().then(() => {
    console.log('\n✅ Deadline enforcement test completed!');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { testDeadlineEnforcement };
