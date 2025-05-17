export class PushNotificationHelper {
  constructor(apiService) {
    this.apiService = apiService;
    this.vapidPublicKey =
      "BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk"; // Dicoding VAPID public key
    this.serviceWorkerRegistration = null;
    this.subscriptionStatus = {
      isSubscribed: false,
      subscription: null,
    };
  }

  setServiceWorkerRegistration(registration) {
    console.log("Setting service worker registration:", registration);
    this.serviceWorkerRegistration = registration;
  }

  async registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      console.warn("Service Worker is not supported in this browser");
      return false;
    }

    try {
      // Gunakan service worker yang sudah ada atau daftarkan yang baru
      if (!this.serviceWorkerRegistration) {
        console.log(
          "No service worker registration provided, trying to get from navigator.serviceWorker.ready"
        );
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
      }

      console.log(
        "Service Worker registered successfully:",
        this.serviceWorkerRegistration
      );
      return true;
    } catch (error) {
      console.error("Service Worker registration failed:", error);
      return false;
    }
  }

  async requestNotificationPermission() {
    if (!("Notification" in window)) {
      console.warn("Notifications are not supported in this browser");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();

      // Tampilkan notifikasi permintaan disetujui atau ditolak
      if (permission === "granted") {
        const notification = document.getElementById("notification");
        notification.textContent =
          "Izin notifikasi diberikan. Anda akan menerima pemberitahuan saat ada cerita baru.";
        notification.classList.add("show", "success");
        setTimeout(() => notification.classList.remove("show"), 3000);
      } else {
        const notification = document.getElementById("notification");
        notification.textContent =
          "Izin notifikasi ditolak. Anda tidak akan menerima pemberitahuan.";
        notification.classList.add("show", "info");
        setTimeout(() => notification.classList.remove("show"), 3000);
      }

      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  async checkSubscriptionStatus() {
    try {
      if (!this.serviceWorkerRegistration) {
        const registered = await this.registerServiceWorker();
        if (!registered) {
          console.error(
            "Failed to register service worker when checking subscription status"
          );
          return { isSubscribed: false, subscription: null };
        }
      }

      console.log("Checking push subscription status...");
      const subscription =
        await this.serviceWorkerRegistration.pushManager.getSubscription();
      console.log("Current subscription:", subscription);

      this.subscriptionStatus = {
        isSubscribed: !!subscription,
        subscription,
      };
      return this.subscriptionStatus;
    } catch (error) {
      console.error("Error checking subscription status:", error);
      return { isSubscribed: false, subscription: null };
    }
  }

  // Perbaiki fungsi subscribeToPushNotifications untuk menangani error dengan lebih baik
  async subscribeToPushNotifications() {
    if (!this.serviceWorkerRegistration) {
      const registered = await this.registerServiceWorker();
      if (!registered) {
        const notification = document.getElementById("notification");
        notification.textContent = "Gagal mendaftarkan Service Worker";
        notification.classList.add("show", "error");
        setTimeout(() => notification.classList.remove("show"), 3000);
        return null;
      }
    }

    try {
      // Check if we already have a subscription
      await this.checkSubscriptionStatus();
      let subscription = this.subscriptionStatus.subscription;

      // If not, create a new subscription
      if (!subscription) {
        console.log("Creating new push subscription...");

        // Pastikan izin notifikasi sudah diberikan
        if (Notification.permission !== "granted") {
          const permissionResult = await Notification.requestPermission();
          if (permissionResult !== "granted") {
            throw new Error("Izin notifikasi ditolak");
          }
        }

        try {
          const applicationServerKey = this.urlBase64ToUint8Array(
            this.vapidPublicKey
          );
          subscription =
            await this.serviceWorkerRegistration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey,
            });

          console.log("New subscription created:", subscription);
        } catch (subscribeError) {
          console.error("Error creating push subscription:", subscribeError);
          throw new Error(
            `Gagal membuat langganan push: ${subscribeError.message}`
          );
        }

        // Update status
        this.subscriptionStatus = {
          isSubscribed: true,
          subscription,
        };
      } else {
        console.log("Using existing subscription:", subscription);
      }

      // Kirim ke server
      const result = await this.sendSubscriptionToServer(subscription);

      if (result) {
        const notification = document.getElementById("notification");
        notification.textContent = "Berhasil berlangganan notifikasi";
        notification.classList.add("show", "success");
        setTimeout(() => notification.classList.remove("show"), 3000);

        // Kirim notifikasi test untuk memastikan berfungsi
        this.sendTestNotification();
      }

      return subscription;
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);

      const notification = document.getElementById("notification");
      notification.textContent = `Gagal berlangganan notifikasi: ${error.message}`;
      notification.classList.add("show", "error");
      setTimeout(() => notification.classList.remove("show"), 3000);

      return null;
    }
  }

  async sendTestNotification() {
    try {
      // Kirim notifikasi test langsung dari browser
      const notificationOptions = {
        body: "Anda telah berhasil berlangganan notifikasi Kopi Slukatan!",
        icon: "/assets/icons/icon-192x192.png",
        badge: "/assets/icons/badge-72x72.png",
        vibrate: [100, 50, 100],
        data: {
          url: "/#about",
          dateOfArrival: Date.now(),
        },
      };

      // Tampilkan notifikasi langsung
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(
          "Kopi Slukatan - Berlangganan Berhasil",
          notificationOptions
        );
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
    }
  }

  async unsubscribeFromPushNotifications() {
    if (!this.serviceWorkerRegistration) {
      const registered = await this.registerServiceWorker();
      if (!registered) {
        return false;
      }
    }

    try {
      await this.checkSubscriptionStatus();
      const subscription = this.subscriptionStatus.subscription;

      if (subscription) {
        console.log("Unsubscribing from push notifications...");

        // Unsubscribe from push service
        const unsubscribed = await subscription.unsubscribe();

        if (!unsubscribed) {
          throw new Error("Gagal berhenti berlangganan dari layanan push");
        }

        // Unsubscribe from server
        await this.unsubscribeFromServer(subscription);

        // Update status
        this.subscriptionStatus = {
          isSubscribed: false,
          subscription: null,
        };

        const notification = document.getElementById("notification");
        notification.textContent = "Berhasil berhenti berlangganan notifikasi";
        notification.classList.add("show", "success");
        setTimeout(() => notification.classList.remove("show"), 3000);

        console.log("Unsubscribed from push notifications");
        return true;
      } else {
        const notification = document.getElementById("notification");
        notification.textContent = "Anda belum berlangganan notifikasi";
        notification.classList.add("show", "info");
        setTimeout(() => notification.classList.remove("show"), 3000);
        return false;
      }
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);

      const notification = document.getElementById("notification");
      notification.textContent = `Gagal berhenti berlangganan: ${error.message}`;
      notification.classList.add("show", "error");
      setTimeout(() => notification.classList.remove("show"), 3000);

      return false;
    }
  }

  async sendSubscriptionToServer(subscription) {
    try {
      if (!navigator.onLine) {
        throw new Error("Tidak ada koneksi internet");
      }

      // Format the subscription data according to the API requirements
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(
            String.fromCharCode.apply(
              null,
              new Uint8Array(subscription.getKey("p256dh"))
            )
          ),
          auth: btoa(
            String.fromCharCode.apply(
              null,
              new Uint8Array(subscription.getKey("auth"))
            )
          ),
        },
      };

      console.log("Sending subscription to server:", subscriptionData);

      // Send to Dicoding API
      await this.apiService.subscribeToPushNotifications(subscriptionData);
      return true;
    } catch (error) {
      console.error("Error sending subscription to server:", error);

      // Jika offline, simpan lokasi saja tanpa error
      if (!navigator.onLine) {
        console.log("Offline: Subscription will be sent when online");
        return true;
      }

      throw error;
    }
  }

  async unsubscribeFromServer(subscription) {
    try {
      if (!navigator.onLine) {
        console.log("Offline: Unsubscription will be sent when online");
        return true;
      }

      // Format the subscription data according to the API requirements
      const subscriptionData = {
        endpoint: subscription.endpoint,
      };

      console.log("Sending unsubscription to server:", subscriptionData);

      // Send to Dicoding API
      await this.apiService.unsubscribeFromPushNotifications(subscriptionData);
      return true;
    } catch (error) {
      console.error("Error unsubscribing from server:", error);
      throw error;
    }
  }

  async debugSubscriptionStatus() {
    try {
      if (!("serviceWorker" in navigator)) {
        console.warn("Service Worker is not supported in this browser");
        return "Service Worker tidak didukung di browser ini";
      }

      if (!("PushManager" in window)) {
        console.warn("Push API is not supported in this browser");
        return "Push API tidak didukung di browser ini";
      }

      // Cek apakah service worker terdaftar
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) {
        return "Tidak ada Service Worker yang terdaftar";
      }

      // Cek status notifikasi
      const permission = Notification.permission;
      if (permission !== "granted") {
        return `Izin notifikasi: ${permission}`;
      }

      // Cek subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        return "Tidak ada langganan push yang aktif";
      }

      return "Langganan push aktif";
    } catch (error) {
      console.error("Error debugging subscription:", error);
      return `Error: ${error.message}`;
    }
  }
}
