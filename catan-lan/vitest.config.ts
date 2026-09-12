import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Avoid Vite's postcss-config auto-search climbing into the parent
  // Next.js app's postcss.config.mjs (this project has no CSS to process).
  css: { postcss: { plugins: [] } },
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'client/**/*.test.ts', 'client/**/*.test.tsx'],
    // shared/server tests are plain Node logic (faster in 'node'); client
    // tests that touch the DOM opt into jsdom per-file via a
    // `// @vitest-environment jsdom` directive at the top of the file.
    environment: 'node',
    setupFiles: ['client/src/__tests__/setup.ts'],
    testTimeout: 15000,
  },
});
