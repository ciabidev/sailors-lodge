import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  publicDir: path.resolve(__dirname, '../static'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { outDir: path.resolve(__dirname, '../dist/dashboard'), emptyOutDir: true },
  server: {
    port: 3002,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:7999',
      '/auth': 'http://localhost:7999',
      '/invite': 'http://localhost:7999',
      '/brand': 'http://localhost:7999',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
});
