export class CameraHelper {
  constructor() {
    this.stream = null;
    this.videoElement = document.getElementById("camera-preview");
    this.cameraContainer = document.getElementById("camera-container");
    this.photoCanvas = document.getElementById("photo-canvas");
    this.photoPreview = document.getElementById("photo-preview");
    this.photoBlob = null;
  }

  async startCamera() {
    try {
      // Pastikan kamera dimatikan terlebih dahulu
      this.stopCamera();

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
        audio: false,
      });

      this.videoElement.srcObject = this.stream;
      this.cameraContainer.style.display = "block";
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert(
        "Gagal mengakses kamera. Pastikan kamera diizinkan dan berfungsi dengan baik."
      );
    }
  }

  capturePhoto() {
    if (!this.stream) return;

    const context = this.photoCanvas.getContext("2d");

    // Set canvas dimensions to match video
    this.photoCanvas.width = this.videoElement.videoWidth;
    this.photoCanvas.height = this.videoElement.videoHeight;

    // Draw video frame to canvas
    context.drawImage(
      this.videoElement,
      0,
      0,
      this.photoCanvas.width,
      this.photoCanvas.height
    );

    // Convert canvas to blob
    this.photoCanvas.toBlob(
      (blob) => {
        this.photoBlob = blob;

        // Display captured photo
        const photoUrl = URL.createObjectURL(blob);
        this.photoPreview.innerHTML = `<img src="${photoUrl}" alt="Foto yang diambil">`;

        // Stop camera
        this.stopCamera();
      },
      "image/jpeg",
      0.8
    );
  }

  // Perbaiki metode stopCamera untuk memastikan kamera benar-benar dimatikan
  stopCamera() {
    if (this.stream) {
      // Pastikan semua track kamera dihentikan
      this.stream.getTracks().forEach((track) => {
        track.stop();
      });
      this.stream = null;
    }

    // Pastikan video element dibersihkan
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.pause();
    }

    // Sembunyikan container kamera
    if (this.cameraContainer) {
      this.cameraContainer.style.display = "none";
    }

    console.log("Camera stopped successfully");
  }

  getPhotoBlob() {
    return this.photoBlob;
  }
}
