import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = process.env.PORT || 8000;

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true
      },
      '/socket.io': {
        target: `http://localhost:${apiPort}`,
        ws: true,
        changeOrigin: true
      }
    }
  }
});
