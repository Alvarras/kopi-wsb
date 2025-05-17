import "../styles/main.css";
import { ApiService } from "./services/api-service";
import { StorageService } from "./services/storage-service";
import { Router } from "./utils/router";
import { StoryPresenter } from "./presenters/story-presenter";
import { AuthPresenter } from "./presenters/auth-presenter";
import { NotificationHelper } from "./utils/notification-helper";
import { CameraHelper } from "./utils/camera-helper";
import { MapHelper } from "./utils/map-helper";
import { ViewTransitionHelper } from "./utils/view-transition-helper";
import { IndexedDBHelper } from "./utils/indexed-db-helper";
import { PushNotificationHelper } from "./utils/push-notification-helper";
import { registerSW } from "virtual:pwa-register";
import { FavoriteStoryHelper } from "./utils/favorite-story-helper";

class App {
  constructor() {
    this.apiService = new ApiService("https://story-api.dicoding.dev/v1");
    this.storageService = new StorageService();
    this.router = new Router();
    this.notificationHelper = new NotificationHelper();
    this.cameraHelper = new CameraHelper();
    this.mapHelper = new MapHelper();
    this.viewTransitionHelper = new ViewTransitionHelper();
    this.indexedDBHelper = new IndexedDBHelper();
    this.favoriteStoryHelper = new FavoriteStoryHelper(this.indexedDBHelper);

    // Initialize map helper first
    this.storyPresenter = new StoryPresenter(
      this.apiService,
      this.storageService,
      this.indexedDBHelper,
      this.favoriteStoryHelper
    );
    this.storyPresenter.setMapHelper(this.mapHelper);

    this.authPresenter = new AuthPresenter(
      this.apiService,
      this.storageService
    );

    // Initialize push notification helper
    this.pushNotificationHelper = new PushNotificationHelper(this.apiService);

    this.isLoggedIn = false;
    this.currentPage = null;
    this.isOnline = navigator.onLine;
    this.swRegistration = null;
    this.deferredPrompt = null;
    this.installPromptShown = false;

    this.init();
  }

  async init() {
    // Check if user is logged in
    this.checkAuthStatus();

    // Initialize router
    this.initRouter();

    // Initialize event listeners
    this.initEventListeners();

    // Initialize auth modals
    this.initAuthModals();

    // Initialize online/offline detection
    this.initOnlineStatus();

    // Initialize service worker for PWA
    await this.initServiceWorker();

    // Initialize IndexedDB
    await this.indexedDBHelper.openDB();

    // Initialize push notifications if logged in
    if (this.isLoggedIn) {
      this.initPushNotifications();
    }

    // Focus skip link on page load
    this.initSkipToContent();

    // Check if app is already installed
    this.checkAppInstalled();

    // Add installation banner after 5 seconds if not installed and not shown before
    setTimeout(() => {
      this.showInstallBanner();
    }, 5000);
  }

  // Check if app is already installed
  checkAppInstalled() {
    // For iOS detection
    if (window.navigator.standalone) {
      console.log("App is installed on iOS");
      return true;
    }

    // For Chrome, Edge, etc.
    if (window.matchMedia("(display-mode: standalone)").matches) {
      console.log("App is installed as PWA");
      return true;
    }

    return false;
  }

  // Show install banner for users
  showInstallBanner() {
    // Don't show if already installed, prompt is not available, or already shown
    if (
      this.checkAppInstalled() ||
      !this.deferredPrompt ||
      this.installPromptShown
    ) {
      return;
    }

    // Check if user has dismissed before
    const hasUserDismissed = localStorage.getItem("installBannerDismissed");
    if (hasUserDismissed) {
      // Only show again after 3 days
      const dismissedTime = Number.parseInt(hasUserDismissed, 10);
      const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < threeDaysInMs) {
        return;
      }
    }

    this.installPromptShown = true;

    // Create banner if it doesn't exist
    if (!document.querySelector(".add-to-home")) {
      const banner = document.createElement("div");
      banner.className = "add-to-home";
      banner.innerHTML = `
        <p>Pasang aplikasi Kopi Slukatan di perangkat Anda untuk pengalaman yang lebih baik dan akses offline!</p>
        <div class="add-to-home-buttons">
          <button class="btn-install">Pasang Aplikasi</button>
          <button class="btn-later">Nanti Saja</button>
        </div>
      `;
      document.body.appendChild(banner);

      // Show banner with animation
      setTimeout(() => {
        banner.classList.add("show");
      }, 100);

      // Add event listeners
      const installBtn = banner.querySelector(".btn-install");
      const laterBtn = banner.querySelector(".btn-later");

      installBtn.addEventListener("click", () => {
        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for user response
        this.deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === "accepted") {
            console.log("User accepted the install prompt");
            this.notificationHelper.showNotification(
              "Terima kasih telah memasang aplikasi!",
              "success"
            );
          } else {
            console.log("User dismissed the install prompt");
          }

          // Hide banner
          banner.classList.remove("show");
          setTimeout(() => {
            banner.remove();
          }, 300);

          // Reset the deferred prompt
          this.deferredPrompt = null;
        });
      });

      laterBtn.addEventListener("click", () => {
        // Hide banner
        banner.classList.remove("show");
        setTimeout(() => {
          banner.remove();
        }, 300);

        // Save dismissed time
        localStorage.setItem("installBannerDismissed", Date.now().toString());
      });
    }
  }

  // Inisialisasi skip to content
  initSkipToContent() {
    const skipLink = document.querySelector(".skip-link");
    if (skipLink) {
      // Set tabindex agar bisa mendapatkan fokus
      skipLink.setAttribute("tabindex", "0");

      // Fokuskan skip link saat halaman dimuat
      skipLink.focus();

      // Tambahkan event listener untuk mengarahkan fokus ke konten utama
      skipLink.addEventListener("click", (e) => {
        e.preventDefault();
        const mainContent = document.getElementById("main-content");
        if (mainContent) {
          mainContent.setAttribute("tabindex", "-1");
          mainContent.focus();
        }
      });
    }
  }

  async initServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        console.log("Registering service worker...");

        // Daftarkan service worker secara manual terlebih dahulu
        this.swRegistration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        console.log(
          "Service Worker registered successfully:",
          this.swRegistration
        );

        // Pastikan service worker aktif
        if (this.swRegistration.active) {
          console.log("Service Worker is active");
        } else {
          console.log("Service Worker is not yet active, waiting...");

          // Tunggu hingga service worker aktif
          await new Promise((resolve) => {
            if (this.swRegistration.installing) {
              this.swRegistration.installing.addEventListener(
                "statechange",
                (e) => {
                  if (e.target.state === "activated") {
                    console.log("Service Worker is now activated");
                    resolve();
                  }
                }
              );
            } else if (this.swRegistration.waiting) {
              this.swRegistration.waiting.addEventListener(
                "statechange",
                (e) => {
                  if (e.target.state === "activated") {
                    console.log("Service Worker is now activated");
                    resolve();
                  }
                }
              );
            } else {
              resolve();
            }
          });
        }

        // Setelah service worker terdaftar, gunakan registerSW dari vite-plugin-pwa
        const updateSW = registerSW({
          onNeedRefresh() {
            // Show a notification that there's an update available
            const notification = document.getElementById("notification");
            notification.innerHTML = `
              <div>
                Pembaruan tersedia! 
                <button id="update-sw" class="btn btn-small">Perbarui</button>
              </div>
            `;
            notification.classList.add("show", "info");

            // Add event listener to the update button
            document
              .getElementById("update-sw")
              .addEventListener("click", () => {
                updateSW();
                notification.classList.remove("show");
              });
          },
          onOfflineReady() {
            // Show a notification that the app is ready for offline use
            const notification = document.getElementById("notification");
            notification.textContent = "Aplikasi siap digunakan secara offline";
            notification.classList.add("show", "success");

            setTimeout(() => {
              notification.classList.remove("show");
            }, 3000);
          },
          immediate: true,
        });

        // Berikan service worker registration ke push notification helper
        this.pushNotificationHelper.setServiceWorkerRegistration(
          this.swRegistration
        );

        return true;
      } catch (error) {
        console.error("Service Worker registration failed:", error);

        // Tampilkan notifikasi error
        const notification = document.getElementById("notification");
        notification.textContent = `Gagal mendaftarkan Service Worker: ${error.message}`;
        notification.classList.add("show", "error");
        setTimeout(() => notification.classList.remove("show"), 5000);

        return false;
      }
    } else {
      console.warn("Service Worker is not supported in this browser");
      return false;
    }
  }

  async initPushNotifications() {
    // Check if push notifications are supported
    if (!("PushManager" in window)) {
      console.warn("Push notifications are not supported in this browser");
      return;
    }

    try {
      console.log("Initializing push notifications...");

      // Check if service worker is registered
      if (!this.swRegistration) {
        console.error(
          "Service Worker not registered, cannot initialize push notifications"
        );
        return;
      }

      // Set service worker registration to push notification helper
      this.pushNotificationHelper.setServiceWorkerRegistration(
        this.swRegistration
      );

      // Check subscription status first
      const status =
        await this.pushNotificationHelper.checkSubscriptionStatus();
      console.log("Current subscription status:", status);

      if (!status.isSubscribed) {
        // Request notification permission only if not already subscribed
        const permissionGranted =
          await this.pushNotificationHelper.requestNotificationPermission();
        console.log("Notification permission granted:", permissionGranted);

        if (permissionGranted) {
          // Subscribe to push notifications
          await this.pushNotificationHelper.subscribeToPushNotifications();
        }
      }

      // Add notification settings to the user profile page
      this.addNotificationSettings();
    } catch (error) {
      console.error("Error initializing push notifications:", error);
    }
  }

  addNotificationSettings() {
    // Check if we're on the about page (we'll add notification settings here)
    const aboutPage = document.getElementById("about");
    if (!aboutPage) return;

    // Check if notification settings already exist
    if (document.getElementById("notification-settings")) {
      // Update existing notification settings
      this.updateNotificationSettings();
      return;
    }

    // Create notification settings section
    const notificationSettings = document.createElement("div");
    notificationSettings.id = "notification-settings";
    notificationSettings.className = "notification-settings";

    // Add loading state initially
    notificationSettings.innerHTML = `
      <h3>Pengaturan Notifikasi</h3>
      <p>Memeriksa status langganan...</p>
    `;

    // Add to the about page
    const aboutContent = aboutPage.querySelector(".about-content");
    aboutContent.appendChild(notificationSettings);

    // Update notification settings with current status
    this.updateNotificationSettings();
  }

  async updateNotificationSettings() {
    const notificationSettings = document.getElementById(
      "notification-settings"
    );
    if (!notificationSettings) return;

    try {
      // Tampilkan status loading
      notificationSettings.innerHTML = `
        <h3>Pengaturan Notifikasi</h3>
        <p>Memeriksa status langganan...</p>
      `;

      // Debug status service worker
      const swStatus = await this.debugServiceWorkerStatus();
      console.log("Service Worker status:", swStatus);

      // Debug status langganan
      const debugStatus =
        await this.pushNotificationHelper.debugSubscriptionStatus();
      console.log("Debug subscription status:", debugStatus);

      // Check current subscription status
      const status =
        await this.pushNotificationHelper.checkSubscriptionStatus();
      console.log("Subscription status result:", status);

      if (status.isSubscribed) {
        notificationSettings.innerHTML = `
          <h3>Pengaturan Notifikasi</h3>
          <p>Anda telah berlangganan notifikasi dari Kopi Slukatan.</p>
          <p>Anda akan menerima notifikasi saat ada cerita baru atau komentar pada cerita Anda.</p>
          <button id="unsubscribe-notifications" class="btn btn-secondary">Berhenti Berlangganan</button>
          <div class="debug-info" style="margin-top: 1rem; font-size: 0.8rem; color: #666;">
            <p>Status Service Worker: ${swStatus}</p>
            <p>Status Langganan: ${debugStatus}</p>
          </div>
        `;

        // Add event listener to unsubscribe button
        document
          .getElementById("unsubscribe-notifications")
          .addEventListener("click", async () => {
            try {
              // Show loading state
              const unsubscribeButton = document.getElementById(
                "unsubscribe-notifications"
              );
              unsubscribeButton.textContent = "Sedang memproses...";
              unsubscribeButton.disabled = true;

              const success =
                await this.pushNotificationHelper.unsubscribeFromPushNotifications();

              if (success) {
                this.notificationHelper.showNotification(
                  "Berhasil berhenti berlangganan notifikasi",
                  "success"
                );
                this.updateNotificationSettings();
              } else {
                // Reset button if failed
                unsubscribeButton.textContent = "Berhenti Berlangganan";
                unsubscribeButton.disabled = false;
              }
            } catch (error) {
              this.notificationHelper.showNotification(
                `Gagal berhenti berlangganan: ${error.message}`,
                "error"
              );

              // Reset button if error
              const unsubscribeButton = document.getElementById(
                "unsubscribe-notifications"
              );
              if (unsubscribeButton) {
                unsubscribeButton.textContent = "Berhenti Berlangganan";
                unsubscribeButton.disabled = false;
              }
            }
          });
      } else {
        notificationSettings.innerHTML = `
          <h3>Pengaturan Notifikasi</h3>
          <p>Anda belum berlangganan notifikasi dari Kopi Slukatan.</p>
          <p>Berlangganan untuk mendapatkan notifikasi saat ada cerita baru atau komentar pada cerita Anda.</p>
          <button id="subscribe-notifications" class="btn btn-primary">Berlangganan</button>
          <div class="debug-info" style="margin-top: 1rem; font-size: 0.8rem; color: #666;">
            <p>Status Service Worker: ${swStatus}</p>
            <p>Status Langganan: ${debugStatus}</p>
          </div>
        `;

        // Add event listener to subscribe button
        document
          .getElementById("subscribe-notifications")
          .addEventListener("click", async () => {
            try {
              // Show loading state
              const subscribeButton = document.getElementById(
                "subscribe-notifications"
              );
              subscribeButton.textContent = "Sedang memproses...";
              subscribeButton.disabled = true;

              // Request permission and subscribe
              const permissionGranted =
                await this.pushNotificationHelper.requestNotificationPermission();

              if (permissionGranted) {
                await this.pushNotificationHelper.subscribeToPushNotifications();
                this.updateNotificationSettings();
              } else {
                // Reset button if permission denied
                subscribeButton.textContent = "Berlangganan";
                subscribeButton.disabled = false;
                this.notificationHelper.showNotification(
                  "Izin notifikasi ditolak",
                  "error"
                );
              }
            } catch (error) {
              this.notificationHelper.showNotification(
                `Gagal berlangganan: ${error.message}`,
                "error"
              );

              // Reset button if error
              const subscribeButton = document.getElementById(
                "subscribe-notifications"
              );
              if (subscribeButton) {
                subscribeButton.textContent = "Berlangganan";
                subscribeButton.disabled = false;
              }
            }
          });
      }
    } catch (error) {
      console.error("Error updating notification settings:", error);
      notificationSettings.innerHTML = `
        <h3>Pengaturan Notifikasi</h3>
        <p>Gagal memuat status notifikasi: ${error.message}</p>
        <button id="retry-notification-settings" class="btn btn-primary">Coba Lagi</button>
        <div class="error-details" style="margin-top: 1rem; font-size: 0.8rem; color: #f44336;">
          <p>Detail error: ${error.toString()}</p>
          <p>Coba refresh halaman atau periksa konsol browser untuk informasi lebih lanjut.</p>
        </div>
      `;

      // Add retry button
      document
        .getElementById("retry-notification-settings")
        .addEventListener("click", () => {
          this.updateNotificationSettings();
        });
    }
  }

  async debugServiceWorkerStatus() {
    try {
      if (!("serviceWorker" in navigator)) {
        return "Service Worker tidak didukung di browser ini";
      }

      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) {
        return "Tidak ada Service Worker yang terdaftar";
      }

      const registration = registrations[0];
      let status = `Terdaftar (scope: ${registration.scope})`;

      if (registration.installing) {
        status += ", Status: installing";
      } else if (registration.waiting) {
        status += ", Status: waiting";
      } else if (registration.active) {
        status += ", Status: active";
      }

      return status;
    } catch (error) {
      console.error("Error checking service worker status:", error);
      return `Error: ${error.message}`;
    }
  }

  initOnlineStatus() {
    // Create offline indicator
    const offlineIndicator = document.createElement("div");
    offlineIndicator.className = "offline-indicator";
    offlineIndicator.textContent = "Anda sedang offline";
    document.body.appendChild(offlineIndicator);

    // Update online status
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.notificationHelper.showNotification(
        "Koneksi internet tersedia",
        "success"
      );
      offlineIndicator.classList.remove("show");

      // Reload current page data if needed
      if (this.currentPage && this.currentPage.id === "stories") {
        this.storyPresenter.loadStories();
      }

      // Sync pending stories
      if (this.isLoggedIn) {
        this.storyPresenter.syncPendingStories();
      }
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.notificationHelper.showNotification(
        "Tidak ada koneksi internet. Aplikasi berjalan dalam mode offline.",
        "info"
      );
      offlineIndicator.classList.add("show");
    });

    // Check initial status
    if (!this.isOnline) {
      offlineIndicator.classList.add("show");
      this.notificationHelper.showNotification(
        "Tidak ada koneksi internet. Aplikasi berjalan dalam mode offline.",
        "info"
      );
    }
  }

  checkAuthStatus() {
    const token = this.storageService.getToken();
    if (token) {
      this.isLoggedIn = true;
      this.apiService.setToken(token);
      // Update UI for logged in user
      this.updateUIForLoggedInUser();
    }
  }

  updateUIForLoggedInUser() {
    // Add logout button to nav
    const navList = document.getElementById("nav-list");

    // Check if logout button already exists
    if (!document.getElementById("logout-link")) {
      const logoutItem = document.createElement("li");
      const logoutLink = document.createElement("a");
      logoutLink.href = "#";
      logoutLink.textContent = "Keluar";
      logoutLink.classList.add("nav-link");
      logoutLink.id = "logout-link";
      logoutItem.appendChild(logoutLink);
      navList.appendChild(logoutItem);

      // Add event listener for logout
      document.getElementById("logout-link").addEventListener("click", (e) => {
        e.preventDefault();
        this.authPresenter.logout();
        this.isLoggedIn = false;
        this.notificationHelper.showNotification("Berhasil keluar", "success");
        window.location.reload();
      });
    }
  }

  initRouter() {
    // Define routes
    this.router.addRoute("home", () => {
      this.showPage("home");
    });

    this.router.addRoute("stories", () => {
      this.showPage("stories");
      this.storyPresenter.loadStories();
    });

    this.router.addRoute("add-story", () => {
      if (!this.isLoggedIn) {
        this.showAuthModal();
        this.router.navigateTo("home");
        return;
      }
      this.showPage("add-story");
      this.initAddStoryPage();
    });

    this.router.addRoute("about", () => {
      this.showPage("about");

      // Add notification settings if logged in
      if (this.isLoggedIn) {
        this.addNotificationSettings();
      }
    });

    this.router.addRoute("favorites", () => {
      this.showPage("favorites");
      this.storyPresenter.loadFavoriteStories();
    });

    // Initialize router
    this.router.init();
  }

  showPage(pageId) {
    const previousPage = this.currentPage;
    const nextPage = document.getElementById(pageId);

    // PERBAIKAN: Matikan kamera jika berpindah dari halaman add-story
    if (previousPage && previousPage.id === "add-story") {
      this.cameraHelper.stopCamera();
    }

    if (previousPage) {
      // Use View Transition API if supported
      if (this.viewTransitionHelper.isSupported()) {
        this.viewTransitionHelper.transition(() => {
          this.activatePage(previousPage, nextPage);
        });
      } else {
        this.activatePage(previousPage, nextPage);
      }
    } else {
      this.activatePage(null, nextPage);
    }

    this.currentPage = nextPage;

    // Update active nav link
    this.updateActiveNavLink(pageId);
  }

  activatePage(previousPage, nextPage) {
    if (previousPage) {
      previousPage.classList.remove("active");
    }
    nextPage.classList.add("active");
  }

  updateActiveNavLink(pageId) {
    // Remove active class from all nav links
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("active");
    });

    // Add active class to current nav link
    const currentNavLink = document.querySelector(
      `.nav-link[href="#${pageId}"]`
    );
    if (currentNavLink) {
      currentNavLink.classList.add("active");
    }
  }

  initEventListeners() {
    // Mobile menu toggle
    const menuToggle = document.getElementById("menu-toggle");
    const navList = document.getElementById("nav-list");

    menuToggle.addEventListener("click", () => {
      navList.classList.toggle("show");
    });

    // Close mobile menu when clicking on a link
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        navList.classList.remove("show");
      });
    });

    // Stories view toggle
    document.getElementById("view-list").addEventListener("click", () => {
      this.toggleStoriesView("list");
    });

    document.getElementById("view-map").addEventListener("click", () => {
      this.toggleStoriesView("map");
    });

    // Map layer toggle
    document.getElementById("map-standard").addEventListener("click", () => {
      this.mapHelper.setMapLayer("standard");
    });

    document.getElementById("map-satellite").addEventListener("click", () => {
      this.mapHelper.setMapLayer("satellite");
    });

    // Add topography layer button event listener
    const mapTopoButton = document.createElement("button");
    mapTopoButton.id = "map-topo";
    mapTopoButton.className = "btn btn-small";
    mapTopoButton.textContent = "Topografi";

    const mapLayersDiv = document.querySelector(".map-layers");
    if (mapLayersDiv) {
      mapLayersDiv.appendChild(mapTopoButton);

      mapTopoButton.addEventListener("click", () => {
        this.mapHelper.setMapLayer("topo");
      });
    }

    // Add install PWA button if app is installable
    window.addEventListener("beforeinstallprompt", (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();

      // Stash the event so it can be triggered later
      this.deferredPrompt = e;
      console.log("App can be installed to homescreen", e);

      // Add install button to header
      const headerContent = document.querySelector(".header-content");

      if (headerContent && !document.getElementById("install-app")) {
        const installButton = document.createElement("button");
        installButton.id = "install-app";
        installButton.className = "btn btn-small";
        installButton.textContent = "Pasang Aplikasi";

        headerContent.appendChild(installButton);

        installButton.addEventListener("click", () => {
          // Show the install prompt
          this.deferredPrompt.prompt();

          // Wait for the user to respond to the prompt
          this.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === "accepted") {
              console.log("User accepted the install prompt");
              this.notificationHelper.showNotification(
                "Terima kasih telah memasang aplikasi!",
                "success"
              );
            } else {
              console.log("User dismissed the install prompt");
            }

            // Reset the deferred prompt variable
            this.deferredPrompt = null;

            // Remove the button
            installButton.remove();
          });
        });
      }
    });

    // Tambahkan event listener untuk appinstalled
    window.addEventListener("appinstalled", (e) => {
      console.log("App was installed to homescreen", e);
      this.notificationHelper.showNotification(
        "Aplikasi berhasil dipasang!",
        "success"
      );
    });
  }

  toggleStoriesView(view) {
    const listView = document.getElementById("stories-list");
    const mapView = document.getElementById("stories-map");
    const listBtn = document.getElementById("view-list");
    const mapBtn = document.getElementById("view-map");

    if (view === "list") {
      listView.style.display = "grid";
      mapView.style.display = "none";
      listBtn.classList.add("active");
      mapBtn.classList.remove("active");
    } else {
      listView.style.display = "none";
      mapView.style.display = "block";
      listBtn.classList.remove("active");
      mapBtn.classList.add("active");

      // Initialize map if not already initialized
      if (!this.mapHelper.isMapInitialized("stories-map")) {
        this.mapHelper.initMap("stories-map");
        this.storyPresenter.loadStoriesForMap();
      } else {
        // Refresh map size in case window was resized
        this.mapHelper.maps["stories-map"].map.invalidateSize();
      }
    }
  }

  initAddStoryPage() {
    // Initialize location map
    this.mapHelper.initMap("location-map", true);

    // Camera button
    document.getElementById("camera-button").addEventListener("click", () => {
      this.cameraHelper.startCamera();
    });

    // Capture button
    document.getElementById("capture-button").addEventListener("click", () => {
      this.cameraHelper.capturePhoto();
    });

    // Cancel camera button
    document.getElementById("cancel-camera").addEventListener("click", () => {
      this.cameraHelper.stopCamera();
    });

    // Form submission with debounce to prevent multiple submissions
    const form = document.getElementById("story-form");
    form.dataset.submitting = "false";

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // Prevent multiple submissions
      if (form.dataset.submitting === "true") {
        console.log("Form already submitting, preventing duplicate submission");
        return;
      }

      this.submitStory();
    });
  }

  async submitStory() {
    // Immediately disable submit button to prevent multiple submissions
    const submitButton = document.getElementById("submit-story");
    submitButton.disabled = true;
    submitButton.textContent = "Mengirim...";

    const description = document.getElementById("story-description").value;
    const photo = this.cameraHelper.getPhotoBlob();
    const lat = document.getElementById("story-lat").value;
    const lon = document.getElementById("story-lon").value;

    if (!description || !photo) {
      this.notificationHelper.showNotification(
        "Deskripsi dan foto harus diisi",
        "error"
      );
      // Re-enable button if validation fails
      submitButton.disabled = false;
      submitButton.textContent = "Bagikan Cerita";
      return;
    }

    try {
      // Add a submission flag to the form to prevent duplicate submissions
      const form = document.getElementById("story-form");
      if (form.dataset.submitting === "true") {
        console.log("Form already submitting, preventing duplicate submission");
        return;
      }
      form.dataset.submitting = "true";

      await this.storyPresenter.addStory({
        description,
        photo,
        lat: lat || null,
        lon: lon || null,
      });

      // PERBAIKAN: Kirim notifikasi push setelah berhasil menambahkan cerita
      if (
        this.isLoggedIn &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notificationOptions = {
          body: "Cerita baru berhasil ditambahkan!",
          icon: "/assets/icons/icon-192x192.png",
          badge: "/assets/icons/badge-72x72.png",
          vibrate: [100, 50, 100],
          data: {
            url: "/#stories",
            dateOfArrival: Date.now(),
          },
        };

        // Tampilkan notifikasi langsung
        new Notification("Kopi Slukatan", notificationOptions);
      }

      // Reset form and button
      submitButton.disabled = false;
      submitButton.textContent = "Bagikan Cerita";
      form.dataset.submitting = "false";
    } catch (error) {
      this.notificationHelper.showNotification(
        `Gagal menambahkan cerita: ${error.message}`,
        "error"
      );

      // Reset button and submission flag
      submitButton.disabled = false;
      submitButton.textContent = "Bagikan Cerita";
      const form = document.getElementById("story-form");
      form.dataset.submitting = "false";
    }
  }

  initAuthModals() {
    // Create login modal
    const loginTemplate = document.getElementById("login-modal-template");
    const loginModal = document.importNode(loginTemplate.content, true);
    document.body.appendChild(loginModal);

    // Create register modal
    const registerTemplate = document.getElementById("register-modal-template");
    const registerModal = document.importNode(registerTemplate.content, true);
    document.body.appendChild(registerModal);

    // Login form submission
    document.getElementById("login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      this.authPresenter
        .login(email, password)
        .then(() => {
          this.hideAuthModal();
          this.isLoggedIn = true;
          this.updateUIForLoggedInUser();
          this.notificationHelper.showNotification("Berhasil masuk", "success");

          // Initialize push notifications after login
          this.initPushNotifications();
        })
        .catch((error) => {
          this.notificationHelper.showNotification(error.message, "error");
        });
    });

    // Register form submission
    document.getElementById("register-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("register-name").value;
      const email = document.getElementById("register-email").value;
      const password = document.getElementById("register-password").value;

      this.authPresenter
        .register(name, email, password)
        .then(() => {
          this.showLoginModal();
          this.notificationHelper.showNotification(
            "Berhasil mendaftar, silakan masuk",
            "success"
          );
        })
        .catch((error) => {
          this.notificationHelper.showNotification(error.message, "error");
        });
    });

    // Modal toggle
    document.getElementById("show-register").addEventListener("click", (e) => {
      e.preventDefault();
      this.showRegisterModal();
    });

    document.getElementById("show-login").addEventListener("click", (e) => {
      e.preventDefault();
      this.showLoginModal();
    });

    // Close modals
    document.querySelectorAll(".close-modal").forEach((button) => {
      button.addEventListener("click", () => {
        this.hideAuthModal();
      });
    });
  }

  showAuthModal() {
    this.showLoginModal();
  }

  showLoginModal() {
    document.getElementById("login-modal").classList.add("active");
    document.getElementById("register-modal").classList.remove("active");
  }

  showRegisterModal() {
    document.getElementById("register-modal").classList.add("active");
    document.getElementById("login-modal").classList.remove("active");
  }

  hideAuthModal() {
    document.getElementById("login-modal").classList.remove("active");
    document.getElementById("register-modal").classList.remove("active");
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new App();
});
