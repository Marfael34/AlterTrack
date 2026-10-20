import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
import { AlertService as Alert } from '../services/alert.service';
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

  // Recherche d'adresses en direct avec autocomplétion
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
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectResult = async (item: GeocodeResult) => {
    Keyboard.dismiss();
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

  const handleSubmitSearch = async () => {
    if (searchResults.length > 0) {
      await handleSelectResult(searchResults[0]);
      return;
    }

    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    try {
      const coords = await LocationService.geocodeQuery(q);
      if (coords) {
        Keyboard.dismiss();
        const newPoint: ReferencePoint = {
          label: q,
          latitude: coords.latitude,
          longitude: coords.longitude,
          isGps: false,
        };
        await LocationService.setReferencePoint(newPoint);
        onSave(newPoint);
        onClose();
      } else {
        Alert.alert('Adresse introuvable', "Impossible de localiser cette adresse. Essayez avec un nom de ville ou un numéro et nom de rue.");
      }
    } finally {
      setSearching(false);
    }
  };

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
                <Ionicons name="home" size={22} color={Colors.accent} />
                <Text style={styles.title}>Adresse fixe de référence</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>
              Définissez votre domicile, école ou lieu de formation. La distance en km sera calculée vers chaque entreprise sur l'accueil et sur leur fiche.
            </Text>

            {/* Adresse fixe actuellement active */}
            {currentPoint && (
              <View style={styles.activePointCard}>
                <View style={styles.activePointHeader}>
                  <Ionicons
                    name={currentPoint.isGps ? 'navigate' : 'home'}
                    size={20}
                    color={Colors.accent}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activePointBadge}>
                      {currentPoint.isGps ? 'Position GPS active' : 'Adresse fixe active'}
                    </Text>
                    <Text style={styles.activePointTitle} numberOfLines={2}>
                      {currentPoint.label}
                    </Text>
                  </View>
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

            {/* Saisie d'adresse fixe */}
            <Text style={styles.inputSectionTitle}>Rechercher votre adresse fixe</Text>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Ex : 15 rue de Paris Montpellier, Perpignan..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSubmitSearch}
                returnKeyType="search"
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

            {/* Liste de propositions d'adresses */}
            {searchResults.length > 0 && (
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
              </ScrollView>
            )}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <View style={styles.noResultsBox}>
                <Text style={styles.noResultsText}>
                  Aucune adresse correspondante trouvée pour "{searchQuery}".
                </Text>
                <TouchableOpacity
                  style={styles.validateCustomBtn}
                  onPress={handleSubmitSearch}
                  activeOpacity={0.7}
                >
                  <Text style={styles.validateCustomText}>Valider cette saisie quand même</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou utiliser votre position mobile</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Bouton GPS alternatif */}
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
    paddingBottom: 28,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 18,
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
    marginBottom: 14,
    lineHeight: 18,
  },
  activePointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${Colors.accent}15`,
    borderColor: `${Colors.accent}55`,
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    gap: 10,
  },
  activePointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activePointBadge: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activePointTitle: {
    color: Colors.text,
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 2,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearBtnText: {
    color: Colors.danger,
    fontSize: 11.5,
    fontWeight: '700',
  },
  inputSectionTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
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
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 13.5,
    padding: 0,
  },
  resultsList: {
    maxHeight: 180,
    marginBottom: 8,
  },
  resultsListContent: {
    gap: 6,
    paddingBottom: 4,
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
  noResultsBox: {
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  noResultsText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 6,
  },
  validateCustomBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${Colors.primary}25`,
    borderRadius: 8,
  },
  validateCustomText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
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
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 11,
    gap: 8,
  },
  gpsButtonText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
