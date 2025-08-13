import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";
import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

dotenv.config();

const scryptAsync = promisify(scrypt);

async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      return false; // Invalid format
    }
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    return false;
  }
}

async function checkUserPassword(email: string) {
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
    console.log(`🔍 Looking for user: ${email}`);
    
    // Query specific user
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (user.length === 0) {
      console.log("🚫 User not found in the database.");
      return;
    }

    const userData = user[0];
    
    console.log(`\n👤 User Found:`);
    console.log(`   ID: ${userData.id}`);
    console.log(`   Name: ${userData.name}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Phone: ${userData.phone}`);
    console.log(`   Age: ${userData.age}`);
    console.log(`   Gender: ${userData.gender}`);
    console.log(`   Is Admin: ${userData.isAdmin ? '✅ Yes' : '❌ No'}`);
    console.log(`   Has Paid: ${userData.hasPaid ? '✅ Yes' : '❌ No'}`);
    console.log(`   Payment ID: ${userData.paymentId || 'N/A'}`);
    console.log(`   Created: ${userData.createdAt ? new Date(userData.createdAt).toLocaleString() : 'N/A'}`);
    
    console.log(`\n🔐 Password Information:`);
    console.log(`   Stored Hash: ${userData.password}`);
    
    // Check if it looks like scrypt hash (hex.hex format)
    const isScryptHash = userData.password.includes('.') && userData.password.split('.').length === 2;
    console.log(`   Is Scrypt Hash: ${isScryptHash ? '✅ Yes' : '❌ No'}`);
    
    if (!isScryptHash) {
      console.log(`   ⚠️  Warning: This might be a plain text password or different hash format!`);
      console.log(`   Raw Password: ${userData.password}`);
      
      // Test if it's plain text by comparing directly
      const commonPasswords = ['password', 'test', '123456', 'test123', 'password123'];
      console.log(`\n🔍 Testing if password is plain text...`);
      for (const testPassword of commonPasswords) {
        if (userData.password === testPassword) {
          console.log(`   ✅ PLAIN TEXT PASSWORD FOUND: "${testPassword}"`);
          return;
        }
      }
      console.log(`   ❌ Not a common plain text password`);
    } else {
      console.log(`   🔒 Password is properly hashed using scrypt`);
      
      // Try common passwords with scrypt
      const commonPasswords = [
        'password', 'test', '123456', 'test123', 'password123',
        'admin', 'admin123', 'fantasypicks', 'fantasypicks09', 
        '1234567890', '12345678', 'qwerty', 'letmein',
        '123123', 'Password123', 'Admin123', 'secret',
        'football', 'fpl', '000000', '111111', '999999'
      ];
      
      console.log(`\n🔍 Testing common passwords...`);
      for (const testPassword of commonPasswords) {
        try {
          const isMatch = await comparePasswords(testPassword, userData.password);
          if (isMatch) {
            console.log(`   ✅ PASSWORD FOUND: "${testPassword}"`);
            break;
          }
        } catch (error) {
          // Ignore comparison errors
        }
      }
    }
    
  } catch (error) {
    console.error("❌ Error querying database:", error);
    if (error instanceof Error) {
      console.error("Details:", error.message);
    }
  } finally {
    await pool.end();
    console.log("\n✅ Database connection closed.");
  }
}

// Check admin user password
checkUserPassword("fantasypicks09@gmail.com").catch(console.error);
