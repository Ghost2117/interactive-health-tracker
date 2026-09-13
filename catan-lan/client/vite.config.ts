import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  // Avoid Vite's postcss-config auto-search climbing into the parent
  // Next.js app's postcss.config.mjs (this project has no CSS pipeline).
  css: { postcss: { plugins: [] } },
  server: {
    host: true,
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
