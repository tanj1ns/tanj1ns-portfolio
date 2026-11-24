import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  esbuild: {
    drop: ['debugger']
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020'
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
      '/uploads': 'http://127.0.0.1:4000'
    }
  }
});
