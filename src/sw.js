// Kita akan menggunakan workbox yang disediakan oleh vite-plugin-pwa
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Versi cache
const CACHE_VERSION = "v1";

// Nama cache
const CACHE_NAMES = {
  static: `static-cache-${CACHE_VERSION}`,
  images: `images-cache-${CACHE_VERSION}`,
  pages: `pages-cache-${CACHE_VERSION}`,
  api: `api-cache-${CACHE_VERSION}`,
};

// Daftar asset yang akan di-cache saat install
const STATIC_CACHE_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/404.html",
  "/styles/main.css",
  "/scripts/app.js",
];

// Assets folder
const ASSET_CACHE_URLS = [
  "/assets/icons/icon-72x72.png",
  "/assets/icons/icon-96x96.png",
  "/assets/icons/icon-128x128.png",
  "/assets/icons/icon-144x144.png",
  "/assets/icons/icon-152x152.png",
  "/assets/icons/icon-192x192.png",
  "/assets/icons/icon-384x384.png",
  "/assets/icons/icon-512x512.png",
  "/assets/icons/badge-72x72.png",
  "/assets/images/placeholder-image.png",
  "/assets/images/offline-image.png",
  "/assets/images/arabica.png",
  "/assets/images/robusta.png",
  "/assets/images/honey.png",
  "/assets/images/kebun-kopi.png",
];

// Placeholder image for offline use
const OFFLINE_IMAGE = "/assets/images/offline-image.png";
const OFFLINE_PAGE = "/offline.html";

// Install event
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAMES.static).then((cache) => {
        console.log("Caching static assets");
        return cache.addAll(STATIC_CACHE_URLS);
      }),

      // Cache images
      caches.open(CACHE_NAMES.images).then((cache) => {
        console.log("Caching image assets");
        return cache.addAll(ASSET_CACHE_URLS);
      }),
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
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

// Fetch event - handle requests
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip cross-origin requests
  if (requestUrl.origin !== location.origin) {
    if (event.request.url.includes("dicoding.dev")) {
      // Handle API requests separately
      event.respondWith(handleApiRequest(event.request));
    }
    return;
  }

  // Handle different types of requests
  if (event.request.destination === "document") {
    event.respondWith(handlePageRequest(event.request));
  } else if (event.request.destination === "image") {
    event.respondWith(handleImageRequest(event.request));
  } else {
    event.respondWith(handleStaticRequest(event.request));
  }
});

// Handle page requests
async function handlePageRequest(request) {
  // Network first, fallback to cache, then to offline page
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAMES.pages);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // If not in cache, return offline page
    console.log("Returning offline page");
    return caches.match(OFFLINE_PAGE);
  }
}

// Handle image requests
async function handleImageRequest(request) {
  // Cache first, fallback to network, then to offline image
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Not in cache, try network
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAMES.images);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    // If network fails, return offline image placeholder
    console.log("Returning offline image placeholder");
    return caches.match(OFFLINE_IMAGE);
  }
}

// Handle static asset requests (CSS, JS, etc.)
async function handleStaticRequest(request) {
  // Stale-while-revalidate strategy
  const cachedResponse = await caches.match(request);

  // Return cached response immediately if available
  if (cachedResponse) {
    // Update cache in the background
    fetch(request)
      .then(async (networkResponse) => {
        const cache = await caches.open(CACHE_NAMES.static);
        cache.put(request, networkResponse.clone());
      })
      .catch((error) => {
        console.error("Error updating cache:", error);
      });

    return cachedResponse;
  }

  // If not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);
    // Add response to cache
    const cache = await caches.open(CACHE_NAMES.static);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.error("Network fetch failed for static asset:", error);
    // For JS/CSS, there's no good fallback, so return whatever we have
    return new Response("Network error", {
      status: 408,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// Handle API requests
async function handleApiRequest(request) {
  // Network first, fallback to cache
  try {
    const networkResponse = await fetch(request);
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAMES.api);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // If not in cache and network fails, return error
    return new Response(
      JSON.stringify({ error: true, message: "Network Error" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Push notification event listener
self.addEventListener("push", (event) => {
  let notificationData = {};

  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: "Kopi Slukatan",
      options: {
        body: event.data ? event.data.text() : "Ada pembaruan baru!",
        icon: "/assets/icons/icon-192x192.png",
        badge: "/assets/icons/badge-72x72.png",
      },
    };
  }

  const showNotification = self.registration.showNotification(
    notificationData.title || "Kopi Slukatan",
    notificationData.options || {}
  );

  event.waitUntil(showNotification);
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = new URL("/", self.location.origin).href;

  const promiseChain = clients
    .matchAll({
      type: "window",
      includeUncontrolled: true,
    })
    .then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, focus it
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    });

  event.waitUntil(promiseChain);
});
