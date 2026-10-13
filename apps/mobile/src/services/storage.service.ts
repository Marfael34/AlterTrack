import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'altertrack_server_url';
const API_KEY_KEY = 'altertrack_api_key';

// Par défaut, cible l'adresse locale ou l'émulateur
const DEFAULT_SERVER_URL = 'http://10.0.2.2:3000';
const DEFAULT_API_KEY = 'change_this_secret_api_key_min_32_chars';

export const StorageService = {
  async getServerUrl(): Promise<string> {
    try {
      const value = await AsyncStorage.getItem(SERVER_URL_KEY);
      return value || DEFAULT_SERVER_URL;
    } catch {
      return DEFAULT_SERVER_URL;
    }
  },

  async setServerUrl(url: string): Promise<void> {
    const cleanUrl = url.trim().replace(/\/+$/, ''); // retire les slashs finaux
    await AsyncStorage.setItem(SERVER_URL_KEY, cleanUrl);
  },

  async getApiKey(): Promise<string> {
    try {
      const value = await AsyncStorage.getItem(API_KEY_KEY);
      return value || DEFAULT_API_KEY;
    } catch {
      return DEFAULT_API_KEY;
    }
  },

  async setApiKey(apiKey: string): Promise<void> {
    await AsyncStorage.setItem(API_KEY_KEY, apiKey.trim());
  },
};
