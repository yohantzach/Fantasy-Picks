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
    console.error("Password comparison error:", error);
    return false;
  }
}

async function testLogin(email: string, password: string) {
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
    console.log(`🔐 Testing Login for: ${email}`);
    console.log(`🔑 Password: ${password}`);
    
    // Step 1: Find user by email
    console.log("\n📋 Step 1: Finding user in database...");
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (user.length === 0) {
      console.log("❌ FAIL: User not found in database");
      console.log(`   Searched for email: ${email}`);
      console.log("   💡 Tip: Check if the email is correct in the database");
      return false;
    }

    const userData = user[0];
    console.log("✅ SUCCESS: User found in database");
    console.log(`   ID: ${userData.id}`);
    console.log(`   Name: ${userData.name}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Admin: ${userData.isAdmin ? 'Yes' : 'No'}`);
    
    // Step 2: Verify password format
    console.log("\n📋 Step 2: Checking password hash format...");
    const isScryptHash = userData.password.includes('.') && userData.password.split('.').length === 2;
    if (!isScryptHash) {
      console.log("❌ FAIL: Password is not in expected scrypt format");
      console.log(`   Stored password: ${userData.password}`);
      return false;
    }
    console.log("✅ SUCCESS: Password hash format is valid");
    console.log(`   Hash: ${userData.password.substring(0, 20)}...`);
    
    // Step 3: Compare passwords
    console.log("\n📋 Step 3: Comparing provided password with stored hash...");
    const isPasswordValid = await comparePasswords(password, userData.password);
    
    if (!isPasswordValid) {
      console.log("❌ FAIL: Password does not match");
      console.log("   💡 This means either:");
      console.log("      - The password is wrong");
      console.log("      - There's an issue with the hashing function");
      return false;
    }
    
    console.log("✅ SUCCESS: Password matches!");
    
    // Step 4: Check account status
    console.log("\n📋 Step 4: Checking account status...");
    console.log(`   Has Paid: ${userData.hasPaid ? '✅ Yes' : '❌ No'}`);
    console.log(`   Is Admin: ${userData.isAdmin ? '✅ Yes' : '❌ No'}`);
    console.log(`   Account Created: ${new Date(userData.createdAt).toLocaleString()}`);
    
    console.log("\n🎉 LOGIN TEST SUCCESSFUL!");
    console.log("   The authentication system is working correctly.");
    console.log("   User should be able to log in with these credentials.");
    
    return true;
    
  } catch (error) {
    console.error("❌ ERROR during login test:", error);
    if (error instanceof Error) {
      console.error("Details:", error.message);
      console.error("Stack:", error.stack);
    }
    return false;
  } finally {
    await pool.end();
    console.log("\n✅ Database connection closed.");
  }
}

async function runLoginTests() {
  console.log("🧪 COMPREHENSIVE LOGIN SYSTEM TEST\n");
  console.log("=" .repeat(50));
  
  // Test 1: Correct credentials for test user
  console.log("\n🔍 TEST 1: Testing with correct test user credentials");
  const test1Result = await testLogin("test@gamil.com", "123456");
  
  console.log("\n" + "=".repeat(50));
  
  // Test 2: Wrong password
  console.log("\n🔍 TEST 2: Testing with wrong password");
  const test2Result = await testLogin("test@gamil.com", "wrongpassword");
  
  console.log("\n" + "=".repeat(50));
  
  // Test 3: Wrong email
  console.log("\n🔍 TEST 3: Testing with wrong email");
  const test3Result = await testLogin("nonexistent@email.com", "123456");
  
  console.log("\n" + "=".repeat(50));
  
  // Test 4: Admin user
  console.log("\n🔍 TEST 4: Testing admin user");
  console.log("💡 We need to find the admin password first...");
  
  // Summary
  console.log("\n📊 TEST SUMMARY:");
  console.log(`   Test 1 (Correct login): ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Test 2 (Wrong password): ${test2Result ? '❌ UNEXPECTED PASS' : '✅ CORRECTLY FAILED'}`);
  console.log(`   Test 3 (Wrong email): ${test3Result ? '❌ UNEXPECTED PASS' : '✅ CORRECTLY FAILED'}`);
  
  if (test1Result && !test2Result && !test3Result) {
    console.log("\n🎉 ALL TESTS PASSED! Login system is working correctly.");
    console.log("\n📝 LOGIN CREDENTIALS:");
    console.log("   Email: test@gamil.com");
    console.log("   Password: 123456");
    console.log("   Note: Email is 'gamil' not 'gmail'");
  } else {
    console.log("\n❌ SOME TESTS FAILED! Please check the authentication system.");
  }
}

// Run the comprehensive tests
runLoginTests().catch(console.error);
