/**
 * 🟣 Test Engineer — Logger Tests
 * Tests: Winston logger exports + log levels
 */
import { describe, it, expect, vi } from 'vitest';

// Un-mock logger for this file so we test the real module
vi.unmock('@/utils/logger');

describe('logger', () => {
  it('exports a logger with expected methods', async () => {
    const { logger } = await import('@/utils/logger');

    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('logger.info does not throw', async () => {
    const { logger } = await import('@/utils/logger');
    expect(() => logger.info('test log message')).not.toThrow();
  });

  it('logger.error does not throw with metadata', async () => {
    const { logger } = await import('@/utils/logger');
    expect(() => logger.error('test error', { code: 'TEST_ERR' })).not.toThrow();
  });

  it('exports a stream object for Morgan', async () => {
    const { logger } = await import('@/utils/logger');
    expect(logger).toHaveProperty('stream');
    // @ts-expect-error stream is a custom extension
    expect(typeof logger.stream.write).toBe('function');
  });
});
