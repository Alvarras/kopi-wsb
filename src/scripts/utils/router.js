export class Router {
  constructor() {
    this.routes = {};
    this.currentHash = "";
  }

  addRoute(hash, callback) {
    this.routes[hash] = callback;
  }

  init() {
    // Handle initial route
    window.addEventListener("load", () => {
      this.handleRouteChange();
    });

    // Handle route changes
    window.addEventListener("hashchange", () => {
      this.handleRouteChange();
    });
  }

  handleRouteChange() {
    let hash = window.location.hash.substring(1);

    // Default to home if no hash
    if (!hash) {
      hash = "home";
      this.navigateTo("home");
      return;
    }

    this.currentHash = hash;

    // Execute route callback
    if (this.routes[hash]) {
      this.routes[hash]();
    }
  }

  navigateTo(hash) {
    window.location.hash = hash;
  }

  getCurrentHash() {
    return this.currentHash;
  }
}
