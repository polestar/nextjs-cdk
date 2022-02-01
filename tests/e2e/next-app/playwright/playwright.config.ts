import { PlaywrightTestConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const config: PlaywrightTestConfig = {
  testDir: 'specs/',
  outputDir: 'test-results/',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: 'retain-on-failure',
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
};
export default config;
