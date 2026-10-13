import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>AlterTrack</Text>
          <Text style={styles.appSubtitle}>Suivi automatisé de candidatures</Text>
        </View>
        <View style={styles.headerActions}>
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
          placeholder="Rechercher une entreprise..."
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
            <CompanyCard company={item} onPress={() => onSelectCompany(item)} />
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
                  : 'Ajoutez une entreprise avec le bouton "+" pour démarrer.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Boutons d'actions flottants (FAB) */}
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

        <TouchableOpacity
          style={styles.addFab}
          onPress={onOpenAddCompany}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
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
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
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
  addFab: {
    marginLeft: 'auto',
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
  buttonDisabled: {
    opacity: 0.6,
  },
});
