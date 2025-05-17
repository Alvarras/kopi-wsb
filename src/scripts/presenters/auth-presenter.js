export class AuthPresenter {
  constructor(apiService, storageService) {
    this.apiService = apiService;
    this.storageService = storageService;
  }

  async register(name, email, password) {
    try {
      await this.apiService.register(name, email, password);
      return true;
    } catch (error) {
      throw error;
    }
  }

  async login(email, password) {
    try {
      const loginResult = await this.apiService.login(email, password);

      // Save token and user data
      this.storageService.saveToken(loginResult.token);
      this.storageService.saveUser({
        id: loginResult.userId,
        name: loginResult.name,
      });

      // Set token for API service
      this.apiService.setToken(loginResult.token);

      return loginResult;
    } catch (error) {
      throw error;
    }
  }

  logout() {
    this.storageService.clearAll();
    this.apiService.setToken(null);
  }
}
