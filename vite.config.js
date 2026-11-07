import { defineConfig } from 'vite';

// Relative base so the built folder works from any path (YouTube Playables serves it from its own origin).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 300
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
});
