export default defineNuxtConfig({
  ssr: false,                         // purely client-side; simplest PWA behavior
  typescript: { strict: true },
  modules: ["nitro-cloudflare-dev"],
  nitro: {
    preset: "cloudflare_module",

    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    }
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Waystone',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }]
    }
  }
})