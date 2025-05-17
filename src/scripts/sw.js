// Menggunakan Workbox untuk offline capability
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js"
);

// Pastikan workbox berhasil dimuat
if (typeof workbox === "undefined") {
  console.error("Workbox failed to load");
} else {
  console.log("Workbox loaded successfully!");

  // Aktifkan debug mode hanya dalam pengembangan
  workbox.setConfig({
    debug: false,
  });

  // Versi cache
  const CACHE_VERSION = "v3";

  // Nama cache
  const CACHE_NAMES = {
    static: `static-cache-${CACHE_VERSION}`,
    images: `images-cache-${CACHE_VERSION}`,
    pages: `pages-cache-${CACHE_VERSION}`,
    api: `api-cache-${CACHE_VERSION}`,
  };

  // Placeholder image for offline use
  const OFFLINE_IMAGE = "/assets/images/offline-image.png";
  const OFFLINE_PAGE = "/offline.html";

  // Gunakan precaching untuk asset penting
  workbox.precaching.precacheAndRoute([
    { url: "/", revision: CACHE_VERSION },
    { url: "/index.html", revision: CACHE_VERSION },
    { url: "/offline.html", revision: CACHE_VERSION },
    { url: "/404.html", revision: CACHE_VERSION },
    { url: "/assets/icons/icon-192x192.png", revision: CACHE_VERSION },
    { url: "/assets/icons/badge-72x72.png", revision: CACHE_VERSION },
    { url: OFFLINE_IMAGE, revision: CACHE_VERSION },
    { url: "/manifest.json", revision: CACHE_VERSION },
  ]);

  // Cache CSS dan JavaScript dengan Stale While Revalidate
  workbox.routing.registerRoute(
    ({ request }) =>
      request.destination === "style" || request.destination === "script",
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: CACHE_NAMES.static,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
        }),
      ],
    })
  );

  // Cache halaman dengan Network First strategy
  workbox.routing.registerRoute(
    ({ request }) => request.destination === "document",
    new workbox.strategies.NetworkFirst({
      cacheName: CACHE_NAMES.pages,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
      networkTimeoutSeconds: 3, // Timeout setelah 3 detik
    })
  );

  // Handle pengalihan ke offline page jika network gagal
  workbox.routing.setCatchHandler(({ event }) => {
    if (event.request.destination === "document") {
      return workbox.precaching.matchPrecache(OFFLINE_PAGE);
    } else if (event.request.destination === "image") {
      return workbox.precaching.matchPrecache(OFFLINE_IMAGE);
    }
    return Response.error();
  });

  // PERBAIKAN: Cache gambar dengan Cache First strategy yang disempurnakan
  // Cache gambar umum
  workbox.routing.registerRoute(
    ({ request }) => request.destination === "image",
    new workbox.strategies.CacheFirst({
      cacheName: CACHE_NAMES.images,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // PERBAIKAN: Route khusus untuk gambar dari Dicoding API
  workbox.routing.registerRoute(
    ({ url }) =>
      url.origin === "https://story-api.dicoding.dev" &&
      url.pathname.includes("/images/"),
    new workbox.strategies.CacheFirst({
      cacheName: CACHE_NAMES.images,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        {
          // Tangani error dengan mengembalikan gambar offline
          handlerDidError: async () => {
            return await caches.match(OFFLINE_IMAGE);
          },
        },
      ],
      fetchOptions: {
        // Tambahkan mode cors untuk mengatasi masalah CORS
        mode: "cors",
        credentials: "omit",
      },
    })
  );

  // Cache API requests dengan Network First
  workbox.routing.registerRoute(
    ({ url }) => url.origin === "https://story-api.dicoding.dev",
    new workbox.strategies.NetworkFirst({
      cacheName: CACHE_NAMES.api,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24, // 24 jam
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
      networkTimeoutSeconds: 3, // Timeout setelah 3 detik
    })
  );

  // Push notification event listener
  self.addEventListener("push", (event) => {
    console.log("Push event received:", event);

    let notificationData = {};

    try {
      // Coba parse data JSON dari event
      notificationData = event.data.json();
      console.log("Parsed notification data:", notificationData);
    } catch (e) {
      console.error("Error parsing push data:", e);
      // Fallback jika data tidak bisa di-parse sebagai JSON
      notificationData = {
        title: "Kopi Slukatan",
        options: {
          body: event.data ? event.data.text() : "Ada pembaruan baru!",
          icon: "/assets/icons/icon-192x192.png",
          badge: "/assets/icons/badge-72x72.png",
          data: {
            url: "/#stories",
          },
        },
      };
    }

    // Pastikan options selalu ada
    notificationData.options = notificationData.options || {};

    // Pastikan data URL untuk navigasi selalu ada
    if (!notificationData.options.data) {
      notificationData.options.data = { url: "/#stories" };
    } else if (!notificationData.options.data.url) {
      notificationData.options.data.url = "/#stories";
    }

    // Tambahkan icon dan badge jika belum ada
    if (!notificationData.options.icon) {
      notificationData.options.icon = "/assets/icons/icon-192x192.png";
    }

    if (!notificationData.options.badge) {
      notificationData.options.badge = "/assets/icons/badge-72x72.png";
    }

    // Tambahkan vibration pattern jika belum ada
    if (!notificationData.options.vibrate) {
      notificationData.options.vibrate = [100, 50, 100];
    }

    // Tampilkan notifikasi
    const showNotification = self.registration.showNotification(
      notificationData.title || "Kopi Slukatan",
      notificationData.options
    );

    event.waitUntil(showNotification);
  });

  // Notification click event
  self.addEventListener("notificationclick", (event) => {
    console.log("Notification clicked:", event);

    // Tutup notifikasi
    event.notification.close();

    // Ambil URL dari data notifikasi atau gunakan default
    const urlToOpen =
      event.notification.data && event.notification.data.url
        ? new URL(event.notification.data.url, self.location.origin).href
        : new URL("/#stories", self.location.origin).href;

    console.log("Opening URL:", urlToOpen);

    const promiseChain = clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Cek apakah sudah ada jendela/tab yang terbuka dengan URL target
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          console.log("Checking client:", client.url);

          // Jika sudah ada, fokuskan
          if (client.url === urlToOpen && "focus" in client) {
            console.log("Focusing existing client");
            return client.focus();
          }
        }

        // Jika belum ada, buka jendela/tab baru
        if (clients.openWindow) {
          console.log("Opening new window");
          return clients.openWindow(urlToOpen);
        }
      });

    event.waitUntil(promiseChain);
  });

  // Skip waiting and claim clients
  self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
      self.skipWaiting();
    }
  });

  self.addEventListener("activate", (event) => {
    // Hapus cache lama
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames
              .filter((cacheName) => {
                // Hapus cache lama yang tidak digunakan lagi
                return Object.values(CACHE_NAMES).indexOf(cacheName) === -1;
              })
              .map((cacheName) => {
                console.log("Deleting outdated cache:", cacheName);
                return caches.delete(cacheName);
              })
          );
        })
        .then(() => {
          console.log("Service Worker activated - claiming clients");
          return self.clients.claim();
        })
    );
  });
}
