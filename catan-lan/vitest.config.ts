import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Avoid Vite's postcss-config auto-search climbing into the parent
  // Next.js app's postcss.config.mjs (this project has no CSS to process).
  css: { postcss: { plugins: [] } },
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts'],
    testTimeout: 15000,
  },
});
