/**
 * Clean and reseed KB documents for Ritu Electricals.
 *
 * Deletes all 14 contaminated Godrej Packers documents and replaces them
 * with correct Ritu Electricals knowledge-base entries.
 *
 * Run: npx tsx scripts/clean-kb-docs.ts
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();
import { connectDatabase } from '../src/config/database';
import { OrganizationModel } from '../src/modules/organization/organization.model';

// ── Fresh Ritu Electricals KB content ────────────────────────────────────────

const RITU_KB_DOCS = [
  {
    title: 'About Ritu Electricals',
    content: `# About Ritu Electricals

Ritu Electricals is an electrical goods retail shop based in the Tri-City Chandigarh area (Chandigarh, Mohali, Panchkula), serving customers across India with home delivery.

**What we sell:** wiring & cables, switches & sockets, MCBs & distribution boards, ceiling fans & exhaust fans, LED lighting (bulbs, panels, tube lights, flood lights), smart home devices, electrical tools, and general electrical accessories.

**Shop Hours:**
- Monday to Saturday: 9:30 am – 8:30 pm
- Sunday: 9:30 am – 4:00 pm

**Delivery:** PAN India via courier/logistics. Estimated 3–7 business days. We do not promise specific delivery dates.

**Payment:** The shop team will contact you after order confirmation to arrange payment (cash on delivery or UPI request). We never take card/UPI details over the phone.

**Language:** We serve customers in Hindi, English, and Hinglish.`,
  },
  {
    title: 'Ordering & Delivery Policy',
    content: `# Ordering & Delivery Policy

## How to Place an Order
1. Tell us the product(s) and quantity you need.
2. Specify pickup (from shop) or home delivery.
3. For delivery, provide: full name, contact number, and complete address (house/flat number, street, locality, city, PIN code).
4. We confirm the order summary and proceed.

## Delivery
- PAN India delivery via courier/logistics partners.
- Estimated 3–7 business days from dispatch.
- We do not guarantee specific delivery dates or time windows.

## Payment
- Payment is NOT taken on the call.
- After order confirmation, our team contacts you to arrange payment via cash on delivery or UPI transfer.
- We never ask for card numbers, OTPs, or UPI PINs over the phone.

## Order Confirmation
An order is confirmed only when our AI receptionist explicitly says so. If the system is unavailable, our team will follow up manually.`,
  },
  {
    title: 'Product Categories & Brands',
    content: `# Product Categories at Ritu Electricals

## Lighting
LED bulbs, LED panel lights, LED tube lights, LED downlights, LED flood lights, emergency rechargeable lights.
Top brands: Philips, Wipro, Havells, Syska, Bajaj.

## Fans
Ceiling fans (1200mm), exhaust fans, wall fans.
Top brands: Crompton, Havells, Usha, Bajaj.

## Switches & Sockets
Modular switches (6A, 16A), 5-pin sockets, 16A sockets, bell push switches.
Top brands: Anchor, Legrand, GM, Havells.

## Wires & Cables
Copper wires in 1.5 sq mm, 2.5 sq mm, 4 sq mm; sold in 90m coils.
Top brands: Polycab, Finolex, Havells.

## Protection Devices
MCBs (single pole 16A, double pole 32A), distribution boards (8-way).
Top brands: Schneider Electric, L&T, Havells.

## Electrical Tools
Digital multimeters, electric testers/screwdrivers.
Top brands: Meco, Stanley.

## Electrical Accessories
Insulation tape, extension boards (4-socket), door bells (wired), plug tops (6A, 16A).
Top brands: 3M, GM, Havells, Anchor, Legrand.

## Smart Home
Smart Wi-Fi LED bulbs, smart plugs, smart LED strips.
Top brands: Wipro, Philips.`,
  },
  {
    title: 'FAQs',
    content: `# Frequently Asked Questions

**Q: Do you deliver outside Chandigarh?**
A: Yes, we deliver PAN India via courier. Estimated 3–7 business days.

**Q: Can I pick up from the shop?**
A: Yes, pickup is available during shop hours (Mon–Sat 9:30 am–8:30 pm, Sun 9:30 am–4:00 pm).

**Q: How do I pay?**
A: Payment is arranged after order confirmation — our team will contact you for cash on delivery or UPI. We never take payment details on the call.

**Q: Do you have stock of [product]?**
A: Stock levels are listed in our catalog. For large orders, please call to confirm current availability.

**Q: Can I return a product?**
A: Please contact the shop directly for returns and exchange queries. Our AI receptionist cannot process returns on the call.

**Q: Do you offer installation services?**
A: We currently focus on product sales. For installation queries, speak to our shop team.

**Q: What brands do you carry?**
A: Philips, Wipro, Havells, Bajaj, Syska, Crompton, Usha, Anchor, Legrand, GM, Polycab, Finolex, Schneider Electric, L&T, Meco, Stanley, 3M, and more.

**Q: Are your prices negotiable?**
A: Our catalog prices are fixed. For bulk orders, please speak to the shop owner directly.`,
  },
];

async function run() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  console.log('✅  Connected to Atlas\n');

  // Get org
  const org = await OrganizationModel.findOne({});
  if (!org) throw new Error('No org found');

  // Count and delete all existing KB docs
  const before = await db.collection('kbdocuments').countDocuments();
  console.log(`📋  Found ${before} contaminated KB documents (all Godrej Packers)`);

  await db.collection('kbdocuments').deleteMany({});
  console.log(`🗑️   Deleted all ${before} documents\n`);

  // Insert fresh Ritu Electricals KB docs
  const now = new Date();
  const toInsert = RITU_KB_DOCS.map((doc, i) => ({
    _id:            new mongoose.Types.ObjectId(),
    organizationId: org._id,
    title:          doc.title,
    content:        doc.content,
    // Fields the KB model expects
    filename:       `ritu-electricals-kb-${i + 1}.md`,
    fileType:       'text/markdown',
    status:         'processed',
    source:         'manual',
    createdAt:      now,
    updatedAt:      now,
  }));

  await db.collection('kbdocuments').insertMany(toInsert);
  console.log(`✅  Inserted ${toInsert.length} fresh Ritu Electricals KB documents:`);
  toInsert.forEach((d, i) => console.log(`   ${i + 1}. ${d.title}`));

  const after = await db.collection('kbdocuments').countDocuments();
  console.log(`\n📊  Atlas kbdocuments: ${after} documents`);

  await mongoose.disconnect();
  console.log('\n✅  KB cleaned and reseeded.');
  console.log('⏭️  NEXT: fix Issue #5 (webhook validation errors)');
}

run().catch(err => {
  console.error('❌  Failed:', err.message);
  process.exit(1);
});
