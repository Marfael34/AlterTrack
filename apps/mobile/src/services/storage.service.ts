import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SERVER_URL_KEY = 'altertrack_server_url';
const API_KEY_KEY = 'altertrack_api_key';

// URL de l'API définie dans le .env (ex: https://altertrack.duckdns.org)
const PROD_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || '';
const DEFAULT_WEB_URL = PROD_API_URL || 'http://localhost:3000';
const DEFAULT_API_KEY =
  process.env.EXPO_PUBLIC_API_KEY?.trim() || 'altertrack_dev_secret_key_2026_super_safe';

export const StorageService = {
  getProductionUrl(): string {
    return PROD_API_URL;
  },

  isProduction(): boolean {
    if (Boolean(PROD_API_URL)) return true;
    if (process.env.NODE_ENV === 'production') return true;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const host = window.location.hostname;
      return (
        host !== 'localhost' &&
        host !== '127.0.0.1' &&
        !host.startsWith('192.168.')
      );
    }
    return false;
  },

  async getServerUrl(): Promise<string> {
    // En production : l'URL est celle définie dans EXPO_PUBLIC_API_URL
    if (this.isProduction()) {
      return PROD_API_URL || 'https://altertrack.duckdns.org';
    }

    const isWeb = Platform.OS === 'web';
    if (isWeb) {
      try {
        const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
        if (stored && stored.trim()) {
          return stored.trim();
        }
      } catch {
        // Ignorer l'erreur de lecture
      }
      return DEFAULT_WEB_URL;
    }

    try {
      const value = await AsyncStorage.getItem(SERVER_URL_KEY);
      if (value && value.trim()) {
        return value.trim();
      }
      // Pas d'URL sauvegardée : utiliser l'URL de production ou localhost par défaut
      const defaultUrl = PROD_API_URL || DEFAULT_WEB_URL;
      await AsyncStorage.setItem(SERVER_URL_KEY, defaultUrl);
      return defaultUrl;
    } catch {
      return PROD_API_URL || DEFAULT_WEB_URL;
    }
  },

  async setServerUrl(url: string): Promise<void> {
    // En production, l'URL est immuable et verrouillée sur l'infrastructure de production
    if (this.isProduction()) {
      return;
    }
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

