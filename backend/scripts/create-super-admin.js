/**
 * create-super-admin.js
 * Creates (or upserts) the super admin user with fixed credentials.
 *
 * Usage:
 *   node scripts/create-super-admin.js
 *
 * Run once from the backend/ directory. Safe to re-run — it upserts.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const SA_IDENTIFIER = 'superAdmin@3127';
const SA_PASSWORD   = 'Super.Admin@2731';
const SA_NAME       = 'Super Admin';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB:', process.env.MONGODB_URI);

  const db = mongoose.connection.db;

  // Hash the password exactly as the UserModel does (12 rounds)
  const passwordHash = await bcrypt.hash(SA_PASSWORD, 12);

  const result = await db.collection('users').updateOne(
    { email: SA_IDENTIFIER },
    {
      $set: {
        name:         SA_NAME,
        email:        SA_IDENTIFIER,
        passwordHash,
        isSuperAdmin: true,
        isVerified:   true,
        status:       'Active',
        updatedAt:    new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    console.log(`✓ Super admin created`);
  } else {
    console.log(`✓ Super admin updated (already existed — password and flags refreshed)`);
  }

  console.log(`\n  Username : ${SA_IDENTIFIER}`);
  console.log(`  Password : ${SA_PASSWORD}`);
  console.log(`  URL      : http://localhost:5173/superadmin/login\n`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
