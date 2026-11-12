import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
} from 'react-native';
import { CompanyCard } from '../components/CompanyCard';
import { CompanyMapView } from '../components/CompanyMapView';
import { FiltersModal } from '../components/FiltersModal';
import { ReferencePointModal } from '../components/ReferencePointModal';
import { CityItem } from '../components/CityFilterBar';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { AlertService as Alert } from '../services/alert.service';
import { ApiService } from '../services/api.service';
import { FilterStorageService } from '../services/filterStorage.service';
import { StorageService } from '../services/storage.service';
import { LocationService, ReferencePoint } from '../services/location.service';
import { Company, CompanyStats, STATUS_LABELS, Status } from '../types/company';

interface HomeScreenProps {
  navigation: any;
  stats?: {
    total: number;
    interview: number;
    offer: number;
    rejected: number;
  };
  companies?: Array<{
    id: string;
    name: string;
    position: string;
    status: 'applied' | 'interview' | 'offer' | 'rejected';
    city?: string;
    updatedAt: string;
  }>;
}

export default function HomeScreen({ navigation, stats, companies = [] }: HomeScreenProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'interview':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', label: 'Entretien', icon: 'calendar-outline' };
      case 'offer':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', label: 'Offre', icon: 'checkmark-circle-outline' };
      case 'rejected':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', label: 'Refusé', icon: 'close-circle-outline' };
      default:
        return { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366F1', label: 'Postulé', icon: 'send-outline' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      
      {/* En-tête du Dashboard */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingSubtitle}>Suivi d'alternance</Text>
          <Text style={styles.greetingTitle}>AlterTrack 🚀</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={20} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Grille des Statistiques */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: '#6366F1' }]}>
            <Text style={styles.statNumber}>{stats?.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.statNumber}>{stats?.interview || 0}</Text>
            <Text style={styles.statLabel}>Entretiens</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#10B981' }]}>
            <Text style={styles.statNumber}>{stats?.offer || 0}</Text>
            <Text style={styles.statLabel}>Offres</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.status.TO_CALL} />
        </TouchableOpacity>
      )}
      

        {/* Bouton d'Action Principal */}
        <TouchableOpacity 
          style={styles.primaryActionButton}
          onPress={() => navigation.navigate('AddCompany')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.primaryActionText}>Ajouter une entreprise / candidature</Text>
        </TouchableOpacity>

        {/* Section Liste */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes candidatures récentes</Text>
          <Text style={styles.counterBadge}>{companies.length}</Text>
        </View>

        {companies.length > 0 ? (
          companies.map((item) => {
            const badge = getStatusBadge(item.status);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.companyCard}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('CompanyDetail', { id: item.id })}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.companyName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.positionTitle} numberOfLines={1}>{item.position}</Text>
                    {item.city && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={12} color="#64748B" style={{ marginRight: 4 }} />
                        <Text style={styles.locationText}>{item.city}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Ionicons name={badge.icon as any} size={13} color={badge.text} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="folder-open-outline" size={52} color="#475569" />
            <Text style={styles.emptyTitle}>Aucune candidature enregistrée</Text>
            <Text style={styles.emptySubtitle}>Commencez à centraliser vos recherches d'alternance dès maintenant.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  primaryActionButton: {
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 24,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  counterBadge: {
    backgroundColor: '#1E293B',
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  companyCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  positionTitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 45,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 4,
  },
});