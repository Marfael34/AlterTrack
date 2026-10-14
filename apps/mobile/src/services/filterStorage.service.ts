import AsyncStorage from '@react-native-async-storage/async-storage';
import { Status } from '../types/company';

const FILTERS_STORAGE_KEY = 'altertrack_saved_filters_v1';

export type SortByOption = 'updatedAt' | 'name' | 'city' | 'distance';
export type SortOrderOption = 'asc' | 'desc';
export type ViewModeOption = 'LIST' | 'MAP';
export type DistanceFilterOption = 'ALL' | 15 | 30 | 50;

export interface SavedFilterState {
  selectedStatuses: Status[];
  selectedCity: string | 'ALL';
  selectedCities: string[];
  sortBy: SortByOption;
  sortOrder: SortOrderOption;
  viewMode: ViewModeOption;
  searchQuery: string;
  mapTab: 'RADAR' | 'MAP';
  maxRadius: DistanceFilterOption;
}

export const DEFAULT_FILTERS: SavedFilterState = {
  selectedStatuses: [],
  selectedCity: 'ALL',
  selectedCities: [],
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  viewMode: 'LIST',
  searchQuery: '',
  mapTab: 'RADAR',
  maxRadius: 'ALL',
};

// Cache en mémoire pour accès synchrone instantané (0ms de latence)
let memoryFilters: SavedFilterState = { ...DEFAULT_FILTERS };
let isLoaded = false;
let loadPromise: Promise<SavedFilterState> | null = null;
const listeners = new Set<(filters: SavedFilterState) => void>();

export const FilterStorageService = {
  /**
   * Retourne immédiatement les filtres en mémoire (accès synchrone)
   */
  getFiltersSync(): SavedFilterState {
    return { ...memoryFilters };
  },

  /**
   * Indique si les filtres ont déjà été chargés depuis le stockage persistant
   */
  isLoaded(): boolean {
    return isLoaded;
  },

  /**
   * Charge les filtres depuis AsyncStorage et met à jour le cache mémoire
   */
  async loadFilters(): Promise<SavedFilterState> {
    if (isLoaded) {
      return { ...memoryFilters };
    }
    if (loadPromise) {
      return loadPromise;
    }

    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(FILTERS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const rawCities: string[] = Array.isArray(parsed.selectedCities)
            ? parsed.selectedCities
            : (typeof parsed.selectedCity === 'string' && parsed.selectedCity !== 'ALL'
              ? [parsed.selectedCity]
              : []);

          memoryFilters = {
            selectedStatuses: Array.isArray(parsed.selectedStatuses)
              ? parsed.selectedStatuses
              : DEFAULT_FILTERS.selectedStatuses,
            selectedCities: rawCities,
            selectedCity:
              rawCities.length === 1
                ? rawCities[0]
                : (rawCities.length > 1 ? rawCities.join(', ') : 'ALL'),
            sortBy:
              parsed.sortBy === 'updatedAt' ||
              parsed.sortBy === 'name' ||
              parsed.sortBy === 'city' ||
              parsed.sortBy === 'distance'
                ? parsed.sortBy
                : DEFAULT_FILTERS.sortBy,
            sortOrder:
              parsed.sortOrder === 'asc' || parsed.sortOrder === 'desc'
                ? parsed.sortOrder
                : DEFAULT_FILTERS.sortOrder,
            viewMode: parsed.viewMode === 'MAP' ? 'MAP' : 'LIST',
            searchQuery:
              typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
            mapTab: parsed.mapTab === 'MAP' ? 'MAP' : 'RADAR',
            maxRadius:
              parsed.maxRadius === 15 ||
              parsed.maxRadius === 30 ||
              parsed.maxRadius === 50 ||
              parsed.maxRadius === 'ALL'
                ? parsed.maxRadius
                : 'ALL',
          };
        }
      } catch {
        // En cas d'erreur de lecture, conserver les valeurs par défaut
      } finally {
        isLoaded = true;
        loadPromise = null;
      }
      return { ...memoryFilters };
    })();

    return loadPromise;
  },

  /**
   * Enregistre les filtres en mémoire immédiatement et persiste dans AsyncStorage
   */
  saveFilters(partial: Partial<SavedFilterState>): void {
    const updated: SavedFilterState = {
      ...memoryFilters,
      ...partial,
    };
    if (partial.selectedCities !== undefined && partial.selectedCity === undefined) {
      updated.selectedCity =
        partial.selectedCities.length === 1
          ? partial.selectedCities[0]
          : (partial.selectedCities.length > 1 ? partial.selectedCities.join(', ') : 'ALL');
    }
    memoryFilters = updated;
    listeners.forEach((cb) => {
      try {
        cb({ ...memoryFilters });
      } catch {}
    });

    // Sauvegarde asynchrone non-bloquante
    void AsyncStorage.setItem(
      FILTERS_STORAGE_KEY,
      JSON.stringify(memoryFilters),
    ).catch(() => {});
  },

  /**
   * Réinitialise tous les filtres aux valeurs par défaut
   */
  async resetFilters(): Promise<SavedFilterState> {
    memoryFilters = { ...DEFAULT_FILTERS };
    listeners.forEach((cb) => {
      try {
        cb({ ...memoryFilters });
      } catch {}
    });
    try {
      await AsyncStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify(DEFAULT_FILTERS),
      );
    } catch {}
    return { ...memoryFilters };
  },

  /**
   * Permet de s'abonner aux changements de filtres
   */
  subscribe(listener: (filters: SavedFilterState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// Pré-chargement automatique au runtime dès l'évaluation du module
void FilterStorageService.loadFilters();
