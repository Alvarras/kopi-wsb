export class FavoriteStoryHelper {
  constructor(indexedDBHelper) {
    this.indexedDBHelper = indexedDBHelper;
  }

  async addToFavorites(story) {
    try {
      // Tambahkan ke IndexedDB
      await this.indexedDBHelper.addFavoriteStory(story);
      return true;
    } catch (error) {
      console.error("Error adding story to favorites:", error);
      throw error;
    }
  }

  async removeFromFavorites(storyId) {
    try {
      // Hapus dari IndexedDB
      await this.indexedDBHelper.removeFavoriteStory(storyId);
      return true;
    } catch (error) {
      console.error("Error removing story from favorites:", error);
      throw error;
    }
  }

  async getFavoriteStories() {
    try {
      // Ambil dari IndexedDB
      return await this.indexedDBHelper.getFavoriteStories();
    } catch (error) {
      console.error("Error getting favorite stories:", error);
      throw error;
    }
  }

  async isStoryFavorited(storyId) {
    try {
      // Cek apakah cerita ada di favorit
      const story = await this.indexedDBHelper.getFavoriteStory(storyId);
      return !!story;
    } catch (error) {
      console.error("Error checking if story is favorited:", error);
      return false;
    }
  }
}
