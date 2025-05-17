export class IndexedDBHelper {
  constructor() {
    this.dbName = "kopi-slukatan-db";
    this.dbVersion = 2; // PERBAIKAN: Naikkan versi database untuk menambahkan store baru
    this.db = null;
  }

  async openDB() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.error("Error opening IndexedDB:", event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Buat object stores jika belum ada
        if (oldVersion < 1) {
          // Create object stores untuk versi 1
          if (!db.objectStoreNames.contains("stories")) {
            const storyStore = db.createObjectStore("stories", {
              keyPath: "id",
            });
            storyStore.createIndex("createdAt", "createdAt", { unique: false });
          }

          if (!db.objectStoreNames.contains("pending-stories")) {
            db.createObjectStore("pending-stories", {
              keyPath: "id",
              autoIncrement: true,
            });
          }

          if (!db.objectStoreNames.contains("user-settings")) {
            db.createObjectStore("user-settings", { keyPath: "id" });
          }
        }

        // Tambahkan object store untuk favorite stories di versi 2
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("favorite-stories")) {
            const favoriteStore = db.createObjectStore("favorite-stories", {
              keyPath: "id",
            });
            favoriteStore.createIndex("createdAt", "createdAt", {
              unique: false,
            });
          }
        }
      };
    });
  }

  async saveStories(stories) {
    const db = await this.openDB();
    const transaction = db.transaction("stories", "readwrite");
    const store = transaction.objectStore("stories");

    return new Promise((resolve, reject) => {
      // Clear existing stories first
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        // Add all stories
        let count = 0;
        stories.forEach((story) => {
          const request = store.add(story);
          request.onsuccess = () => {
            count++;
            if (count === stories.length) {
              resolve(true);
            }
          };
          request.onerror = (event) => {
            console.error(
              "Error saving story to IndexedDB:",
              event.target.error
            );
            reject(event.target.error);
          };
        });
      };

      clearRequest.onerror = (event) => {
        console.error(
          "Error clearing stories from IndexedDB:",
          event.target.error
        );
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        console.log("All stories saved to IndexedDB");
      };
    });
  }

  async getStories() {
    const db = await this.openDB();
    const transaction = db.transaction("stories", "readonly");
    const store = transaction.objectStore("stories");
    const index = store.index("createdAt");

    return new Promise((resolve, reject) => {
      const request = index.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error(
          "Error getting stories from IndexedDB:",
          event.target.error
        );
        reject(event.target.error);
      };
    });
  }

  async savePendingStory(story) {
    const db = await this.openDB();
    const transaction = db.transaction("pending-stories", "readwrite");
    const store = transaction.objectStore("pending-stories");

    return new Promise((resolve, reject) => {
      const request = store.add({
        ...story,
        timestamp: new Date().getTime(),
      });

      request.onsuccess = () => {
        resolve(request.result); // Returns the generated key
      };

      request.onerror = (event) => {
        console.error(
          "Error saving pending story to IndexedDB:",
          event.target.error
        );
        reject(event.target.error);
      };
    });
  }

  async getPendingStories() {
    const db = await this.openDB();
    const transaction = db.transaction("pending-stories", "readonly");
    const store = transaction.objectStore("pending-stories");

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error(
          "Error getting pending stories from IndexedDB:",
          event.target.error
        );
        reject(event.target.error);
      };
    });
  }

  async deletePendingStory(id) {
    const db = await this.openDB();
    const transaction = db.transaction("pending-stories", "readwrite");
    const store = transaction.objectStore("pending-stories");

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event) => {
        console.error(
          "Error deleting pending story from IndexedDB:",
          event.target.error
        );
        reject(event.target.error);
      };
    });
  }

  async saveUserSettings(settings) {
    const db = await this.openDB();
    const transaction = db.transaction("user-settings", "readwrite");
    const store = transaction.objectStore("user-settings");

    return new Promise((resolve, reject) => {
      const request = store.put({
        id: "user-settings",
        ...settings,
        updatedAt: new Date().getTime(),
      });

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event) => {
        console.error(
          "Error saving user settings to IndexedDB:",
          event.target.error
        );
        reject(event.target.error);
      };
    });
  }

  async getUserSettings() {
    const db = await this.openDB();
    const transaction = db.transaction("user-settings", "readonly");
    const store = transaction.objectStore("user-settings");

    return new Promise((resolve, reject) => {
      const request = store.get("user-settings");

      request.onsuccess = () => {
        resolve(request.result || {});
      };

      request.onerror = (event) => {
        console.error(
          "Error getting user settings from IndexedDB:",
          event.target.error
        );
        reject(event.target.error);
      };
    });
  }

  // PERBAIKAN: Metode untuk mengelola favorite stories
  async addFavoriteStory(story) {
    try {
      const db = await this.openDB();
      // Pastikan object store sudah ada
      if (!db.objectStoreNames.contains("favorite-stories")) {
        throw new Error("Object store 'favorite-stories' tidak ditemukan");
      }

      const transaction = db.transaction("favorite-stories", "readwrite");
      const store = transaction.objectStore("favorite-stories");

      return new Promise((resolve, reject) => {
        const request = store.put(story);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = (event) => {
          console.error(
            "Error adding favorite story to IndexedDB:",
            event.target.error
          );
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error("Error in addFavoriteStory:", error);
      throw error;
    }
  }

  async getFavoriteStories() {
    try {
      const db = await this.openDB();
      // Pastikan object store sudah ada
      if (!db.objectStoreNames.contains("favorite-stories")) {
        return []; // Return empty array if store doesn't exist
      }

      const transaction = db.transaction("favorite-stories", "readonly");
      const store = transaction.objectStore("favorite-stories");

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = (event) => {
          console.error(
            "Error getting favorite stories from IndexedDB:",
            event.target.error
          );
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error("Error in getFavoriteStories:", error);
      return []; // Return empty array on error
    }
  }

  async getFavoriteStory(id) {
    try {
      const db = await this.openDB();
      // Pastikan object store sudah ada
      if (!db.objectStoreNames.contains("favorite-stories")) {
        return null; // Return null if store doesn't exist
      }

      const transaction = db.transaction("favorite-stories", "readonly");
      const store = transaction.objectStore("favorite-stories");

      return new Promise((resolve, reject) => {
        const request = store.get(id);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (event) => {
          console.error(
            "Error getting favorite story from IndexedDB:",
            event.target.error
          );
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error("Error in getFavoriteStory:", error);
      return null; // Return null on error
    }
  }

  async removeFavoriteStory(id) {
    try {
      const db = await this.openDB();
      // Pastikan object store sudah ada
      if (!db.objectStoreNames.contains("favorite-stories")) {
        throw new Error("Object store 'favorite-stories' tidak ditemukan");
      }

      const transaction = db.transaction("favorite-stories", "readwrite");
      const store = transaction.objectStore("favorite-stories");

      return new Promise((resolve, reject) => {
        const request = store.delete(id);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = (event) => {
          console.error(
            "Error removing favorite story from IndexedDB:",
            event.target.error
          );
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error("Error in removeFavoriteStory:", error);
      throw error;
    }
  }
}
