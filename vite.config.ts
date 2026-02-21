import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
  // This maps the system environment variable API_KEY 
  // to process.env.API_KEY in your code during build time.
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
  },
});