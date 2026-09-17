/**
 * make-super-admin.js
 * One-shot script: sets isSuperAdmin = true on a user by email.
 *
 * Usage:
 *   node scripts/make-super-admin.js b.rishu.pandit@gmail.com
 *
 * Run from the backend/ directory with the backend server stopped (or running — it's just a DB write).
 */

require('dotenv').config();
const mongoose = require('mongoose');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/make-super-admin.js <email>');
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB:', process.env.MONGODB_URI);

  const result = await mongoose.connection.db
    .collection('users')
    .updateOne(
      { email: email.toLowerCase() },
      { $set: { isSuperAdmin: true } }
    );

  if (result.matchedCount === 0) {
    console.error(`✗ No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`✓ isSuperAdmin = true set on ${email}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
