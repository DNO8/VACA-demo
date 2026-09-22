import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/testnet',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
});
