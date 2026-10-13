import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CompanyCard } from '../components/CompanyCard';
import { FilterTabs } from '../components/FilterTabs';
import { Colors } from '../constants/colors';
import { ApiService } from '../services/api.service';
import { Company, CompanyStats, Status } from '../types/company';

interface HomeScreenProps {
  onSelectCompany: (company: Company) => void;
  onOpenSettings: () => void;
  onOpenAddCompany: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectCompany,
  onOpenSettings,
  onOpenAddCompany,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<CompanyStats | undefined>(undefined);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedStatus, setSelectedStatus] = useState<Status | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sendingBatch, setSendingBatch] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingBatch, setDeletingBatch] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [companiesRes, statsRes] = await Promise.all([
        ApiService.getCompanies({
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          search: searchQuery.trim() || undefined,
        }),
        ApiService.getCompanyStats(),
      ]);

      setCompanies(companiesRes.items);
      setTotalCount(companiesRes.total);
      setStats(statsRes);
    } catch (error) {
      // Évite les alertes intempestives en cas de premier lancement hors-ligne
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, searchQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      selectedStatus === 'ALL';

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

  const handleSendBatch = () => {
    if (toSendCount === 0) return;

    Alert.alert(
      'Envoi groupé en 1 clic',
      `Confirmez-vous l'envoi personnalisé de votre candidature et CV à ${toSendCount} entreprise(s) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.appSubtitle}>Suivi automatisé de candidatures</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              isSelectionMode && styles.headerButtonActive,
            ]}
            onPress={handleToggleSelectionMode}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSelectionMode ? 'checkmark-circle' : 'checkbox-outline'}
              size={20}
              color={isSelectionMode ? Colors.primary : Colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleImportSpreadsheet}
            disabled={importing}
            activeOpacity={0.7}
          >
            {importing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="document-attach-outline" size={20} color={Colors.text} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleCheckReplies}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onOpenSettings}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barre de recherche */}
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

      {/* Onglets de filtrage par statut */}
      <FilterTabs
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
        stats={stats}
        totalCount={totalCount}
      />

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
          data={companies}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CompanyCard
              company={item}
              onPress={() => onSelectCompany(item)}
              selectable={isSelectionMode}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => handleToggleSelect(item.id)}
              onLongPress={() => handleLongPressCard(item.id)}
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
                {searchQuery
                  ? 'Aucun résultat ne correspond à votre recherche.'
                  : 'Ajoutez une entreprise avec le bouton "+" ou importez directement votre tableur.'}
              </Text>
              {!searchQuery && (
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

      {/* Boutons d'actions flottants (FAB) */}
      {!isSelectionMode && (
        <View style={styles.fabContainer}>
          {toSendCount > 0 && (
            <TouchableOpacity
              style={[styles.batchFab, sendingBatch && styles.buttonDisabled]}
              onPress={handleSendBatch}
              disabled={sendingBatch}
              activeOpacity={0.8}
            >
              {sendingBatch ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                  <Text style={styles.batchFabText}>Envoyer ({toSendCount})</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.fabRightGroup}>
            <TouchableOpacity
              style={styles.importFab}
              onPress={handleImportSpreadsheet}
              disabled={importing}
              activeOpacity={0.8}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="document-text-outline" size={22} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addFab}
              onPress={onOpenAddCompany}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    gap: 8,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
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
});
