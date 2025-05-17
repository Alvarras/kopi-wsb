import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"),
        offline: resolve(__dirname, "src/offline.html"),
        notFound: resolve(__dirname, "src/404.html"),
      },
    },
  },
  server: {
    port: 5000,
    open: true,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "assets/**/*"],
      manifest: {
        name: "Kopi Slukatan Wonosobo",
        short_name: "Kopi Slukatan",
        description:
          "Aplikasi web untuk menikmati cerita kopi dari Pegunungan Wonosobo",
        theme_color: "#5d4037",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/index.html",
        icons: [
          {
            src: "assets/icons/icon-72x72.png",
            sizes: "72x72",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "assets/icons/icon-96x96.png",
            sizes: "96x96",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "assets/icons/icon-128x128.png",
            sizes: "128x128",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "assets/icons/icon-144x144.png",
            sizes: "144x144",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "assets/icons/icon-152x152.png",
            sizes: "152x152",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "assets/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "assets/icons/icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "assets/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          {
            name: "Tambah Cerita",
            short_name: "Tambah",
            description: "Tambahkan cerita kopi baru",
            url: "/#add-story",
            icons: [
              { src: "assets/icons/add-story-192x192.png", sizes: "192x192" },
            ],
          },
          {
            name: "Lihat Cerita",
            short_name: "Cerita",
            description: "Lihat cerita kopi dari pengguna",
            url: "/#stories",
            icons: [
              {
                src: "assets/icons/view-stories-192x192.png",
                sizes: "192x192",
              },
            ],
          },
        ],
        screenshots: [
          {
            src: "assets/screenshots/desktop-1.jpg",
            sizes: "1280x800",
            type: "image/jpeg",
            form_factor: "wide",
          },
          {
            src: "assets/screenshots/desktop-2.jpg",
            sizes: "1280x800",
            type: "image/jpeg",
            form_factor: "wide",
          },
          {
            src: "assets/screenshots/mobile-1.jpg",
            sizes: "390x844",
            type: "image/jpeg",
            form_factor: "narrow",
          },
          {
            src: "assets/screenshots/mobile-2.jpg",
            sizes: "390x844",
            type: "image/jpeg",
            form_factor: "narrow",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,gif}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/story-api\.dicoding\.dev\/v1/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          {
            urlPattern: /^https:\/\/unpkg\.com\/leaflet/,
            handler: "CacheFirst",
            options: {
              cacheName: "leaflet-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
        navigateFallback: "offline.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
