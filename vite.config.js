import { defineConfig } from 'vite';
import { planKey } from './scripts/plan-key.mjs';

// base './' keeps the build portable (works from a sub-folder or static host)
export default defineConfig({
  base: './',
  // v0.55: the city plan file must match this exact game code and map (see src/core/PlanLog.js)
  define: { __OW_PLAN_KEY__: JSON.stringify(planKey()) },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/server/**'] }, proxy: { '/api': 'http://127.0.0.1:8787', '/socket': { target: 'ws://127.0.0.1:8787', ws: true } } },
  preview: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:8787', '/socket': { target: 'ws://127.0.0.1:8787', ws: true } } },
  build: {
    target: ['es2020', 'safari14', 'firefox90', 'chrome87', 'edge88'],
    chunkSizeWarningLimit: 1600,
    // three.js in its own chunk: it changes far less often than the game, so returning players' browsers
    // keep it cached across game updates and only download the (smaller) game chunk again
    rollupOptions: { output: { manualChunks: (id) => (id.includes('/node_modules/three/') ? 'three' : undefined) } },
  },
});
