import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { ApiService, AppReleaseInfo } from '../services/api.service';
import { compareVersions } from '../utils/version';

const DISMISSED_VERSION_KEY = 'altertrack_dismissed_update_version';
// Pas plus d'une vérification toutes les 30 minutes quand l'app revient au premier plan
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Bandeau « Nouvelle version disponible » affiché dans l'APK Android
 * quand une release GitHub plus récente que la version installée est publiée.
 */
export function UpdateBanner() {
  const [release, setRelease] = useState<AppReleaseInfo | null>(null);
  const lastCheckRef = useRef(0);
  const installedVersion = Constants.expoConfig?.version ?? '0.0.0';

  // Uniquement dans l'APK : le site web est toujours à jour, et Expo Go n'a pas de version figée.
  // EXPO_PUBLIC_TEST_UPDATE_BANNER=1 dans apps/mobile/.env permet de le tester dans Expo Go.
  const forceInDev = process.env.EXPO_PUBLIC_TEST_UPDATE_BANNER === '1';
  const enabled = Platform.OS === 'android' && (!__DEV__ || forceInDev);

  const checkForUpdate = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_INTERVAL_MS) return;
    lastCheckRef.current = now;

    try {
      const latest = await ApiService.getLatestAppRelease();
      if (!latest?.available || !latest.version) return;
      if (compareVersions(latest.version, installedVersion) <= 0) {
        setRelease(null);
        return;
      }
      const dismissed = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
      if (dismissed === latest.version) return;
      setRelease(latest);
    } catch {
      // Serveur injoignable : on réessaiera au prochain retour au premier plan
      lastCheckRef.current = 0;
    }
  }, [installedVersion]);

  useEffect(() => {
    if (!enabled) return;
    void checkForUpdate();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdate();
    });
    return () => sub.remove();
  }, [enabled, checkForUpdate]);

  if (!enabled || !release) return null;

  const handleDownload = async () => {
    let url = release.downloadUrl;
    if (url.startsWith('/')) {
      url = `${await ApiService.getBaseUrl()}${url}`;
    }
    await Linking.openURL(url);
  };

  const handleLater = async () => {
    await AsyncStorage.setItem(DISMISSED_VERSION_KEY, release.version);
    setRelease(null);
  };

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.textBlock}>
        <Text style={styles.title}>Nouvelle version {release.version} disponible</Text>
        <Text style={styles.subtitle}>
          Version installée : {installedVersion}
          {release.size ? ` · ${release.size}` : ''}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleLater} style={styles.laterBtn}>
          <Text style={styles.laterText}>Plus tard</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDownload} style={styles.downloadBtn}>
          <Text style={styles.downloadText}>Télécharger</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brandCyan,
    backgroundColor: Colors.cardBackground,
    gap: 10,
  },
  textBlock: {
    gap: 2,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  laterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  laterText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  downloadBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.brandBlue,
  },
  downloadText: {
    color: Colors.brandWhite,
    fontWeight: '700',
  },
});
