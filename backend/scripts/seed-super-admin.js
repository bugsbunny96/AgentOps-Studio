/**
 * seed-super-admin.js
 * Creates or resets the dedicated super-admin account (SEC-02).
 *
 * Credentials are never stored in this file. Provide them via env or prompt:
 *   SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD='…' node scripts/seed-super-admin.js
 *   node scripts/seed-super-admin.js            # prompts for anything missing
 *
 * Password rules: ≥ 14 chars with upper, lower, digit and symbol.
 * The password is never printed.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const readline = require('readline');

const SA_NAME = 'Super Admin';

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

function passwordProblems(pw) {
  const p = [];
  if (pw.length < 14) p.push('at least 14 characters');
  if (!/[A-Z]/.test(pw)) p.push('an uppercase letter');
  if (!/[a-z]/.test(pw)) p.push('a lowercase letter');
  if (!/\d/.test(pw)) p.push('a digit');
  if (!/[^A-Za-z0-9]/.test(pw)) p.push('a symbol');
  return p;
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set in .env');

  const email = (process.env.SUPER_ADMIN_EMAIL || await ask('Super-admin email: ')).toLowerCase();
  if (!email) throw new Error('Email is required');

  const password = process.env.SUPER_ADMIN_PASSWORD || await ask('New password (hidden): ', { hidden: true });
  const problems = passwordProblems(password);
  if (problems.length) throw new Error(`Password needs ${problems.join(', ')}`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const col = mongoose.connection.db.collection('users');
  const passwordHash = await bcrypt.hash(password, 12);   // same cost as UserModel

  const result = await col.updateOne(
    { email },
    {
      $set: { name: SA_NAME, email, passwordHash, isSuperAdmin: true, isVerified: true, status: 'Active', updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date(), __v: 0 },
    },
    { upsert: true },
  );

  console.log(result.upsertedCount ? `✓ Super admin created: ${email}` : `✓ Super admin updated (password reset): ${email}`);
  console.log('  Log in at /superadmin/login. Store the password in your password manager.');
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
