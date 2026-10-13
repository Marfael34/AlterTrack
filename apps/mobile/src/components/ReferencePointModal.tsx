import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { GeocodeResult, LocationService, ReferencePoint } from '../services/location.service';

interface ReferencePointModalProps {
  visible: boolean;
  onClose: () => void;
  currentPoint: ReferencePoint | null;
  onSave: (point: ReferencePoint | null) => void;
}

export const ReferencePointModal: React.FC<ReferencePointModalProps> = ({
  visible,
  onClose,
  currentPoint,
  onSave,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [visible]);

  // Recherche d'adresses en temps réel avec debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await LocationService.searchAddress(q);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleUseGps = async () => {
    setLocatingGps(true);
    try {
      const gpsPoint = await LocationService.getCurrentGpsLocation();
      await LocationService.setReferencePoint(gpsPoint);
      onSave(gpsPoint);
      onClose();
      Alert.alert('Position GPS définie 🎯', `Point de repère actif : ${gpsPoint.label}`);
    } catch (err) {
      Alert.alert(
        'Erreur GPS',
        err instanceof Error ? err.message : 'Impossible de récupérer votre position GPS.',
      );
    } finally {
      setLocatingGps(false);
    }
  };

  const handleSelectResult = async (item: GeocodeResult) => {
    const newPoint: ReferencePoint = {
      label: item.label,
      latitude: item.latitude,
      longitude: item.longitude,
      isGps: false,
    };
    await LocationService.setReferencePoint(newPoint);
    onSave(newPoint);
    onClose();
  };

  const handleClear = async () => {
    await LocationService.setReferencePoint(null);
    onSave(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Ionicons name="compass" size={22} color={Colors.accent} />
                <Text style={styles.title}>Point de référence & Distance</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>
              Définissez votre domicile ou école pour afficher la distance en km vers chaque entreprise.
            </Text>

            {/* Point de repère actuellement actif */}
            {currentPoint && (
              <View style={styles.activePointCard}>
                <View style={styles.activePointHeader}>
                  <Ionicons
                    name={currentPoint.isGps ? 'navigate' : 'home'}
                    size={18}
                    color={Colors.primary}
                  />
                  <Text style={styles.activePointTitle} numberOfLines={1}>
                    {currentPoint.label}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={handleClear}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearBtnText}>Désactiver</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bouton GPS */}
            <TouchableOpacity
              style={[styles.gpsButton, locatingGps && styles.buttonDisabled]}
              onPress={handleUseGps}
              disabled={locatingGps}
              activeOpacity={0.8}
            >
              {locatingGps ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="locate" size={18} color="#FFFFFF" />
                  <Text style={styles.gpsButtonText}>
                    Utiliser ma position GPS actuelle
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou recherchez une ville / adresse</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Champ de recherche */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Ex: Montpellier, 10 rue de la Paix Paris..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
              {searching ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : searchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Résultats de recherche */}
            <ScrollView
              style={styles.resultsList}
              contentContainerStyle={styles.resultsListContent}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.map((item, idx) => (
                <TouchableOpacity
                  key={`${item.label}-${idx}`}
                  style={styles.resultItem}
                  onPress={() => handleSelectResult(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location-outline" size={18} color={Colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {item.city && (
                      <Text style={styles.resultCity}>
                        {item.postcode ? `${item.postcode} ` : ''}{item.city}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}

              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <Text style={styles.noResultsText}>
                  Aucune adresse trouvée pour "{searchQuery}".
                </Text>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  subtitle: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  activePointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${Colors.primary}18`,
    borderColor: Colors.primary,
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  activePointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  activePointTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surface,
  },
  clearBtnText: {
    color: Colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    gap: 8,
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  gpsButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 13.5,
    padding: 0,
  },
  resultsList: {
    maxHeight: 220,
  },
  resultsListContent: {
    gap: 6,
    paddingBottom: 10,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  resultLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  resultCity: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  noResultsText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
    fontStyle: 'italic',
  },
});
