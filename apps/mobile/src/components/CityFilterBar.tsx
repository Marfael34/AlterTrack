import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';

export interface CityItem {
  city: string;
  count: number;
}

interface CityFilterBarProps {
  cities: CityItem[];
  selectedCity: string | 'ALL';
  onSelectCity: (city: string | 'ALL') => void;
  totalCount?: number;
}

export const CityFilterBar: React.FC<CityFilterBarProps> = ({
  cities,
  selectedCity,
  onSelectCity,
  totalCount = 0,
}) => {
  if (!cities || cities.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.labelContainer}>
          <Ionicons name="location-sharp" size={13} color={Colors.accent} />
          <Text style={styles.sectionLabel}>Villes</Text>
        </View>

        {selectedCity !== 'ALL' && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => onSelectCity('ALL')}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={13} color={Colors.textSecondary} />
            <Text style={styles.clearBtnText}>Réinitialiser</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Puce "Toutes" */}
        <TouchableOpacity
          style={[styles.chip, selectedCity === 'ALL' && styles.chipActive]}
          onPress={() => onSelectCity('ALL')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.chipText,
              selectedCity === 'ALL' && styles.chipTextActive,
            ]}
          >
            Toutes
          </Text>
          {totalCount > 0 && (
            <View
              style={[
                styles.badge,
                selectedCity === 'ALL' && styles.badgeActive,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  selectedCity === 'ALL' && styles.badgeTextActive,
                ]}
              >
                {totalCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Puces des villes individuelles */}
        {cities.map((item) => {
          const isSelected = selectedCity.toLowerCase() === item.city.toLowerCase();

          return (
            <TouchableOpacity
              key={item.city}
              style={[
                styles.chip,
                isSelected && styles.chipActiveCity,
              ]}
              onPress={() => onSelectCity(isSelected ? 'ALL' : item.city)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextActiveCity,
                ]}
                numberOfLines={1}
              >
                {item.city}
              </Text>
              <View
                style={[
                  styles.badge,
                  isSelected && styles.badgeActiveCity,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isSelected && styles.badgeTextActiveCity,
                  ]}
                >
                  {item.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: Colors.surface,
  },
  clearBtnText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 20,
    gap: 6,
  },
  chipActive: {
    backgroundColor: `${Colors.primary}25`,
    borderColor: Colors.primary,
  },
  chipActiveCity: {
    backgroundColor: `${Colors.accent}25`,
    borderColor: Colors.accent,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chipTextActiveCity: {
    color: Colors.accent,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: Colors.primary,
  },
  badgeActiveCity: {
    backgroundColor: Colors.accent,
  },
  badgeText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
  badgeTextActiveCity: {
    color: '#0B0F19',
  },
});
