import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  cacheDir: '.vite-cache',
  resolve: {
    preserveSymlinks: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom/client'],
  },
  server: {
    host: '0.0.0.0',
    port: 5176,
    hmr: {
      overlay: false,
    },
  },
}));
