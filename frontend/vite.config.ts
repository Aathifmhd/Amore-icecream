import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    build: {
      rollupOptions: {
        output: {
          // Libraries change rarely, so ship them as separate long-cached files
          manualChunks: {
            react: ['react', 'react-dom'],
          },
        },
      },
    },
    server: {
      // The backend (npm run dev in ../backend) answers /api
      proxy: {
        '/api': 'http://localhost:4100',
      },
    },
  };
});
