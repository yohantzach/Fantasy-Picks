import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users } from "./shared/schema.js";
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
        const email = String(user.email).padEnd(28);
        const name = String(user.name).padEnd(22);
        const isAdmin = user.isAdmin ? "   ✅   " : "   ❌   ";
        const hasPaid = user.hasPaid ? "    ✅    " : "    ❌    ";
        const created = new Date(user.createdAt).toLocaleDateString().padEnd(7);
        
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
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
        
      if (recentUsers.length > 0) {
        console.log(`\n🆕 Recent Users (Last ${Math.min(5, allUsers.length)}):`);
        recentUsers.forEach((user, index) => {
          const createdDate = new Date(user.createdAt).toLocaleDateString();
          console.log(`   ${index + 1}. ${user.name} (${user.email}) - ${createdDate}`);
        });
      }
    }
    
  } catch (error) {
    console.error("❌ Error querying database:", error);
    console.error("Details:", error.message);
  } finally {
    await pool.end();
    console.log("\n✅ Database connection closed.");
  }
}

// Run the script
checkAllUsers().catch(console.error);
