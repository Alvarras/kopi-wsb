export class StorageService {
  constructor() {
    this.TOKEN_KEY = "kopi_slukatan_token";
    this.USER_KEY = "kopi_slukatan_user";
  }

  saveToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  removeToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  saveUser(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  getUser() {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  removeUser() {
    localStorage.removeItem(this.USER_KEY);
  }

  clearAll() {
    this.removeToken();
    this.removeUser();
  }
}
