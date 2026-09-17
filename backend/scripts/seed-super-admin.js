/**
 * seed-super-admin.js
 * Creates (or resets) the dedicated super admin account.
 *
 * Usage — run from the backend/ directory:
 *   node scripts/seed-super-admin.js
 *
 * What it does:
 *   • If a user with email "superAdmin@3127" already exists → updates password + ensures isSuperAdmin=true
 *   • If no such user exists → creates one fresh (verified, active, isSuperAdmin=true)
 *
 * Credentials written:
 *   Email    : superAdmin@3127
 *   Password : Super.Admin@2731
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const SA_EMAIL    = 'superadmin@3127';   // stored lowercase — Mongoose lowercases all email queries
const SA_PASSWORD = 'Super.Admin@2731';
const SA_NAME     = 'Super Admin';

async function run() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected:', process.env.MONGODB_URI);

  const col = mongoose.connection.db.collection('users');

  const passwordHash = await bcrypt.hash(SA_PASSWORD, 12);

  const existing = await col.findOne({ email: SA_EMAIL });

  if (existing) {
    // ── Update existing account ────────────────────────────────────────
    await col.updateOne(
      { email: SA_EMAIL },
      {
        $set: {
          passwordHash,
          isSuperAdmin: true,
          isVerified:   true,
          status:       'Active',
          name:         SA_NAME,
          updatedAt:    new Date(),
        },
      }
    );
    console.log(`✓ Existing account updated — isSuperAdmin=true, password reset.`);
  } else {
    // ── Create fresh account ───────────────────────────────────────────
    await col.insertOne({
      name:         SA_NAME,
      email:        SA_EMAIL,
      passwordHash,
      isSuperAdmin: true,
      isVerified:   true,
      status:       'Active',
      createdAt:    new Date(),
      updatedAt:    new Date(),
      __v:          0,
    });
    console.log(`✓ New super admin account created.`);
  }

  console.log('\n── Super Admin Credentials ────────────────────────');
  console.log(`   URL      : http://localhost:5173/superadmin/login`);
  console.log(`   Email    : ${SA_EMAIL}`);
  console.log(`   Password : ${SA_PASSWORD}`);
  console.log('───────────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
