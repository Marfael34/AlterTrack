import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Company } from '../types/company';

const REFERENCE_POINT_KEY = 'altertrack_reference_point';
const GEO_CACHE_KEY = 'altertrack_geo_cache';

export interface ReferencePoint {
  label: string;
  latitude: number;
  longitude: number;
  isGps?: boolean;
}

export interface GeocodeResult {
  label: string;
  city: string;
  postcode?: string;
  latitude: number;
  longitude: number;
}

// Cache en mémoire pour éviter les requêtes réseau répétées
const memoryGeoCache: Record<string, { latitude: number; longitude: number }> = {};
let isCacheLoaded = false;

async function loadCache(): Promise<void> {
  if (isCacheLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(GEO_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(memoryGeoCache, parsed);
    }
  } catch {
    // Ignore error
  } finally {
    isCacheLoaded = true;
  }
}

async function saveToCache(key: string, coords: { latitude: number; longitude: number }): Promise<void> {
  memoryGeoCache[key] = coords;
  try {
    await AsyncStorage.setItem(GEO_CACHE_KEY, JSON.stringify(memoryGeoCache));
  } catch {
    // Ignore error
  }
}

export const LocationService = {
  /**
   * Calcule la distance entre deux coordonnées GPS via la formule de Haversine
   */
  calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Rayon moyen de la Terre en kilomètres
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    return Math.round(dist * 10) / 10;
  },

  /**
   * Formate la distance pour un affichage propre (ex: "850 m" ou "12.4 km")
   */
  formatDistance(km: number | null | undefined): string | null {
    if (km === null || km === undefined || isNaN(km)) return null;
    if (km < 1) {
      const meters = Math.round(km * 1000);
      return `${meters} m`;
    }
    return `${km.toFixed(1)} km`;
  },

  /**
   * Récupère le point de référence défini par l'utilisateur (domicile, école, etc.)
   */
  async getReferencePoint(): Promise<ReferencePoint | null> {
    try {
      const raw = await AsyncStorage.getItem(REFERENCE_POINT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as ReferencePoint;
    } catch {
      return null;
    }
  },

  /**
   * Sauvegarde le point de référence
   */
  async setReferencePoint(point: ReferencePoint | null): Promise<void> {
    try {
      if (!point) {
        await AsyncStorage.removeItem(REFERENCE_POINT_KEY);
      } else {
        await AsyncStorage.setItem(REFERENCE_POINT_KEY, JSON.stringify(point));
      }
    } catch {
      // Ignore error
    }
  },

  /**
   * Récupère la position GPS actuelle du smartphone via expo-location
   */
  async getCurrentGpsLocation(): Promise<ReferencePoint> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error(
        "L'autorisation de géolocalisation a été refusée. Veuillez autoriser l'accès GPS dans les paramètres de votre appareil.",
      );
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const latitude = pos.coords.latitude;
    const longitude = pos.coords.longitude;

    // Tentative de reverse-geocodage pour trouver la ville
    let cityLabel = 'Ma position GPS';
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        const cityName = addr.city || addr.subregion || addr.region;
        if (cityName) {
          cityLabel = `Ma position (${cityName})`;
        }
      }
    } catch {
      // Fallback
    }

    return {
      label: cityLabel,
      latitude,
      longitude,
      isGps: true,
    };
  },

  /**
   * Recherche d'adresses et de villes via l'API Adresse officielle française
   */
  async searchAddress(query: string): Promise<GeocodeResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    try {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`;
      const res = await fetch(url);
      if (!res.ok) return [];

      const data = (await res.json()) as {
        features?: Array<{
          properties: { label: string; city: string; postcode?: string };
          geometry: { coordinates: [number, number] };
        }>;
      };

      if (!data.features) return [];

      return data.features.map((f) => ({
        label: f.properties.label,
        city: f.properties.city,
        postcode: f.properties.postcode,
        longitude: f.geometry.coordinates[0],
        latitude: f.geometry.coordinates[1],
      }));
    } catch {
      return [];
    }
  },

  /**
   * Géocode un texte (adresse ou ville) avec mise en cache
   */
  async geocodeQuery(query: string): Promise<{ latitude: number; longitude: number } | null> {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    await loadCache();
    if (memoryGeoCache[q]) {
      return memoryGeoCache[q];
    }

    const results = await this.searchAddress(query);
    if (results.length > 0) {
      const coords = { latitude: results[0].latitude, longitude: results[0].longitude };
      await saveToCache(q, coords);
      return coords;
    }

    return null;
  },

  /**
   * Récupère ou résout les coordonnées d'une entreprise (depuis ses champs ou par géocodage de sa ville/adresse)
   */
  async getCompanyCoordinates(
    company: Company,
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (
      typeof company.latitude === 'number' &&
      typeof company.longitude === 'number' &&
      !isNaN(company.latitude) &&
      !isNaN(company.longitude)
    ) {
      return { latitude: company.latitude, longitude: company.longitude };
    }

    const cleanAddr = company.address?.trim() || '';
    const cleanCity = company.city?.trim() || '';

    // 1. Si on a l'adresse et la ville/commune, combiner les deux pour une géolocalisation exacte
    if (cleanAddr && cleanCity) {
      const combined = `${cleanAddr}, ${cleanCity}`;
      const res = await this.geocodeQuery(combined);
      if (res) return res;
      // Repli si l'adresse exacte n'est pas trouvée : géocoder au moins la commune
      return this.geocodeQuery(cleanCity);
    }

    // 2. Si on a seulement la ville/commune
    if (cleanCity) {
      return this.geocodeQuery(cleanCity);
    }

    // 3. Si on a seulement l'adresse
    if (cleanAddr) {
      return this.geocodeQuery(cleanAddr);
    }

    return null;
  },

  /**
   * Calcule la distance entre une entreprise et un point de référence
   */
  async getDistanceToCompany(
    company: Company,
    refPoint: ReferencePoint | null,
  ): Promise<number | null> {
    if (!refPoint) return null;

    const coords = await this.getCompanyCoordinates(company);
    if (!coords) return null;

    return this.calculateDistanceKm(
      refPoint.latitude,
      refPoint.longitude,
      coords.latitude,
      coords.longitude,
    );
  },
};
