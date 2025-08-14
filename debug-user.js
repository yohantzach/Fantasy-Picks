require('dotenv').config();
const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');
const { users, paymentProofs } = require('./shared/schema');
const { eq } = require('drizzle-orm');

async function checkUser() {
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);
  
  console.log('🔍 All users in database:');
  const allUsers = await db.select().from(users);
  allUsers.forEach(u => {
    console.log(`ID: ${u.id}, Email: ${u.email}, HasPaid: ${u.hasPaid}`);
  });
  
  // Find user2@gmail.com
  const user2 = allUsers.find(u => u.email === 'user2@gmail.com');
  if (user2) {
    console.log(`\n👤 Found user2@gmail.com: ID = ${user2.id}, HasPaid = ${user2.hasPaid}`);
    
    // Check if this user has any payment proofs
    const userPayments = await db.select().from(paymentProofs).where(eq(paymentProofs.userId, user2.id));
    console.log(`💳 Payment proofs for user2@gmail.com:`, userPayments.length);
    
    if (userPayments.length === 0) {
      console.log('❌ This explains why payment history is empty!');
      console.log('💡 The user has hasPaid=true but no payment_proofs records');
    } else {
      userPayments.forEach(p => {
        console.log(`- Payment ID: ${p.id}, Status: ${p.status}, Amount: ${p.amount}`);
      });
    }
  } else {
    console.log('❌ user2@gmail.com not found in database');
  }
}

checkUser().catch(console.error);
