import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

const BASE = '/learning-piano/';

export default defineConfig({
  base: BASE,
  // VexFlow (~720 kB) is lazy-loaded by the lesson screen and precached for offline use.
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
    // The mic AudioWorklet must be a real file: Safari won't load worklets from data: URLs.
    assetsInlineLimit: (file) => (file.endsWith('-worklet.js') ? false : undefined),
  },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered manually in src/core/sw.js
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Learning Piano',
        short_name: 'Piano',
        description: 'Learn to read and play piano, from zero to sight-reading. Free and offline.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs runs offline: code, fonts, content, and (from Phase 2) piano samples.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,mp3}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
