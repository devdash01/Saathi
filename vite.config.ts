import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash]-v2.js',
        chunkFileNames: 'assets/[name]-[hash]-v2.js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api/sarvam': {
        target: 'https://api.sarvam.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sarvam/, ''),
        headers: {
          'api-subscription-key': 'sk_bafne65q_tmDmBcTLO5NV6z24j0dJq7Gh'
        }
      }
    }
  }
});

