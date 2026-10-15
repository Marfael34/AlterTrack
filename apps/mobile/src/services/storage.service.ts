import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import tunnelConfig from '../constants/tunnelUrl.json';

const SERVER_URL_KEY = 'altertrack_server_url';
const API_KEY_KEY = 'altertrack_api_key';

// Sur Web (navigateur sur le PC hôte) : localhost:3000
// Sur Mobile : Priorité au tunnel HTTPS distant pour accès 4G/5G/partout, ou Wi-Fi local
const DEFAULT_TUNNEL_URL = tunnelConfig?.url || '';
const DEFAULT_LOCAL_WIFI_URL = 'http://192.168.1.101:3000';
const DEFAULT_WEB_URL = 'http://localhost:3000';
const DEFAULT_API_KEY = 'altertrack_dev_secret_key_2026_super_safe';

export const StorageService = {
  getTunnelUrl(): string {
    return DEFAULT_TUNNEL_URL;
  },

  getLocalWifiUrl(): string {
    return DEFAULT_LOCAL_WIFI_URL;
  },

  async getServerUrl(): Promise<string> {
    const isWeb = Platform.OS === 'web';
    const defaultUrl = isWeb
      ? DEFAULT_WEB_URL
      : DEFAULT_TUNNEL_URL || DEFAULT_LOCAL_WIFI_URL;

    try {
      const value = await AsyncStorage.getItem(SERVER_URL_KEY);
      if (
        !value ||
        (isWeb && value.includes('192.168.1.')) ||
        (!isWeb && (value.includes('192.168.1.27') || value.includes('localhost') || value.includes('127.0.0.1'))) ||
        (!isWeb && value.includes('.trycloudflare.com') && DEFAULT_TUNNEL_URL && value !== DEFAULT_TUNNEL_URL)
      ) {
        await AsyncStorage.setItem(SERVER_URL_KEY, defaultUrl);
        return defaultUrl;
      }
      return value;
    } catch {
      return defaultUrl;
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

  async getTestEmail(): Promise<string> {
    try {
      const value = await AsyncStorage.getItem('altertrack_test_email');
      return value || '';
    } catch {
      return '';
    }
  },

  async setTestEmail(email: string): Promise<void> {
    await AsyncStorage.setItem('altertrack_test_email', email.trim());
  },
};
