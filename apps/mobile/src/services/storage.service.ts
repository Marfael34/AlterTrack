import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import tunnelConfig from '../constants/tunnelUrl.json';

const SERVER_URL_KEY = 'altertrack_server_url';
const API_KEY_KEY = 'altertrack_api_key';

// Sur Web (navigateur sur le PC hôte) : localhost:3000 ou URL de production
// Sur Mobile : Priorité à l'URL de production si définie, sinon tunnel HTTPS distant, sinon Wi-Fi local
const PROD_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || '';
const DEFAULT_TUNNEL_URL = tunnelConfig?.url || '';
const DEFAULT_LOCAL_WIFI_URL = 'http://192.168.1.27:3000';
const DEFAULT_WEB_URL = PROD_API_URL || 'http://localhost:3000';
const DEFAULT_API_KEY = 'altertrack_dev_secret_key_2026_super_safe';

async function checkUrlReachable(url: string, timeoutMs: number = 600): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${url}/health`, {
      signal: controller.signal,
      headers: { 'x-api-key': DEFAULT_API_KEY },
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export const StorageService = {
  getTunnelUrl(): string {
    return DEFAULT_TUNNEL_URL;
  },

  getLocalWifiUrl(): string {
    return DEFAULT_LOCAL_WIFI_URL;
  },

  getProductionUrl(): string {
    return PROD_API_URL;
  },

  async getServerUrl(): Promise<string> {
    const isWeb = Platform.OS === 'web';
    if (isWeb) {
      return PROD_API_URL || DEFAULT_WEB_URL;
    }

    try {
      const value = await AsyncStorage.getItem(SERVER_URL_KEY);

      // Si le Wi-Fi local du PC répond (smartphone sur le même réseau Wi-Fi), on le privilégie directement
      const wifiAvailable = await checkUrlReachable(DEFAULT_LOCAL_WIFI_URL, 500);
      if (wifiAvailable) {
        if (value !== DEFAULT_LOCAL_WIFI_URL) {
          await AsyncStorage.setItem(SERVER_URL_KEY, DEFAULT_LOCAL_WIFI_URL);
        }
        return DEFAULT_LOCAL_WIFI_URL;
      }

      // Si le Wi-Fi ne répond pas (ex: en déplacement 4G/5G) :
      const isInvalid = !value || value.includes('localhost') || value.includes('127.0.0.1') || value.includes('192.168.1.101');
      const isOutdatedTunnel = value?.includes('.trycloudflare.com') && DEFAULT_TUNNEL_URL && value !== DEFAULT_TUNNEL_URL;

      if (!isInvalid && !isOutdatedTunnel && value && !value.includes('192.168.1.')) {
        return value;
      }

      const defaultUrl = DEFAULT_TUNNEL_URL || DEFAULT_LOCAL_WIFI_URL;
      await AsyncStorage.setItem(SERVER_URL_KEY, defaultUrl);
      return defaultUrl;
    } catch {
      return DEFAULT_TUNNEL_URL || DEFAULT_LOCAL_WIFI_URL;
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

  async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('altertrack_auth_token');
    } catch {
      return null;
    }
  },

  async setAuthToken(token: string): Promise<void> {
    await AsyncStorage.setItem('altertrack_auth_token', token.trim());
  },

  async removeAuthToken(): Promise<void> {
    await AsyncStorage.removeItem('altertrack_auth_token');
  },

  async getAuthUser(): Promise<any | null> {
    try {
      const raw = await AsyncStorage.getItem('altertrack_auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setAuthUser(user: any): Promise<void> {
    await AsyncStorage.setItem('altertrack_auth_user', JSON.stringify(user));
  },

  async removeAuthUser(): Promise<void> {
    await AsyncStorage.removeItem('altertrack_auth_user');
  },

  async getLocalCv(): Promise<LocalCvInfo | null> {
    try {
      const raw = await AsyncStorage.getItem('altertrack_local_cv');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setLocalCv(cv: LocalCvInfo): Promise<void> {
    await AsyncStorage.setItem('altertrack_local_cv', JSON.stringify(cv));
  },

  async removeLocalCv(): Promise<void> {
    await AsyncStorage.removeItem('altertrack_local_cv');
  },
};

export interface LocalCvInfo {
  fileName: string;
  fileSize?: number;
  fileUri?: string;
  uploadedAt: string;
  isSynced: boolean;
}

export function formatStandardCvName(fullName?: string | null): string {
  if (!fullName || !fullName.trim()) {
    return 'candidat_CV.pdf';
  }

  // Remplacer les tirets et underscores par des espaces pour traiter les noms composés
  const normalizedSpaces = fullName.trim().replace(/[-_]+/g, ' ');
  const rawParts = normalizedSpaces.split(/\s+/).filter(Boolean);
  if (rawParts.length === 0) return 'candidat_CV.pdf';

  const cleanPart = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

  if (rawParts.length === 1) {
    const single = cleanPart(rawParts[0]);
    return single ? `${single}_CV.pdf` : 'candidat_CV.pdf';
  }

  let nom = '';
  let prenom = '';

  const firstWord = rawParts[0];
  const isFirstWordAllUpper =
    firstWord.length > 1 &&
    firstWord === firstWord.toUpperCase() &&
    rawParts.slice(1).some((w) => w !== w.toUpperCase());

  if (isFirstWordAllUpper) {
    nom = cleanPart(firstWord);
    prenom = rawParts.slice(1).map(cleanPart).filter(Boolean).join('_');
  } else {
    prenom = cleanPart(rawParts[0]);
    nom = rawParts.slice(1).map(cleanPart).filter(Boolean).join('_');
  }

  nom = nom || 'nom';
  prenom = prenom || 'prenom';

  return `${nom}_${prenom}_CV.pdf`;
}

