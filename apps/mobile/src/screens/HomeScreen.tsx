import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CompanyCard } from '../components/CompanyCard';
import { CompanyMapView } from '../components/CompanyMapView';
import { FiltersModal } from '../components/FiltersModal';
import { ReferencePointModal } from '../components/ReferencePointModal';
import { CityItem } from '../components/CityFilterBar';
import { FilterTabs } from '../components/FilterTabs';
import { Colors } from '../constants/colors';
import { ApiService } from '../services/api.service';
import { FilterStorageService } from '../services/filterStorage.service';
import { StorageService } from '../services/storage.service';
import { LocationService, ReferencePoint } from '../services/location.service';
import { Company, CompanyStats, STATUS_LABELS, Status } from '../types/company';

interface HomeScreenProps {
  onSelectCompany: (company: Company) => void;
  onOpenSettings: () => void;
  onOpenAddCompany: () => void;
  refPoint?: ReferencePoint | null;
  onUpdateRefPoint?: (point: ReferencePoint | null) => void;
  refreshTrigger?: number;
  initialViewMode?: 'LIST' | 'MAP';
  onViewModeChanged?: (mode: 'LIST' | 'MAP') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectCompany,
  onOpenSettings,
  onOpenAddCompany,
  refPoint: propRefPoint,
  onUpdateRefPoint,
  refreshTrigger,
  initialViewMode,
  onViewModeChanged,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<CompanyStats | undefined>(undefined);
  const [cities, setCities] = useState<CityItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Initialisation instantanée depuis la mémoire pour préserver les filtres lors des navigations
  const initialFilters = FilterStorageService.getFiltersSync();
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(
    initialFilters.selectedStatuses,
  );
  const [selectedCities, setSelectedCities] = useState<string[]>(
    initialFilters.selectedCities ||
      (initialFilters.selectedCity && initialFilters.selectedCity !== 'ALL'
        ? [initialFilters.selectedCity]
        : []),
  );
  const [sortBy, setSortBy] = useState<
    'updatedAt' | 'name' | 'city' | 'distance'
  >(initialFilters.sortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    initialFilters.sortOrder,
  );
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>(
    initialViewMode || initialFilters.viewMode,
  );

  useEffect(() => {
    if (initialViewMode && initialViewMode !== viewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  const handleSetViewMode = (mode: 'LIST' | 'MAP') => {
    setViewMode(mode);
    if (onViewModeChanged) {
      onViewModeChanged(mode);
    }
  };
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>(
    initialFilters.searchQuery || '',
  );
  const [isFilterLoaded, setIsFilterLoaded] = useState<boolean>(
    FilterStorageService.isLoaded(),
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sendingBatch, setSendingBatch] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingBatch, setDeletingBatch] = useState<boolean>(false);
  const [refPoint, setRefPoint] = useState<ReferencePoint | null>(propRefPoint || null);
  const [isRefPointModalOpen, setIsRefPointModalOpen] = useState<boolean>(false);
  const [distancesMap, setDistancesMap] = useState<Record<string, number>>({});
  const [connectionError, setConnectionError] = useState<boolean>(false);

  // Au premier montage, si la persistance sur disque est encore en cours de lecture
  useEffect(() => {
    let mounted = true;
    if (!FilterStorageService.isLoaded()) {
      void FilterStorageService.loadFilters().then((loaded) => {
        if (!mounted) return;
        setSelectedStatuses(loaded.selectedStatuses);
        setSelectedCities(
          loaded.selectedCities ||
            (loaded.selectedCity && loaded.selectedCity !== 'ALL'
              ? [loaded.selectedCity]
              : []),
        );
        setSortBy(loaded.sortBy);
        setSortOrder(loaded.sortOrder);
        setViewMode(loaded.viewMode);
        setSearchQuery(loaded.searchQuery || '');
        setIsFilterLoaded(true);
      });
    } else {
      setIsFilterLoaded(true);
    }
    return () => {
      mounted = false;
    };
  }, []);

  // Sauvegarde automatique dès qu'un filtre, le tri, la recherche ou le mode de vue change
  useEffect(() => {
    if (!isFilterLoaded) return;
    FilterStorageService.saveFilters({
      selectedStatuses,
      selectedCities,
      selectedCity:
        selectedCities.length === 1
          ? selectedCities[0]
          : selectedCities.length > 1
          ? selectedCities.join(', ')
          : 'ALL',
      sortBy,
      sortOrder,
      viewMode,
      searchQuery,
    });
  }, [
    isFilterLoaded,
    selectedStatuses,
    selectedCities,
    sortBy,
    sortOrder,
    viewMode,
    searchQuery,
  ]);

  useEffect(() => {
    if (propRefPoint !== undefined) {
      setRefPoint(propRefPoint);
    }
  }, [propRefPoint]);

  useEffect(() => {
    void (async () => {
      if (!propRefPoint) {
        const point = await LocationService.getReferencePoint();
        if (point) {
          setRefPoint(point);
        }
      }
    })();
  }, [propRefPoint]);

  useEffect(() => {
    if (!refPoint || companies.length === 0) {
      setDistancesMap({});
      return;
    }

    // 1. Calcul instantané (0ms) pour toutes les fiches avec coordonnées existantes
    const instantMap: Record<string, number> = {};
    const unlocated: Company[] = [];

    for (const comp of companies) {
      if (
        typeof comp.latitude === 'number' &&
        typeof comp.longitude === 'number' &&
        !isNaN(comp.latitude) &&
        !isNaN(comp.longitude)
      ) {
        instantMap[comp.id] = LocationService.calculateDistanceKm(
          refPoint.latitude,
          refPoint.longitude,
          comp.latitude,
          comp.longitude,
        );
      } else {
        unlocated.push(comp);
      }
    }

    setDistancesMap(instantMap);

    // 2. Géocodage asynchrone pour les éventuelles entreprises sans coordonnées
    if (unlocated.length > 0) {
      let isMounted = true;
      void (async () => {
        const fullMap = { ...instantMap };
        await Promise.all(
          unlocated.map(async (comp) => {
            const d = await LocationService.getDistanceToCompany(comp, refPoint);
            if (d !== null) {
              fullMap[comp.id] = d;
            }
          }),
        );
        if (isMounted) {
          setDistancesMap(fullMap);
        }
      })();
    }
  }, [companies, refPoint]);

  const activeFiltersCount =
    (selectedStatuses.length > 0 ? selectedStatuses.length : 0) +
    (selectedCities.length > 0 ? selectedCities.length : 0) +
    (sortBy !== 'updatedAt' ? 1 : 0);

  const displayedCompanies = React.useMemo(() => {
    if (sortBy !== 'distance' || !refPoint) {
      return companies;
    }
    return [...companies].sort((a, b) => {
      const distA = distancesMap[a.id] ?? 999999;
      const distB = distancesMap[b.id] ?? 999999;
      return sortOrder === 'asc' ? distA - distB : distB - distA;
    });
  }, [companies, sortBy, sortOrder, distancesMap, refPoint]);

  const loadData = useCallback(async () => {
    try {
      setConnectionError(false);
      const backendSortBy = sortBy === 'distance' ? 'updatedAt' : sortBy;
      let companiesRes, statsRes, citiesRes;

      try {
        [companiesRes, statsRes, citiesRes] = await Promise.all([
          ApiService.getCompanies({
            statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
            cities: selectedCities.length > 0 ? selectedCities : undefined,
            search: searchQuery.trim() || undefined,
            sortBy: backendSortBy,
            sortOrder,
          }),
          ApiService.getCompanyStats(),
          ApiService.getCities(),
        ]);
      } catch (firstErr) {
        // Fallback automatique : si la première tentative échoue, tenter avec le dernier Tunnel URL Cloudflare
        const currentStored = await StorageService.getServerUrl();
        const fallbackTunnel = StorageService.getTunnelUrl();
        if (fallbackTunnel && currentStored !== fallbackTunnel) {
          await StorageService.setServerUrl(fallbackTunnel);
          [companiesRes, statsRes, citiesRes] = await Promise.all([
            ApiService.getCompanies({
              statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
              cities: selectedCities.length > 0 ? selectedCities : undefined,
              search: searchQuery.trim() || undefined,
              sortBy: backendSortBy,
              sortOrder,
            }),
            ApiService.getCompanyStats(),
            ApiService.getCities(),
          ]);
        } else {
          throw firstErr;
        }
      }

      setCompanies(companiesRes.items);
      setTotalCount(companiesRes.total);
      setStats(statsRes);
      setCities(citiesRes);
    } catch {
      setConnectionError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatuses, selectedCities, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshTrigger]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    } else {
      setIsSelectionMode(true);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleLongPressCard = (id: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds(new Set([id]));
    } else {
      handleToggleSelect(id);
    }
  };

  const allVisibleSelected =
    companies.length > 0 && selectedIds.size === companies.length;

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(companies.map((c) => c.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    const isAllTotal =
      allVisibleSelected &&
      companies.length === totalCount &&
      !searchQuery.trim() &&
      selectedStatuses.length === 0 &&
      selectedCities.length === 0;

    Alert.alert(
      'Suppression groupée',
      `Êtes-vous sûr de vouloir supprimer définitivement ${count} entreprise(s) ?\nCette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: `Supprimer (${count})`,
          style: 'destructive',
          onPress: async () => {
            setDeletingBatch(true);
            try {
              const res = await ApiService.deleteCompanies(
                isAllTotal ? { all: true } : { ids: Array.from(selectedIds) },
              );
              Alert.alert(
                'Suppression terminée 🗑️',
                `${res.deletedCount} entreprise(s) supprimée(s) avec succès.`,
              );
              setIsSelectionMode(false);
              setSelectedIds(new Set());
              void loadData();
            } catch (err) {
              Alert.alert(
                'Erreur',
                err instanceof Error ? err.message : 'Échec de la suppression',
              );
            } finally {
              setDeletingBatch(false);
            }
          },
        },
      ],
    );
  };

  const handleCheckReplies = async () => {
    try {
      const res = await ApiService.checkReplies();
      Alert.alert(
        'Vérification IMAP',
        `${res.messagesScanned} message(s) analysé(s).\n${res.repliesDetected} nouvelle(s) réponse(s) détectée(s).`,
      );
      void loadData();
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la relève IMAP');
    }
  };

  const toSendCount = stats ? stats.TO_SEND : 0;
  const replyReceivedCount = stats ? stats.REPLY_RECEIVED : 0;
  const toCallCount = stats ? stats.TO_CALL : 0;

  const handleSendBatch = () => {
    if (toSendCount === 0) return;

    Alert.alert(
      'Envoi groupé en 1 clic',
      `Confirmez-vous l'envoi de votre candidature et CV à ${toSendCount} entreprise(s) ?\n\n💡 Recommandation : vous pouvez tester la réception sur votre boîte personnelle avant tout envoi réel.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tester d’abord 🧪',
          onPress: () => onOpenSettings(),
        },
        {
          text: 'Envoyer',
          style: 'default',
          onPress: async () => {
            setSendingBatch(true);
            try {
              const res = await ApiService.sendInitialBatch();
              Alert.alert(
                'Envoi terminé',
                `Succès : ${res.successCount}\nÉchecs : ${res.failedCount}`,
              );
              void loadData();
            } catch (err) {
              Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de l\'envoi');
            } finally {
              setSendingBatch(false);
            }
          },
        },
      ],
    );
  };

  const handleImportSpreadsheet = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      setImporting(true);

      const res = await ApiService.importSpreadsheet(
        file.uri,
        file.name,
        (file as unknown as { file?: unknown }).file,
      );

      let title = 'Importation réussie 🎉';
      let message = `${res.importedCount} entreprise(s) importée(s) avec succès !`;

      if (res.importedCount === 0) {
        title = 'Aucune entreprise importée ⚠️';
        message =
          res.errors.length > 0
            ? res.errors.slice(0, 4).join('\n')
            : "Aucune entreprise valide n'a été détectée. Vérifiez que votre tableau contient au moins une colonne Nom et une colonne Email.";
      } else {
        if (res.skippedCount > 0) {
          message += `\n\n${res.skippedCount} ligne(s) ignorée(s) (doublons ou erreurs).`;
        }
        if (res.errors.length > 0) {
          message += `\n\nDétails :\n` + res.errors.slice(0, 3).join('\n');
          if (res.errors.length > 3) {
            message += `\n(+ ${res.errors.length - 3} autres)`;
          }
        }
      }

      Alert.alert(title, message);
      await loadData();
    } catch (err) {
      Alert.alert(
        'Erreur d’importation',
        err instanceof Error ? err.message : 'Échec de l’importation du fichier.',
      );
    } finally {
      setImporting(false);
    }
  };

  if (viewMode === 'MAP') {
    return (
      <View style={styles.container}>
        <CompanyMapView
          companies={displayedCompanies}
          totalCount={totalCount}
          stats={stats}
          selectedStatuses={selectedStatuses}
          onToggleStatus={(st) => {
            setSelectedStatuses((prev) =>
              prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
            );
          }}
          onSelectAllStatuses={() => setSelectedStatuses([])}
          searchQuery={searchQuery}
          onChangeSearchQuery={setSearchQuery}
          activeFiltersCount={activeFiltersCount}
          onOpenFiltersModal={() => setIsFiltersModalOpen(true)}
          refPoint={refPoint}
          distancesMap={distancesMap}
          onSelectCompany={onSelectCompany}
          onOpenRefPointModal={() => setIsRefPointModalOpen(true)}
        />

        {/* Modal de filtres avancés */}
        <FiltersModal
          visible={isFiltersModalOpen}
          onClose={() => setIsFiltersModalOpen(false)}
          filters={{
            statuses: selectedStatuses,
            cities: selectedCities,
            city:
              selectedCities.length === 1
                ? selectedCities[0]
                : selectedCities.length > 1
                ? selectedCities.join(', ')
                : 'ALL',
            sortBy,
            sortOrder,
          }}
          onApply={(newFilters) => {
            setSelectedStatuses(newFilters.statuses);
            setSelectedCities(newFilters.cities);
            setSortBy(newFilters.sortBy);
            setSortOrder(newFilters.sortOrder);
            FilterStorageService.saveFilters({
              selectedStatuses: newFilters.statuses,
              selectedCities: newFilters.cities,
              selectedCity: newFilters.city,
              sortBy: newFilters.sortBy,
              sortOrder: newFilters.sortOrder,
            });
          }}
          stats={stats}
          cities={cities}
          totalCount={totalCount}
        />

        {/* Modal de définition du point de repère géographique */}
        <ReferencePointModal
          visible={isRefPointModalOpen}
          onClose={() => setIsRefPointModalOpen(false)}
          currentPoint={refPoint}
          onSave={(point) => {
            setRefPoint(point);
            if (onUpdateRefPoint) {
              onUpdateRefPoint(point);
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header épuré & ultra-light */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.headerActions}>
          {toSendCount > 0 && (
            <TouchableOpacity
              style={styles.headerSendBatchBtn}
              onPress={handleSendBatch}
              disabled={sendingBatch}
              activeOpacity={0.8}
              accessibilityLabel={`Envoyer les ${toSendCount} candidatures prêtes`}
            >
              {sendingBatch ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={13} color="#FFFFFF" />
                  <Text style={styles.headerSendBatchText}>{toSendCount}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleCheckReplies}
            activeOpacity={0.7}
            accessibilityLabel="Vérifier les réponses recruteurs par email"
          >
            <Ionicons name="refresh-outline" size={20} color={Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerButton,
              isSelectionMode && styles.headerButtonActive,
            ]}
            onPress={handleToggleSelectionMode}
            activeOpacity={0.7}
            accessibilityLabel="Sélection multiple"
          >
            <Ionicons
              name={isSelectionMode ? 'checkmark-circle' : 'checkbox-outline'}
              size={20}
              color={isSelectionMode ? Colors.primary : Colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barre de recherche avec bouton Filtres */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une entreprise, une ville..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFiltersCount > 0 && styles.filterButtonActive,
          ]}
          onPress={() => setIsFiltersModalOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFiltersCount > 0 ? '#FFFFFF' : Colors.text}
          />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Bannière d'alerte prioritaire : Réponses de recruteurs reçues */}
      {replyReceivedCount > 0 && (
        <TouchableOpacity
          style={styles.priorityBannerReply}
          onPress={() => {
            setSelectedStatuses(['REPLY_RECEIVED']);
            handleSetViewMode('LIST');
          }}
          activeOpacity={0.8}
        >
          <View style={styles.priorityBannerIconWrapper}>
            <Ionicons name="sparkles" size={18} color="#0B0F19" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.priorityBannerTitle}>
              {replyReceivedCount} réponse{replyReceivedCount > 1 ? 's' : ''} de recruteur reçue{replyReceivedCount > 1 ? 's' : ''} !
            </Text>
            <Text style={styles.priorityBannerSubtitle}>
              Action immédiate requise : ouvrir pour accepter ou refuser
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.status.REPLY_RECEIVED} />
        </TouchableOpacity>
      )}

      {/* Bannière d'alerte prioritaire : Entreprises à appeler à J+15 */}
      {toCallCount > 0 && replyReceivedCount === 0 && (
        <TouchableOpacity
          style={styles.priorityBannerCall}
          onPress={() => {
            setSelectedStatuses(['TO_CALL']);
            handleSetViewMode('LIST');
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.priorityBannerIconWrapper, { backgroundColor: Colors.status.TO_CALL }]}>
            <Ionicons name="call" size={16} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.priorityBannerTitleCall}>
              {toCallCount} entreprise{toCallCount > 1 ? 's' : ''} à appeler (J+15)
            </Text>
            <Text style={styles.priorityBannerSubtitle}>
              Relance téléphonique directe en 1 clic recommandée
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.status.TO_CALL} />
        </TouchableOpacity>
      )}

      {/* Barre de statuts KPIs interactive avec compteurs en temps réel */}
      <FilterTabs
        selectedStatuses={selectedStatuses}
        onToggleStatus={(status) => {
          setSelectedStatuses((prev) =>
            prev.includes(status)
              ? prev.filter((s) => s !== status)
              : [status]
          );
        }}
        onSelectAll={() => setSelectedStatuses([])}
        stats={stats}
        totalCount={totalCount}
      />

      {/* Point de repère ultra-discret (affiché uniquement si configuré) */}
      {refPoint && (
        <TouchableOpacity
          style={styles.refPointSlimRow}
          onPress={() => setIsRefPointModalOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={refPoint.isGps ? 'navigate' : 'location-sharp'}
            size={12}
            color={Colors.accent}
          />
          <Text style={styles.refPointSlimText} numberOfLines={1}>
            Distances depuis <Text style={{ color: Colors.text, fontWeight: '600' }}>{refPoint.label}</Text>
          </Text>
          <Ionicons name="pencil" size={11} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Puces de filtres actifs avec suppression rapide */}
      {activeFiltersCount > 0 && (
        <View style={styles.activeFiltersRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFiltersScroll}
          >
            {selectedStatuses.map((st) => (
              <TouchableOpacity
                key={st}
                style={[
                  styles.activeFilterChip,
                  {
                    backgroundColor: `${Colors.status[st]}20`,
                    borderColor: Colors.status[st],
                  },
                ]}
                onPress={() =>
                  setSelectedStatuses((prev) => prev.filter((s) => s !== st))
                }
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.activeFilterDot,
                    { backgroundColor: Colors.status[st] },
                  ]}
                />
                <Text style={styles.activeFilterText}>
                  {STATUS_LABELS[st]}
                </Text>
                <Ionicons name="close" size={14} color={Colors.textSecondary} />
              </TouchableOpacity>
            ))}

            {selectedCities.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.activeFilterChip, styles.activeFilterChipCity]}
                onPress={() => setSelectedCities((prev) => prev.filter((item) => item !== c))}
                activeOpacity={0.7}
              >
                <Ionicons name="location-sharp" size={12} color={Colors.accent} />
                <Text style={[styles.activeFilterText, { color: Colors.accent }]}>
                  {c}
                </Text>
                <Ionicons name="close" size={14} color={Colors.accent} />
              </TouchableOpacity>
            ))}

            {sortBy !== 'updatedAt' && (
              <TouchableOpacity
                style={[styles.activeFilterChip, styles.activeFilterChipSort]}
                onPress={() => {
                  setSortBy('updatedAt');
                  setSortOrder('desc');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="swap-vertical" size={12} color={Colors.brandGreen} />
                <Text style={[styles.activeFilterText, { color: Colors.brandGreen }]}>
                  Tri: {sortBy === 'name' ? 'Nom A-Z' : 'Ville A-Z'}
                </Text>
                <Ionicons name="close" size={14} color={Colors.brandGreen} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.clearAllFiltersBtn}
              onPress={() => {
                setSelectedStatuses([]);
                setSelectedCities([]);
                setSortBy('updatedAt');
                setSortOrder('desc');
                FilterStorageService.saveFilters({
                  selectedStatuses: [],
                  selectedCities: [],
                  selectedCity: 'ALL',
                  sortBy: 'updatedAt',
                  sortOrder: 'desc',
                });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.clearAllFiltersText}>Effacer tout</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Bannière de connexion si le serveur est inaccessible */}
      {connectionError && (
        <View style={styles.connectionErrorBanner}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="cloud-offline-outline" size={18} color="#FF6B6B" />
            <Text style={styles.connectionErrorText}>
              Connexion au serveur perdue
            </Text>
          </View>
          <TouchableOpacity
            style={styles.reconnectBtn}
            onPress={async () => {
              setRefreshing(true);
              const tunnel = StorageService.getTunnelUrl();
              if (tunnel) {
                await StorageService.setServerUrl(tunnel);
              }
              await loadData();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={13} color="#FFFFFF" />
            <Text style={styles.reconnectBtnText}>Reconnecter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Page / Modal dédiée regroupant tous les filtres */}
      <FiltersModal
        visible={isFiltersModalOpen}
        onClose={() => setIsFiltersModalOpen(false)}
        filters={{
          statuses: selectedStatuses,
          cities: selectedCities,
          city:
            selectedCities.length === 1
              ? selectedCities[0]
              : selectedCities.length > 1
              ? selectedCities.join(', ')
              : 'ALL',
          sortBy,
          sortOrder,
        }}
        onApply={(newFilters) => {
          setSelectedStatuses(newFilters.statuses);
          setSelectedCities(newFilters.cities);
          setSortBy(newFilters.sortBy);
          setSortOrder(newFilters.sortOrder);
          FilterStorageService.saveFilters({
            selectedStatuses: newFilters.statuses,
            selectedCities: newFilters.cities,
            selectedCity: newFilters.city,
            sortBy: newFilters.sortBy,
            sortOrder: newFilters.sortOrder,
          });
        }}
        stats={stats}
        cities={cities}
        totalCount={totalCount}
      />

      {/* Modal de définition du point de repère géographique */}
      <ReferencePointModal
        visible={isRefPointModalOpen}
        onClose={() => setIsRefPointModalOpen(false)}
        currentPoint={refPoint}
        onSave={(point) => {
          setRefPoint(point);
          if (onUpdateRefPoint) {
            onUpdateRefPoint(point);
          }
        }}
      />

      {/* Affichage de la Liste des candidatures */}
      {/* Barre d'outils du mode sélection */}
          {isSelectionMode ? (
            <View style={styles.selectionBar}>
              <View style={styles.selectionBarTopRow}>
                <TouchableOpacity
                  style={styles.selectAllBtn}
                  onPress={handleToggleSelectAll}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={allVisibleSelected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={Colors.primary}
                  />
                  <Text style={styles.selectAllText}>
                    {allVisibleSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.selectionCountPill}>
                  <Text style={styles.selectionCountPillText}>
                    {selectedIds.size} / {companies.length}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.cancelSelectionBtn}
                  onPress={() => {
                    setIsSelectionMode(false);
                    setSelectedIds(new Set());
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={15} color={Colors.textSecondary} />
                  <Text style={styles.cancelSelectionText}>Fermer</Text>
                </TouchableOpacity>
              </View>

              {selectedIds.size > 0 ? (
                <TouchableOpacity
                  style={[
                    styles.deleteBatchBtnFull,
                    deletingBatch && styles.buttonDisabled,
                  ]}
                  onPress={handleDeleteSelected}
                  disabled={deletingBatch}
                  activeOpacity={0.85}
                >
                  {deletingBatch ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="trash" size={16} color="#FFFFFF" />
                      <Text style={styles.deleteBatchBtnFullText}>
                        Supprimer {selectedIds.size} entreprise{selectedIds.size > 1 ? 's' : ''}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <Text style={styles.selectionHintText}>
                  Touchez une fiche pour la sélectionner
                </Text>
              )}
            </View>
          ) : (
            companies.length > 0 && (
              <View style={styles.listHeaderBar}>
                <Text style={styles.listHeaderCount}>
                  {companies.length} fiche{companies.length > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={styles.selectModeTriggerBtn}
                  onPress={handleToggleSelectionMode}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkbox-outline" size={15} color={Colors.primary} />
                  <Text style={styles.selectModeTriggerText}>Sélectionner / Supprimer</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {/* Liste des entreprises */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Chargement des fiches...</Text>
            </View>
          ) : (
            <FlatList
              data={displayedCompanies}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <CompanyCard
                  company={item}
                  onPress={() => onSelectCompany(item)}
                  selectable={isSelectionMode}
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={() => handleToggleSelect(item.id)}
                  onLongPress={() => handleLongPressCard(item.id)}
                  distanceKm={distancesMap[item.id]}
                />
              )}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={Colors.primary}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="briefcase-outline" size={48} color={Colors.border} />
                  <Text style={styles.emptyTitle}>Aucune entreprise trouvée</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery || selectedCities.length > 0 || selectedStatuses.length > 0
                      ? 'Aucun résultat ne correspond aux filtres appliqués.'
                      : 'Ajoutez une entreprise avec le bouton "+" ou importez directement votre tableur.'}
                  </Text>
                  {!searchQuery && selectedCities.length === 0 && selectedStatuses.length === 0 && (
                    <TouchableOpacity
                      style={styles.emptyImportButton}
                      onPress={handleImportSpreadsheet}
                      disabled={importing}
                    >
                      <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyImportText}>Importer un tableur (Excel / CSV)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          )}

      {/* Barre d'action flottante de suppression en mode sélection */}
      {isSelectionMode && selectedIds.size > 0 && (
        <View style={styles.bottomDeleteContainer}>
          <TouchableOpacity
            style={[styles.bottomDeleteButton, deletingBatch && styles.buttonDisabled]}
            onPress={handleDeleteSelected}
            disabled={deletingBatch}
            activeOpacity={0.85}
          >
            {deletingBatch ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="trash" size={18} color="#FFFFFF" />
                <Text style={styles.bottomDeleteText}>
                  Supprimer les {selectedIds.size} entreprise{selectedIds.size > 1 ? 's' : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Suppression du fabContainer encombrant : navigation directe via MainTabBar en bas */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerBrand: {
    justifyContent: 'center',
    flexShrink: 1,
  },
  logoImage: {
    width: 145,
    height: 38,
    alignSelf: 'flex-start',
  },
  appSubtitle: {
    fontSize: 10.5,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSendBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 19,
  },
  headerSendBatchText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  refPointSlimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 3,
    marginBottom: 4,
    gap: 6,
  },
  refPointSlimText: {
    color: Colors.textMuted,
    fontSize: 11,
    flex: 1,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.accent,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  filterBadgeText: {
    color: '#0B0F19',
    fontSize: 10,
    fontWeight: '800',
  },
  activeFiltersRow: {
    marginTop: 8,
  },
  activeFiltersScroll: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}20`,
    borderColor: Colors.primary,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterChipCity: {
    backgroundColor: `${Colors.accent}20`,
    borderColor: Colors.accent,
  },
  activeFilterChipSort: {
    backgroundColor: `${Colors.brandGreen}20`,
    borderColor: Colors.brandGreen,
  },
  activeFilterDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  activeFilterText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  clearAllFiltersBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  clearAllFiltersText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    padding: 0,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    left: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  batchFab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  batchFabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  fabRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 'auto',
  },
  importFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: `${Colors.primary}80`,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  addFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brandBlue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 14,
    gap: 8,
  },
  emptyImportText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  headerButtonActive: {
    backgroundColor: `${Colors.primary}30`,
    borderColor: Colors.primary,
  },
  selectionBar: {
    backgroundColor: '#1E1B38',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${Colors.primary}60`,
    gap: 10,
  },
  selectionBarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  selectAllText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  selectionCountPill: {
    backgroundColor: `${Colors.primary}25`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  selectionCountPillText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  cancelSelectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: `${Colors.textSecondary}25`,
    gap: 4,
  },
  cancelSelectionText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBatchBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteBatchBtnFullText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  selectionHintText: {
    color: Colors.textMuted,
    fontSize: 11.5,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bottomDeleteContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  bottomDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    gap: 10,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  listHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  listHeaderCount: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  selectModeTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}18`,
    borderWidth: 1,
    borderColor: `${Colors.primary}45`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  selectModeTriggerText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  refPointBar: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  refPointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  refPointButtonActive: {
    backgroundColor: `${Colors.accent}12`,
    borderColor: `${Colors.accent}55`,
  },
  refPointText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    fontWeight: '500',
  },
  refPointTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  viewModeSegment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 9,
    gap: 6,
  },
  viewModeTabActive: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  viewModeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  viewModeTabTextActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  connectionErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    borderWidth: 1,
    borderColor: '#FF5252',
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  connectionErrorText: {
    color: '#FFD2D2',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  reconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  reconnectBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  priorityBannerReply: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.status.REPLY_RECEIVED}20`,
    borderWidth: 1.5,
    borderColor: Colors.status.REPLY_RECEIVED,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  priorityBannerCall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.status.TO_CALL}20`,
    borderWidth: 1.5,
    borderColor: Colors.status.TO_CALL,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  priorityBannerIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.status.REPLY_RECEIVED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityBannerTitle: {
    color: Colors.status.REPLY_RECEIVED,
    fontSize: 13,
    fontWeight: '800',
  },
  priorityBannerTitleCall: {
    color: Colors.status.TO_CALL,
    fontSize: 13,
    fontWeight: '800',
  },
  priorityBannerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  batchSendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${Colors.primary}20`,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  batchSendBarText: {
    color: Colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  batchSendBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  batchSendBarButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

