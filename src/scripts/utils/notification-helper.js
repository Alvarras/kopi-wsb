export class NotificationHelper {
  constructor() {
    this.notificationElement = document.getElementById("notification");
  }

  showNotification(message, type = "default") {
    this.notificationElement.textContent = message;
    this.notificationElement.className = "notification";
    this.notificationElement.classList.add("show", type);

    setTimeout(() => {
      this.notificationElement.classList.remove("show");
    }, 3000);
  }
}
