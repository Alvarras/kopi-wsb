export class ApiService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async register(name, email, password) {
    try {
      const response = await fetch(`${this.baseUrl}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message);
      }

      return data;
    } catch (error) {
      // Check if it's a network error
      if (!navigator.onLine || error.name === "TypeError") {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }
      throw new Error(error.message || "Gagal mendaftar");
    }
  }

  async login(email, password) {
    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message);
      }

      return data.loginResult;
    } catch (error) {
      // Check if it's a network error
      if (!navigator.onLine || error.name === "TypeError") {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }
      throw new Error(error.message || "Gagal masuk");
    }
  }

  async getStories(page = 1, size = 10, location = 0) {
    try {
      // Check for internet connection first
      if (!navigator.onLine) {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }

      const url = new URL(`${this.baseUrl}/stories`);
      url.searchParams.append("page", page);
      url.searchParams.append("size", size);
      url.searchParams.append("location", location);

      const headers = {};
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        headers,
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message);
      }

      return data.listStory;
    } catch (error) {
      // Check if it's a network error
      if (!navigator.onLine || error.name === "TypeError") {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }
      throw new Error(error.message || "Gagal mengambil cerita");
    }
  }

  async getStoryDetail(id) {
    try {
      // Check for internet connection first
      if (!navigator.onLine) {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }

      const headers = {};
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseUrl}/stories/${id}`, {
        headers,
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message);
      }

      return data.story;
    } catch (error) {
      // Check if it's a network error
      if (!navigator.onLine || error.name === "TypeError") {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }
      throw new Error(error.message || "Gagal mengambil detail cerita");
    }
  }

  async addStory(formData) {
    try {
      // Check for internet connection first
      if (!navigator.onLine) {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }

      // Prevent duplicate submissions with a lock
      if (this._submittingStory) {
        console.log(
          "Already submitting a story to API, preventing duplicate submission"
        );
        return { message: "Submission already in progress" };
      }

      this._submittingStory = true;

      const url = this.token
        ? `${this.baseUrl}/stories`
        : `${this.baseUrl}/stories/guest`;
      const headers = {};

      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message);
      }

      // Release the lock after successful submission
      this._submittingStory = false;
      return data;
    } catch (error) {
      // Release the lock if there's an error
      this._submittingStory = false;

      // Check if it's a network error
      if (!navigator.onLine || error.name === "TypeError") {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }
      throw new Error(error.message || "Gagal menambahkan cerita");
    }
  }

  async subscribeToPushNotifications(subscription) {
    try {
      // Check for internet connection first
      if (!navigator.onLine) {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }

      // Ensure we have a token
      if (!this.token) {
        throw new Error("Anda harus login terlebih dahulu");
      }

      console.log("Sending subscription to API:", subscription);

      const response = await fetch(`${this.baseUrl}/notifications/subscribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message);
      }

      console.log("API subscription response:", data);
      return data;
    } catch (error) {
      // Check if it's a network error
      if (!navigator.onLine || error.name === "TypeError") {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }
      throw new Error(error.message || "Gagal berlangganan notifikasi");
    }
  }

  async unsubscribeFromPushNotifications(subscription) {
    try {
      // Check for internet connection first
      if (!navigator.onLine) {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }

      // Ensure we have a token
      if (!this.token) {
        throw new Error("Anda harus login terlebih dahulu");
      }

      console.log("Sending unsubscription to API:", subscription);

      const response = await fetch(`${this.baseUrl}/notifications/subscribe`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message);
      }

      console.log("API unsubscription response:", data);
      return data;
    } catch (error) {
      // Check if it's a network error
      if (!navigator.onLine || error.name === "TypeError") {
        throw new Error(
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
        );
      }
      throw new Error(
        error.message || "Gagal berhenti berlangganan notifikasi"
      );
    }
  }
}
