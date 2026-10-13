import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { CompanyStats, STATUS_LABELS, Status } from '../types/company';
import { CityItem } from './CityFilterBar';

export interface FilterState {
  statuses: Status[];
  city: string | 'ALL';
  sortBy: 'updatedAt' | 'name' | 'city';
  sortOrder: 'asc' | 'desc';
}

interface FiltersModalProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (newFilters: FilterState) => void;
  stats?: CompanyStats;
  cities: CityItem[];
  totalCount: number;
}

const ALL_STATUSES: Status[] = [
  'TO_SEND',
  'WAITING_FOR_REPLY',
  'TO_FOLLOW_UP',
  'TO_CALL',
  'REPLY_RECEIVED',
  'ACCEPTED',
  'REFUSED',
];

export const FiltersModal: React.FC<FiltersModalProps> = ({
  visible,
  onClose,
  filters: initialFilters,
  onApply,
  stats,
  cities,
  totalCount,
}) => {
  const [draftStatuses, setDraftStatuses] = useState<Status[]>(
    initialFilters.statuses || [],
  );
  const [draftCity, setDraftCity] = useState<string | 'ALL'>(initialFilters.city);
  const [draftSortBy, setDraftSortBy] = useState<'updatedAt' | 'name' | 'city'>(
    initialFilters.sortBy,
  );
  const [draftSortOrder, setDraftSortOrder] = useState<'asc' | 'desc'>(
    initialFilters.sortOrder,
  );

  // Synchroniser à l'ouverture
  React.useEffect(() => {
    if (visible) {
      setDraftStatuses(initialFilters.statuses || []);
      setDraftCity(initialFilters.city);
      setDraftSortBy(initialFilters.sortBy);
      setDraftSortOrder(initialFilters.sortOrder);
    }
  }, [visible, initialFilters]);

  const handleToggleStatus = (st: Status) => {
    setDraftStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st],
    );
  };

  const handleReset = () => {
    setDraftStatuses([]);
    setDraftCity('ALL');
    setDraftSortBy('updatedAt');
    setDraftSortOrder('desc');
  };

  const handleApply = () => {
    onApply({
      statuses: draftStatuses,
      city: draftCity,
      sortBy: draftSortBy,
      sortOrder: draftSortOrder,
    });
    onClose();
  };

  const activeFiltersCount =
    (draftStatuses.length > 0 ? draftStatuses.length : 0) +
    (draftCity !== 'ALL' ? 1 : 0) +
    (draftSortBy !== 'updatedAt' ? 1 : 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Filtres & Tri</Text>
            <Text style={styles.headerSubtitle}>Toutes les options réunies sur une page</Text>
          </View>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Text style={styles.resetBtnText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1 : Statuts (Multi-sélection) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="flag-outline" size={16} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Statuts de candidature</Text>
              </View>
              <View style={styles.sectionHeaderRight}>
                {draftStatuses.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setDraftStatuses([])}
                    style={styles.clearMiniBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearMiniBtnText}>Tous</Text>
                  </TouchableOpacity>
                ) : null}
                <Text
                  style={
                    draftStatuses.length > 0
                      ? styles.sectionActiveBadge
                      : styles.sectionMutedBadge
                  }
                >
                  {draftStatuses.length > 0
                    ? `${draftStatuses.length} sélectionné${draftStatuses.length > 1 ? 's' : ''}`
                    : 'Tous'}
                </Text>
              </View>
            </View>

            <View style={styles.chipsGrid}>
              {/* Option Tous les statuts */}
              <TouchableOpacity
                style={[
                  styles.statusChip,
                  draftStatuses.length === 0 && styles.statusChipActiveAll,
                ]}
                onPress={() => setDraftStatuses([])}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    draftStatuses.length === 0
                      ? 'checkmark-circle'
                      : 'ellipse-outline'
                  }
                  size={15}
                  color={
                    draftStatuses.length === 0 ? Colors.primary : Colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.chipLabel,
                    draftStatuses.length === 0 && styles.chipLabelActive,
                  ]}
                >
                  Tous les statuts
                </Text>
                <View
                  style={[
                    styles.countPill,
                    draftStatuses.length === 0 && styles.countPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.countPillText,
                      draftStatuses.length === 0 && styles.countPillTextActive,
                    ]}
                  >
                    {totalCount}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Statuts individuels multi-sélectionnables */}
              {ALL_STATUSES.map((st) => {
                const isSelected = draftStatuses.includes(st);
                const count = stats ? stats[st] || 0 : 0;
                const color = Colors.status[st];

                return (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.statusChip,
                      isSelected && {
                        backgroundColor: `${color}25`,
                        borderColor: color,
                      },
                    ]}
                    onPress={() => handleToggleStatus(st)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={16}
                      color={isSelected ? color : Colors.textMuted}
                    />
                    <View style={[styles.statusDot, { backgroundColor: color }]} />
                    <Text
                      style={[
                        styles.chipLabel,
                        isSelected && { color: color, fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {STATUS_LABELS[st]}
                    </Text>
                    {count > 0 && (
                      <View
                        style={[
                          styles.countPill,
                          isSelected && { backgroundColor: color },
                        ]}
                      >
                        <Text
                          style={[
                            styles.countPillText,
                            isSelected && { color: '#FFFFFF' },
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 2 : Villes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="location-outline" size={16} color={Colors.accent} />
                <Text style={styles.sectionTitle}>Localisation / Ville</Text>
              </View>
              {draftCity !== 'ALL' && (
                <Text style={styles.sectionActiveBadgeCity}>{draftCity}</Text>
              )}
            </View>

            <View style={styles.chipsGrid}>
              <TouchableOpacity
                style={[
                  styles.cityChip,
                  draftCity === 'ALL' && styles.cityChipActiveAll,
                ]}
                onPress={() => setDraftCity('ALL')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    draftCity === 'ALL' && styles.chipLabelActive,
                  ]}
                >
                  Toutes les villes
                </Text>
              </TouchableOpacity>

              {cities.map((c) => {
                const isSelected = draftCity.toLowerCase() === c.city.toLowerCase();

                return (
                  <TouchableOpacity
                    key={c.city}
                    style={[
                      styles.cityChip,
                      isSelected && styles.cityChipActive,
                    ]}
                    onPress={() => setDraftCity(isSelected ? 'ALL' : c.city)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="location-sharp"
                      size={12}
                      color={isSelected ? Colors.accent : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.chipLabel,
                        isSelected && styles.cityChipLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {c.city}
                    </Text>
                    <View
                      style={[
                        styles.countPill,
                        isSelected && styles.cityCountPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.countPillText,
                          isSelected && styles.cityCountPillTextActive,
                        ]}
                      >
                        {c.count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 3 : Tri */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="swap-vertical-outline" size={16} color={Colors.brandGreen} />
                <Text style={styles.sectionTitle}>Ordre d'affichage</Text>
              </View>
            </View>

            <View style={styles.sortList}>
              {[
                {
                  id: 'updatedAt',
                  label: 'Dernière modification (Plus récentes d’abord)',
                  icon: 'time-outline',
                  order: 'desc' as const,
                },
                {
                  id: 'name',
                  label: 'Nom de l’entreprise (A → Z)',
                  icon: 'business-outline',
                  order: 'asc' as const,
                },
                {
                  id: 'city',
                  label: 'Ville (A → Z)',
                  icon: 'map-outline',
                  order: 'asc' as const,
                },
              ].map((opt) => {
                const isSelected = draftSortBy === opt.id;

                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.sortOption,
                      isSelected && styles.sortOptionActive,
                    ]}
                    onPress={() => {
                      setDraftSortBy(opt.id as 'updatedAt' | 'name' | 'city');
                      setDraftSortOrder(opt.order);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sortOptionLeft}>
                      <Ionicons
                        name={opt.icon as any}
                        size={16}
                        color={isSelected ? Colors.brandGreen : Colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.sortOptionLabel,
                          isSelected && styles.sortOptionLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? Colors.brandGreen : Colors.borderLight}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Footer avec Bouton d'application */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApply}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
            <Text style={styles.applyButtonText}>
              Appliquer les filtres
              {activeFiltersCount > 0 ? ` (${activeFiltersCount} actif${activeFiltersCount > 1 ? 's' : ''})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  resetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  resetBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 20,
    paddingBottom: 30,
  },
  section: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearMiniBtnText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionActiveBadge: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionMutedBadge: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionActiveBadgeCity: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusChipActiveAll: {
    backgroundColor: `${Colors.primary}25`,
    borderColor: Colors.primary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cityChipActiveAll: {
    backgroundColor: `${Colors.primary}25`,
    borderColor: Colors.primary,
  },
  cityChipActive: {
    backgroundColor: `${Colors.accent}25`,
    borderColor: Colors.accent,
  },
  chipLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  chipLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  cityChipLabelActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  countPill: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countPillActive: {
    backgroundColor: Colors.primary,
  },
  cityCountPillActive: {
    backgroundColor: Colors.accent,
  },
  countPillText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  countPillTextActive: {
    color: '#FFFFFF',
  },
  cityCountPillTextActive: {
    color: '#0B0F19',
  },
  sortList: {
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortOptionActive: {
    backgroundColor: `${Colors.brandGreen}15`,
    borderColor: Colors.brandGreen,
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sortOptionLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  sortOptionLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
