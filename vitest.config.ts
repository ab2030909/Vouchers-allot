import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    env: {
      NODE_ENV: 'test',
      USE_IN_MEMORY_DB: 'true',
      ADMIN_PASSWORD: 'test_admin_password',
      SESSION_SECRET: 'test-secret-key-that-is-at-least-32-chars-long!',
    },
  },
});
