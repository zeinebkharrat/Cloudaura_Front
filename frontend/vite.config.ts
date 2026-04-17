import { defineConfig } from 'vite';

const BACKEND = 'http://localhost:9091';

export default defineConfig({
  server: {
    proxy: {
      // Align with backend `server.port` (default 9091) and `src/proxy.conf.json`.
      // Angular services call `/api/...` but Spring endpoints are `/post/...`, `/comment/...`, etc.
      // So we strip the `/api` prefix while proxying.
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
      },

      // Media URLs are returned by Spring as `/uploads/...`.
      '/uploads': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },

      // SockJS/STOMP: `/ws/info`, WebSocket upgrade — needs `ws: true` or Vite logs ECONNREFUSED.
      '/ws': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        ws: true,
      },

      // Some parts of the app call Spring endpoints without the `/api` prefix.
      // Proxy them directly to the backend to avoid AggregateError connection failures.
      '/post': { target: BACKEND, changeOrigin: true, secure: false },
      '/comment': { target: BACKEND, changeOrigin: true, secure: false },
      '/like': { target: BACKEND, changeOrigin: true, secure: false },
      '/media': { target: BACKEND, changeOrigin: true, secure: false },
      '/auth': { target: BACKEND, changeOrigin: true, secure: false },
      '/cities': { target: BACKEND, changeOrigin: true, secure: false },
      '/public': { target: BACKEND, changeOrigin: true, secure: false },
      '/follow': { target: BACKEND, changeOrigin: true, secure: false },
      '/saved-post': { target: BACKEND, changeOrigin: true, secure: false },
      '/chatroom': { target: BACKEND, changeOrigin: true, secure: false },
      '/story': { target: BACKEND, changeOrigin: true, secure: false },
    },
  },
});
