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
      // Dev-only proxy for the Intuition GraphQL endpoint so the browser
      // talks to localhost (no CORS), and Vite forwards to mainnet.
      // /v1/graphql on localhost -> https://mainnet.intuition.sh/v1/graphql
      '/v1/graphql': {
        target: 'https://mainnet.intuition.sh',
        changeOrigin: true,
        secure: false,
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