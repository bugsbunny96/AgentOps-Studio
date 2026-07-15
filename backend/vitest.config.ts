import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test-utils/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/test-utils/**',
        'src/index.ts',        // entry point — covered by integration
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
      },
    },
    testTimeout: 15000,        // mongo-memory-server can be slow to start
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
