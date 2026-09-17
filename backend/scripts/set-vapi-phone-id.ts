/**
 * One-time script: sets vapiPhoneNumberId on the Ritu Electricals org
 * Run: cd backend && npx tsx /tmp/set-vapi-phone-id.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI!;
const VAPI_PHONE_NUMBER_ID = 'd2823698-8ffc-4aec-b4a5-701c3995fbf9';
const PHONE_NUMBER = '+918065354620';
const VAPI_ASSISTANT_ID = '100b3bd9-5038-4f11-b487-7ced98d8a3dd';

async function main() {
  await mongoose.connect(MONGO_URI);

  const db = mongoose.connection.db!;
  const orgs = db.collection('organizations');

  // Find Ritu Electricals — identify by phone number or name
  const filter = {
    $or: [
      { phoneNumber: PHONE_NUMBER },
      { name: { $regex: /ritu/i } },
    ]
  };

  const existing = await orgs.findOne(filter);
  if (!existing) {
    console.error('❌ Could not find the Ritu Electricals org. Check your DB.');
    process.exit(1);
  }
  console.log(`Found org: "${existing.name}" (${existing._id})`);
  console.log(`  Current vapiPhoneNumberId: ${existing.vapiPhoneNumberId ?? 'NOT SET'}`);
  console.log(`  Current vapiAssistantId:   ${existing.vapiAssistantId ?? 'NOT SET'}`);
  console.log(`  Current phoneNumber:       ${existing.phoneNumber ?? 'NOT SET'}`);
  console.log(`  Current telephonyProvider: ${existing.telephonyProvider ?? 'NOT SET'}`);

  const result = await orgs.updateOne(filter, {
    $set: {
      vapiPhoneNumberId: VAPI_PHONE_NUMBER_ID,
      vapiAssistantId:   VAPI_ASSISTANT_ID,
      phoneNumber:       PHONE_NUMBER,
      telephonyProvider: 'vobiz',
    }
  });

  console.log(`\n✅ Updated ${result.modifiedCount} org document(s).`);
  console.log(`  vapiPhoneNumberId → ${VAPI_PHONE_NUMBER_ID}`);
  console.log(`  vapiAssistantId   → ${VAPI_ASSISTANT_ID}`);
  console.log(`  phoneNumber       → ${PHONE_NUMBER}`);
  console.log(`  telephonyProvider → vobiz`);

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
