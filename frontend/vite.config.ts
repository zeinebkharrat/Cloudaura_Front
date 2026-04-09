import { defineConfig } from 'vite';

/** Same origin as `src/proxy.conf.json` and Spring `server.port` (9091). 127.0.0.1 avoids some Windows localhost/IPv6 issues. */
const backend = 'http://127.0.0.1:9091';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
      },
      '/uploads': { target: backend, changeOrigin: true, secure: false },
      '/post': { target: backend, changeOrigin: true, secure: false },
      '/comment': { target: backend, changeOrigin: true, secure: false },
      '/like': { target: backend, changeOrigin: true, secure: false },
      '/media': { target: backend, changeOrigin: true, secure: false },
      '/follow': { target: backend, changeOrigin: true, secure: false },
      '/saved-post': { target: backend, changeOrigin: true, secure: false },
      '/chatroom': { target: backend, changeOrigin: true, secure: false },
      '/ws': { target: backend, changeOrigin: true, secure: false, ws: true },
      '/ws-native': { target: backend, changeOrigin: true, secure: false, ws: true },
    },
  },
});
