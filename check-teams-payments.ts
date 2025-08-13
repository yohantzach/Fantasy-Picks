import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users, teams, paymentProofs, gameweeks } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function checkTeamsAndPayments(userEmail: string) {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not found in environment variables");
    process.exit(1);
  }

  const { Pool } = pg;
  
  // Create connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: false } 
      : false,
  });

  const db = drizzle(pool, { schema: { users, teams, paymentProofs, gameweeks } });

  try {
    console.log(`🔍 Checking teams and payments for: ${userEmail}`);
    
    // Find user
    const user = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
    if (user.length === 0) {
      console.log("❌ User not found");
      return;
    }

    const userData = user[0];
    console.log(`\n👤 User: ${userData.name} (ID: ${userData.id})`);
    console.log(`   Admin: ${userData.isAdmin ? '✅ Yes' : '❌ No'}`);
    console.log(`   Has Paid: ${userData.hasPaid ? '✅ Yes' : '❌ No'}`);

    // Get current gameweek
    const currentGameweeks = await db.select().from(gameweeks).where(eq(gameweeks.isActive, true)).limit(1);
    if (currentGameweeks.length === 0) {
      console.log("❌ No active gameweek found");
      return;
    }

    const currentGameweek = currentGameweeks[0];
    console.log(`\n🎯 Current Gameweek: ${currentGameweek.gameweekNumber}`);
    console.log(`   Deadline: ${new Date(currentGameweek.deadline).toLocaleString()}`);
    console.log(`   Is Active: ${currentGameweek.isActive ? '✅ Yes' : '❌ No'}`);
    console.log(`   Is Completed: ${currentGameweek.isCompleted ? '✅ Yes' : '❌ No'}`);

    // Get all user teams for current gameweek
    const userTeams = await db.select()
      .from(teams)
      .where(
        and(
          eq(teams.userId, userData.id),
          eq(teams.gameweekId, currentGameweek.id)
        )
      );

    console.log(`\n🏆 Teams for Current Gameweek (${userTeams.length} found):`);
    
    if (userTeams.length === 0) {
      console.log("   ❌ No teams found for current gameweek");
    } else {
      for (const team of userTeams) {
        console.log(`\n   📝 Team ${team.teamNumber}: "${team.teamName}"`);
        console.log(`      ID: ${team.id}`);
        console.log(`      Players: ${Array.isArray(team.players) ? team.players.length : 'Invalid'}/11`);
        console.log(`      Formation: ${team.formation}`);
        console.log(`      Total Value: £${team.totalValue}m`);
        console.log(`      Captain ID: ${team.captainId}`);
        console.log(`      Vice Captain ID: ${team.viceCaptainId}`);
        console.log(`      Is Active: ${team.isActive ? '✅ Yes' : '❌ No'}`);
        console.log(`      Is Locked: ${team.isLocked ? '✅ Yes' : '❌ No'}`);
        console.log(`      Created: ${new Date(team.createdAt).toLocaleString()}`);

        // Check payment status for this team
        const paymentProof = await db.select()
          .from(paymentProofs)
          .where(
            and(
              eq(paymentProofs.userId, userData.id),
              eq(paymentProofs.gameweekId, currentGameweek.id),
              eq(paymentProofs.teamNumber, team.teamNumber)
            )
          )
          .limit(1);

        if (paymentProof.length === 0) {
          console.log(`      💳 Payment Status: ❌ Not Submitted`);
        } else {
          const payment = paymentProof[0];
          console.log(`      💳 Payment Status: ${
            payment.status === 'approved' ? '✅ Approved' :
            payment.status === 'pending' ? '🟡 Pending' :
            payment.status === 'rejected' ? '❌ Rejected' :
            '❓ Unknown'
          }`);
          console.log(`         Payment Method: ${payment.paymentMethod}`);
          console.log(`         Transaction ID: ${payment.transactionId}`);
          console.log(`         Amount: £${payment.amount}`);
          console.log(`         Submitted: ${new Date(payment.submittedAt).toLocaleString()}`);
          if (payment.verifiedAt) {
            console.log(`         Verified: ${new Date(payment.verifiedAt).toLocaleString()}`);
          }
          if (payment.adminNotes) {
            console.log(`         Admin Notes: ${payment.adminNotes}`);
          }
        }

        // Determine if team can be edited
        const canEdit = paymentProof.length > 0 && 
                       paymentProof[0].status === 'approved' && 
                       new Date() <= new Date(currentGameweek.deadline);
        
        console.log(`      🖊️  Can Edit: ${canEdit ? '✅ Yes' : '❌ No'}`);
        
        if (!canEdit) {
          if (paymentProof.length === 0 || paymentProof[0].status !== 'approved') {
            console.log(`         Reason: Payment not approved`);
          } else if (new Date() > new Date(currentGameweek.deadline)) {
            console.log(`         Reason: Deadline passed`);
          }
        }
      }
    }

    // Get all payment proofs for this user and gameweek
    console.log(`\n💰 All Payment Proofs for Current Gameweek:`);
    const allPayments = await db.select()
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.userId, userData.id),
          eq(paymentProofs.gameweekId, currentGameweek.id)
        )
      );

    if (allPayments.length === 0) {
      console.log("   ❌ No payment proofs found");
    } else {
      allPayments.forEach((payment, index) => {
        console.log(`\n   Payment ${index + 1}:`);
        console.log(`      Team Number: ${payment.teamNumber}`);
        console.log(`      Status: ${payment.status}`);
        console.log(`      Method: ${payment.paymentMethod}`);
        console.log(`      Transaction ID: ${payment.transactionId}`);
        console.log(`      Amount: £${payment.amount}`);
        console.log(`      Submitted: ${new Date(payment.submittedAt).toLocaleString()}`);
      });
    }

    // Summary
    const approvedPayments = allPayments.filter(p => p.status === 'approved');
    const pendingPayments = allPayments.filter(p => p.status === 'pending');
    const rejectedPayments = allPayments.filter(p => p.status === 'rejected');

    console.log(`\n📊 Summary:`);
    console.log(`   • Total Teams: ${userTeams.length}`);
    console.log(`   • Total Payments: ${allPayments.length}`);
    console.log(`   • Approved Payments: ${approvedPayments.length}`);
    console.log(`   • Pending Payments: ${pendingPayments.length}`);
    console.log(`   • Rejected Payments: ${rejectedPayments.length}`);
    console.log(`   • Editable Teams: ${userTeams.filter(t => {
      const payment = allPayments.find(p => p.teamNumber === t.teamNumber);
      return payment?.status === 'approved' && new Date() <= new Date(currentGameweek.deadline);
    }).length}`);

  } catch (error) {
    console.error("❌ Error:", error);
    if (error instanceof Error) {
      console.error("Details:", error.message);
    }
  } finally {
    await pool.end();
    console.log("\n✅ Database connection closed.");
  }
}

// Check the test user's teams and payments
checkTeamsAndPayments("test@gamil.com").catch(console.error);
