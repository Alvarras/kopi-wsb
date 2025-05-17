export class StoryPresenter {
  constructor(
    apiService,
    storageService,
    indexedDBHelper,
    favoriteStoryHelper
  ) {
    this.apiService = apiService;
    this.storageService = storageService;
    this.indexedDBHelper = indexedDBHelper;
    this.favoriteStoryHelper = favoriteStoryHelper;
    this.mapHelper = null;
    this.isOnline = navigator.onLine;

    // Set token if available
    const token = this.storageService.getToken();
    if (token) {
      this.apiService.setToken(token);
    }
  }

  setMapHelper(mapHelper) {
    this.mapHelper = mapHelper;
  }

  async loadStories() {
    try {
      const storiesContainer = document.getElementById("stories-list");
      storiesContainer.innerHTML =
        '<div class="loading-indicator">Memuat cerita...</div>';

      let stories = [];

      // Try to get stories from API if online
      if (this.isOnline) {
        try {
          stories = await this.apiService.getStories(1, 20);

          // Save stories to IndexedDB for offline use
          await this.indexedDBHelper.saveStories(stories);
        } catch (error) {
          console.error("Error fetching stories from API:", error);
          // If API fetch fails, try to get stories from IndexedDB
          stories = await this.indexedDBHelper.getStories();
        }
      } else {
        // If offline, get stories from IndexedDB
        stories = await this.indexedDBHelper.getStories();
      }

      if (stories.length === 0) {
        storiesContainer.innerHTML =
          '<div class="loading-indicator">Belum ada cerita</div>';
        return;
      }

      storiesContainer.innerHTML = "";

      // Create and append story items
      for (const story of stories) {
        const storyElement = await this.createStoryItem(story);
        storiesContainer.appendChild(storyElement);
      }

      // Check for pending stories to sync
      if (this.isOnline) {
        this.syncPendingStories();
      }
    } catch (error) {
      console.error("Error loading stories:", error);
      document.getElementById("stories-list").innerHTML = `
        <div class="loading-indicator">Gagal memuat cerita: ${error.message}</div>
      `;
    }
  }

  async loadFavoriteStories() {
    try {
      const favoritesContainer = document.getElementById("favorites-list");
      favoritesContainer.innerHTML =
        '<div class="loading-indicator">Memuat cerita favorit...</div>';

      // Get favorite stories from IndexedDB
      const favorites = await this.favoriteStoryHelper.getFavoriteStories();

      if (favorites.length === 0) {
        favoritesContainer.innerHTML =
          '<div class="loading-indicator">Belum ada cerita favorit</div>';
        return;
      }

      favoritesContainer.innerHTML = "";

      // Create and append story items
      for (const story of favorites) {
        const storyElement = await this.createStoryItem(story, true);
        favoritesContainer.appendChild(storyElement);
      }
    } catch (error) {
      console.error("Error loading favorite stories:", error);
      document.getElementById("favorites-list").innerHTML = `
        <div class="loading-indicator">Gagal memuat cerita favorit: ${error.message}</div>
      `;
    }
  }

  async syncPendingStories() {
    try {
      const pendingStories = await this.indexedDBHelper.getPendingStories();

      if (pendingStories.length === 0) return;

      console.log(`Found ${pendingStories.length} pending stories to sync`);

      for (const pendingStory of pendingStories) {
        try {
          // Create FormData from the pending story
          const formData = new FormData();
          formData.append("description", pendingStory.description);

          // Convert base64 to blob if needed
          if (
            pendingStory.photo &&
            typeof pendingStory.photo === "string" &&
            pendingStory.photo.startsWith("data:")
          ) {
            const response = await fetch(pendingStory.photo);
            const blob = await response.blob();
            formData.append("photo", blob);
          } else if (pendingStory.photo instanceof Blob) {
            formData.append("photo", pendingStory.photo);
          }

          if (pendingStory.lat && pendingStory.lon) {
            formData.append("lat", pendingStory.lat);
            formData.append("lon", pendingStory.lon);
          }

          // Send to API
          await this.apiService.addStory(formData);

          // Delete from pending stories
          await this.indexedDBHelper.deletePendingStory(pendingStory.id);

          console.log(
            `Successfully synced and deleted pending story ${pendingStory.id}`
          );
        } catch (error) {
          console.error(
            `Error syncing pending story ${pendingStory.id}:`,
            error
          );
        }
      }

      // Reload stories after sync
      this.loadStories();
    } catch (error) {
      console.error("Error syncing pending stories:", error);
    }
  }

  async loadStoriesForMap() {
    if (!this.mapHelper) return;

    try {
      let stories = [];

      // Try to get stories from API if online
      if (this.isOnline) {
        try {
          stories = await this.apiService.getStories(1, 50, 1);
        } catch (error) {
          console.error("Error fetching stories from API for map:", error);
          // If API fetch fails, try to get stories from IndexedDB
          stories = await this.indexedDBHelper.getStories();
        }
      } else {
        // If offline, get stories from IndexedDB
        stories = await this.indexedDBHelper.getStories();
      }

      if (stories.length === 0) {
        // Show a notification if no stories with location
        const notification = document.getElementById("notification");
        notification.textContent = "Belum ada cerita dengan lokasi";
        notification.classList.add("show", "info");
        setTimeout(() => {
          notification.classList.remove("show");
        }, 3000);
        return;
      }

      let markersAdded = 0;

      stories.forEach((story) => {
        if (story.lat && story.lon) {
          this.mapHelper.addMarker(
            story.lat,
            story.lon,
            story.name,
            `
            <div class="map-popup">
              <h3>${story.name}</h3>
              <img src="${story.photoUrl}" alt="${
              story.name
            }" onerror="this.onerror=null;this.src='/assets/images/placeholder-image.png';">
              <p>${story.description}</p>
              <small>${this.formatDate(story.createdAt)}</small>
            </div>
          `
          );
          markersAdded++;
        }
      });

      // If we have markers, fit the map to show all of them
      if (markersAdded > 0) {
        this.mapHelper.fitMapToMarkers("stories-map");
      } else {
        // Show a notification if no stories with location
        const notification = document.getElementById("notification");
        notification.textContent = "Belum ada cerita dengan lokasi";
        notification.classList.add("show", "info");
        setTimeout(() => {
          notification.classList.remove("show");
        }, 3000);
      }
    } catch (error) {
      console.error("Error loading stories for map:", error);
      // Show error notification
      const notification = document.getElementById("notification");
      notification.textContent = `Gagal memuat cerita untuk peta: ${error.message}`;
      notification.classList.add("show", "error");
      setTimeout(() => {
        notification.classList.remove("show");
      }, 3000);
    }
  }

  async createStoryItem(story, isFavorite = false) {
    const template = document.getElementById("story-item-template");
    const storyItem = document
      .importNode(template.content, true)
      .querySelector(".story-item");

    storyItem.querySelector(".author-name").textContent = story.name;
    storyItem.querySelector(".story-date").textContent = this.formatDate(
      story.createdAt
    );

    const storyImg = storyItem.querySelector(".story-img");

    // PERBAIKAN: Preload gambar untuk offline mode
    if (story.photoUrl) {
      // Cek apakah gambar sudah di-cache
      this.preloadAndCacheImage(story.photoUrl, storyImg);
    } else {
      storyImg.src = "/assets/images/placeholder-image.png";
    }

    storyImg.alt = `Foto dari ${story.name}`;

    // Improved error handler for images with retry logic
    storyImg.onerror = function () {
      // If failed to load original URL, try using a cached version
      if (this.src !== story.photoUrl && story.photoUrl) {
        console.log("Trying to use original URL as fallback:", story.photoUrl);
        this.src = story.photoUrl;
      } else {
        // If that fails too, use placeholder
        this.onerror = null; // Prevent infinite loop
        this.src = "/assets/images/placeholder-image.png";
        console.log("Using placeholder image");
      }
    };

    storyItem.querySelector(".story-description").textContent =
      story.description;

    const locationElement = storyItem.querySelector(".story-location");
    if (story.lat && story.lon) {
      locationElement.querySelector(
        ".location-text"
      ).textContent = `${story.lat.toFixed(4)}, ${story.lon.toFixed(4)}`;

      // Add a click handler to show this location on the map
      locationElement.style.cursor = "pointer";
      locationElement.title = "Klik untuk melihat di peta";
      locationElement.addEventListener("click", () => {
        // Switch to map view
        document.getElementById("view-map").click();

        // Center map on this location
        if (this.mapHelper && this.mapHelper.maps["stories-map"]) {
          this.mapHelper.maps["stories-map"].map.setView(
            [story.lat, story.lon],
            15
          );

          // Find and open the popup for this marker
          this.mapHelper.markers["stories-map"].forEach((marker) => {
            const markerPos = marker.getLatLng();
            if (markerPos.lat === story.lat && markerPos.lng === story.lon) {
              marker.openPopup();
            }
          });
        }
      });
    } else {
      locationElement.style.display = "none";
    }

    // Add favorite functionality
    const favoriteButton = storyItem.querySelector(".btn-favorite");

    // Check if the story is already in favorites
    const isAlreadyFavorite =
      isFavorite || (await this.favoriteStoryHelper.isStoryFavorited(story.id));

    if (isAlreadyFavorite) {
      favoriteButton.classList.add("favorited");
      favoriteButton.setAttribute("aria-label", "Hapus dari favorit");
      favoriteButton.title = "Hapus dari favorit";
    } else {
      favoriteButton.setAttribute("aria-label", "Tambahkan ke favorit");
      favoriteButton.title = "Tambahkan ke favorit";
    }

    favoriteButton.addEventListener("click", async () => {
      try {
        if (isAlreadyFavorite) {
          // If already favorited, remove from favorites
          await this.favoriteStoryHelper.removeFromFavorites(story.id);
          favoriteButton.classList.remove("favorited");
          favoriteButton.setAttribute("aria-label", "Tambahkan ke favorit");
          favoriteButton.title = "Tambahkan ke favorit";

          // Show notification
          const notification = document.getElementById("notification");
          notification.textContent = "Cerita dihapus dari favorit";
          notification.classList.add("show", "info");
          setTimeout(() => notification.classList.remove("show"), 3000);

          // If we're on favorites page, reload the list
          if (window.location.hash === "#favorites") {
            this.loadFavoriteStories();
          }
        } else {
          // If not favorited, add to favorites
          await this.favoriteStoryHelper.addToFavorites(story);
          favoriteButton.classList.add("favorited");
          favoriteButton.setAttribute("aria-label", "Hapus dari favorit");
          favoriteButton.title = "Hapus dari favorit";

          // Show notification
          const notification = document.getElementById("notification");
          notification.textContent = "Cerita ditambahkan ke favorit";
          notification.classList.add("show", "success");
          setTimeout(() => notification.classList.remove("show"), 3000);
        }
      } catch (error) {
        console.error("Error toggling favorite status:", error);

        // Show error notification
        const notification = document.getElementById("notification");
        notification.textContent = `Gagal mengubah status favorit: ${error.message}`;
        notification.classList.add("show", "error");
        setTimeout(() => notification.classList.remove("show"), 3000);
      }
    });

    return storyItem;
  }

  // PERBAIKAN: Preload dan cache gambar untuk offline mode
  async preloadAndCacheImage(url, imgElement) {
    // Set image source immediately so user sees something loading
    imgElement.src = url;

    // Try to access the cache
    if ("caches" in window) {
      try {
        // Check if image is already in cache
        const cacheResponse = await caches.match(url);

        if (cacheResponse && cacheResponse.ok) {
          console.log("Image found in cache:", url);
          // Image is in cache, we can use it
          return;
        }

        // If not in cache and we're online, let's cache it
        if (navigator.onLine) {
          console.log("Image not in cache, fetching and caching:", url);

          // Fetch the image
          const response = await fetch(url, {
            mode: "cors",
            credentials: "omit",
          });

          if (response.ok) {
            // Clone the response since it can only be used once
            const responseClone = response.clone();

            // Add to cache
            const cache = await caches.open("images-cache-v3");
            await cache.put(url, responseClone);
            console.log("Image successfully cached:", url);
          }
        }
      } catch (error) {
        console.error("Error preloading/caching image:", error);
      }
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async addStory(storyData) {
    // Add a submission lock to prevent duplicate submissions
    if (this._isSubmitting) {
      console.log(
        "Already submitting a story, preventing duplicate submission"
      );
      return false;
    }

    this._isSubmitting = true;

    try {
      const formData = new FormData();
      formData.append("description", storyData.description);
      formData.append("photo", storyData.photo);

      if (storyData.lat && storyData.lon) {
        formData.append("lat", storyData.lat);
        formData.append("lon", storyData.lon);
      }

      // If online, send directly to API
      if (this.isOnline) {
        await this.apiService.addStory(formData);
      } else {
        // If offline, save to IndexedDB for later sync
        await this.indexedDBHelper.savePendingStory({
          description: storyData.description,
          photo: storyData.photo,
          lat: storyData.lat || null,
          lon: storyData.lon || null,
        });
      }

      // Show success notification
      const notification = document.getElementById("notification");
      if (this.isOnline) {
        notification.textContent = "Cerita berhasil ditambahkan";
      } else {
        notification.textContent =
          "Cerita disimpan dan akan dikirim saat online";
      }
      notification.classList.add("show", "success");

      setTimeout(() => {
        notification.classList.remove("show");
      }, 3000);

      // Clear form
      document.getElementById("story-description").value = "";
      document.getElementById("photo-preview").innerHTML =
        "<p>Belum ada foto</p>";
      document.getElementById("story-lat").value = "";
      document.getElementById("story-lon").value = "";
      document.getElementById("selected-location").textContent =
        "Belum ada lokasi dipilih. Klik pada peta untuk memilih lokasi.";

      // Navigate to stories page
      window.location.hash = "#stories";

      this._isSubmitting = false;
      return true;
    } catch (error) {
      console.error("Error adding story:", error);

      // Show error notification
      const notification = document.getElementById("notification");
      notification.textContent = `Gagal menambahkan cerita: ${error.message}`;
      notification.classList.add("show", "error");

      setTimeout(() => {
        notification.classList.remove("show");
      }, 3000);

      this._isSubmitting = false;
      throw error;
    }
  }
}
