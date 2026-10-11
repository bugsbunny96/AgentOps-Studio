/**
 * Global Vitest setup — runs before every test file.
 * Manages MongoMemoryServer lifecycle and suppresses console noise in tests.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Outbound calls are limited to 09:00–21:00 IST in production; tests run at any hour
process.env.OUTBOUND_CALLING_HOURS ??= '00:00-24:00';

let mongod: MongoMemoryServer;

// Suppress logger output during tests
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
    stream: { write: vi.fn() },
  },
}));

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'agentops_test' });
});

afterEach(async () => {
  // Clear all collections between tests — no shared state
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
