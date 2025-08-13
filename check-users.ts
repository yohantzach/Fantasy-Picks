import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users } from "@shared/schema";
import dotenv from "dotenv";

dotenv.config();

async function checkAllUsers() {
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

  const db = drizzle(pool, { schema: { users } });

  try {
    console.log("🔍 Connecting to database...");
    
    // Query all users
    const allUsers = await db.select().from(users);
    
    console.log(`\n📊 Found ${allUsers.length} users in the database:\n`);
    
    if (allUsers.length === 0) {
      console.log("🚫 No users found in the database.");
    } else {
      // Display users in a formatted table
      console.log("┌─────┬──────────────────────────────┬────────────────────────┬─────────┬───────────┬─────────┐");
      console.log("│ ID  │ Email                        │ Name                   │ Admin   │ Has Paid  │ Created │");
      console.log("├─────┼──────────────────────────────┼────────────────────────┼─────────┼───────────┼─────────┤");
      
      allUsers.forEach(user => {
        const id = String(user.id).padEnd(3);
        const email = String(user.email).substring(0, 28).padEnd(28);
        const name = String(user.name).substring(0, 22).padEnd(22);
        const isAdmin = user.isAdmin ? "   ✅   " : "   ❌   ";
        const hasPaid = user.hasPaid ? "    ✅    " : "    ❌    ";
        const created = user.createdAt ? new Date(user.createdAt).toLocaleDateString().substring(0, 7).padEnd(7) : "N/A".padEnd(7);
        
        console.log(`│ ${id} │ ${email} │ ${name} │ ${isAdmin} │ ${hasPaid} │ ${created} │`);
      });
      
      console.log("└─────┴──────────────────────────────┴────────────────────────┴─────────┴───────────┴─────────┘");
      
      // Summary statistics
      const adminCount = allUsers.filter(u => u.isAdmin).length;
      const paidCount = allUsers.filter(u => u.hasPaid).length;
      
      console.log(`\n📈 Statistics:`);
      console.log(`   • Total Users: ${allUsers.length}`);
      console.log(`   • Admin Users: ${adminCount}`);
      console.log(`   • Paid Users: ${paidCount}`);
      console.log(`   • Unpaid Users: ${allUsers.length - paidCount}`);
      
      // Show admin users specifically
      const adminUsers = allUsers.filter(u => u.isAdmin);
      if (adminUsers.length > 0) {
        console.log(`\n👑 Admin Users:`);
        adminUsers.forEach(admin => {
          console.log(`   • ${admin.name} (${admin.email}) - ID: ${admin.id}`);
        });
      }
      
      // Show recent users (last 5)
      const recentUsers = allUsers
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5);
        
      if (recentUsers.length > 0) {
        console.log(`\n🆕 Recent Users (Last ${Math.min(5, allUsers.length)}):`);
        recentUsers.forEach((user, index) => {
          const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A";
          console.log(`   ${index + 1}. ${user.name} (${user.email}) - ${createdDate}`);
        });
      }

      // Show user details (first 3 for detailed view)
      if (allUsers.length > 0) {
        console.log(`\n🔍 Detailed View (First 3 Users):`);
        allUsers.slice(0, 3).forEach((user, index) => {
          console.log(`\n   ${index + 1}. User Details:`);
          console.log(`      ID: ${user.id}`);
          console.log(`      Name: ${user.name}`);
          console.log(`      Email: ${user.email}`);
          console.log(`      Phone: ${user.phone}`);
          console.log(`      Age: ${user.age}`);
          console.log(`      Gender: ${user.gender}`);
          console.log(`      Is Admin: ${user.isAdmin ? '✅ Yes' : '❌ No'}`);
          console.log(`      Has Paid: ${user.hasPaid ? '✅ Yes' : '❌ No'}`);
          console.log(`      Payment ID: ${user.paymentId || 'N/A'}`);
          console.log(`      Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}`);
        });
      }
    }
    
  } catch (error) {
    console.error("❌ Error querying database:", error);
    if (error instanceof Error) {
      console.error("Details:", error.message);
      console.error("Stack:", error.stack);
    }
  } finally {
    await pool.end();
    console.log("\n✅ Database connection closed.");
  }
}

// Export for potential use as module
export { checkAllUsers };

// Run the script directly
checkAllUsers().catch(console.error);
