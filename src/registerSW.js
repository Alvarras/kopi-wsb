import { registerSW } from "virtual:pwa-register";

// Register untuk vite-plugin-pwa
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a notification that there's an update available
    const notification = document.getElementById("notification");
    if (notification) {
      notification.innerHTML = `
        <div>
          Pembaruan tersedia! 
          <button id="update-sw" class="btn btn-small">Perbarui</button>
        </div>
      `;
      notification.classList.add("show", "info");

      // Add event listener to the update button
      const updateButton = document.getElementById("update-sw");
      if (updateButton) {
        updateButton.addEventListener("click", () => {
          updateSW();
          notification.classList.remove("show");
        });
      }
    }
  },
  onOfflineReady() {
    // Show a notification that the app is ready for offline use
    const notification = document.getElementById("notification");
    if (notification) {
      notification.textContent = "Aplikasi siap digunakan secara offline";
      notification.classList.add("show", "success");

      setTimeout(() => {
        notification.classList.remove("show");
      }, 3000);
    }
  },
  onRegistered(r) {
    console.log("Service worker has been registered");
    // Kirim pesan ke service worker
    r && r.waiting && r.update();
  },
  onRegisterError(error) {
    console.error("Service worker registration error", error);
  },
});

export { updateSW };
