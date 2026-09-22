
export default defineNuxtConfig({
  ssr: false,                         // purely client-side; simplest PWA behavior
  typescript: { strict: true },
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    ['@vite-pwa/nuxt', {
      // 'prompt', not 'autoUpdate': the generated worker keeps `skipWaiting()` out, so a
      // new deploy precaches in the background and waits to be asked. What that buys is
      // not cosmetic — the SRD re-seed in app/plugins/srd-loader.client.ts runs at boot
      // and drops the stored pack before rebuilding it, and character migrations run on
      // load, so a build that takes over unasked rewrites IndexedDB unasked. See
      // app/composables/usePwaUpdate.ts for the button that applies it.
      registerType: 'prompt',
      client: {
        // Re-check hourly. This is a PWA people leave open for a whole session, so a
        // check only at launch means an installed app can sit on a stale build for days.
        periodicSyncForUpdates: 3600,
      },
      manifest: {
        name: 'Waystone',
        short_name: 'Waystone',
        description: 'Offline-first character builder with pack-based rules.',
        start_url: '/',
        display: 'standalone',
        theme_color: '#111827',
        background_color: '#0b0f19',
        icons: [
          { src: '/icons/icon-48x48.png',   sizes: '48x48',   type: 'image/png' },
          { src: '/icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png' },
          { src: '/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-256x256.png', sizes: '256x256', type: 'image/png' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,json}'],
        runtimeCaching: [
          // Cache-first for app shell assets
          {
            urlPattern: ({ request }: { request: Request }) => ['style', 'script', 'worker'].includes(request.destination),
            handler: 'CacheFirst',
            options: { cacheName: 'waystone-assets' }
          }
        ]
      }
    }]
  ],
  nitro: {
    preset: 'static' // allows `nuxi generate` to produce static files
  },
  runtimeConfig: {
    public: {
      // Baked in at build time — `nuxi generate` has no server to read env at runtime.
      // The deploy workflow passes the pushed v*.*.* tag, so the About page reports the
      // exact build a device is on. Anything built outside that workflow says 'dev'.
      appVersion: process.env.NUXT_PUBLIC_APP_VERSION || 'dev'
    }
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Waystone',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#111827' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Waystone' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/icons/icon-192x192.png' }
      ]
    }
  }
})
