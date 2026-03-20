
export default defineNuxtConfig({
  ssr: false,                         // purely client-side; simplest PWA behavior
  typescript: { strict: true },
  modules: [
    '@nuxtjs/tailwindcss',
    ['@pinia/nuxt', { autoImports: ['defineStore'] }],
    ['@vite-pwa/nuxt', {
      registerType: 'autoUpdate',
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
