import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      // Angular services call `/api/...` but Spring endpoints are `/post/...`, `/comment/...`, etc.
      // So we strip the `/api` prefix while proxying.
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },

      // Media URLs are returned by Spring as `/uploads/...`.
      '/uploads': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },

      // Some parts of the app call Spring endpoints without the `/api` prefix.
      // Proxy them directly to the backend to avoid AggregateError connection failures.
      '/post': { target: 'http://localhost:8081', changeOrigin: true, secure: false },
      '/comment': { target: 'http://localhost:8081', changeOrigin: true, secure: false },
      '/like': { target: 'http://localhost:8081', changeOrigin: true, secure: false },
      '/media': { target: 'http://localhost:8081', changeOrigin: true, secure: false },
      '/auth': { target: 'http://localhost:8081', changeOrigin: true, secure: false },
      '/cities': { target: 'http://localhost:8081', changeOrigin: true, secure: false },
      '/public': { target: 'http://localhost:8081', changeOrigin: true, secure: false },
    },
  },
});

