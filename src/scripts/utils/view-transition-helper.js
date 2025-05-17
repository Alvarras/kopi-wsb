export class ViewTransitionHelper {
  constructor() {
    this.supported = typeof document.startViewTransition === "function";
  }

  isSupported() {
    return this.supported;
  }

  transition(callback) {
    if (!this.supported) {
      callback();
      return;
    }

    document.startViewTransition(() => {
      callback();
    });
  }
}
