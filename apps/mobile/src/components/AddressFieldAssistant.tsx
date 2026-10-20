import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { GeocodeResult, LocationService, ReferencePoint } from '../services/location.service';
import { CenteredTextInput } from './KeyboardAwareCenteredScrollView';

interface AddressFieldAssistantProps {
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  onChangeAddress: (address: string) => void;
  onChangeCity: (city: string) => void;
  onChangeCoordinates: (coords: { latitude?: number; longitude?: number }) => void;
  refPoint?: ReferencePoint | null;
  onFocusInput?: () => void;
}

export const AddressFieldAssistant: React.FC<AddressFieldAssistantProps> = ({
  address,
  city,
  latitude,
  longitude,
  onChangeAddress,
  onChangeCity,
  onChangeCoordinates,
  refPoint,
  onFocusInput,
}) => {
  const [quickSearch, setQuickSearch] = useState('');
  const [quickResults, setQuickResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSearchSource, setActiveSearchSource] = useState<'QUICK' | 'CITY' | 'ADDRESS' | null>(null);

  // Suggestions dédiées pour la saisie directe de la ville
  const [citySuggestions, setCitySuggestions] = useState<GeocodeResult[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);

  // Vérification manuelle
  const [verifying, setVerifying] = useState(false);
  const [lastVerifiedLabel, setLastVerifiedLabel] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autocomplétion pour la barre de recherche rapide (tous types)
  useEffect(() => {
    const q = quickSearch.trim();
    if (q.length < 2) {
      setQuickResults([]);
      setIsSearching(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await LocationService.searchAddress(q);
        setQuickResults(results);
        setActiveSearchSource('QUICK');
      } catch {
        setQuickResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [quickSearch]);

  // Autocomplétion pour le champ direct "Ville ou commune"
  const handleCityChangeText = (text: string) => {
    onChangeCity(text);
    // Si l'utilisateur modifie la ville manuellement, on réinitialise les coordonnées précises
    if (latitude !== undefined || longitude !== undefined) {
      onChangeCoordinates({ latitude: undefined, longitude: undefined });
      setLastVerifiedLabel(null);
    }

    const q = text.trim();
    if (q.length < 2) {
      setCitySuggestions([]);
      setIsSearchingCity(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsSearchingCity(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await LocationService.searchAddress(q, 'municipality');
        setCitySuggestions(results);
        setActiveSearchSource('CITY');
      } catch {
        setCitySuggestions([]);
      } finally {
        setIsSearchingCity(false);
      }
    }, 280);
  };

  const handleAddressChangeText = (text: string) => {
    onChangeAddress(text);
    if (latitude !== undefined || longitude !== undefined) {
      onChangeCoordinates({ latitude: undefined, longitude: undefined });
      setLastVerifiedLabel(null);
    }
  };

  // Sélection d'une proposition depuis la recherche rapide
  const handleSelectQuickResult = (item: GeocodeResult) => {
    Keyboard.dismiss();
    setQuickSearch('');
    setQuickResults([]);
    setActiveSearchSource(null);

    if (item.type === 'municipality') {
      onChangeCity(item.city);
    } else {
      onChangeAddress(item.name || item.label);
      onChangeCity(item.city);
    }

    onChangeCoordinates({
      latitude: item.latitude,
      longitude: item.longitude,
    });
    setLastVerifiedLabel(item.label);
  };

  // Sélection d'une suggestion de ville
  const handleSelectCitySuggestion = (item: GeocodeResult) => {
    Keyboard.dismiss();
    onChangeCity(item.city);
    setCitySuggestions([]);
    setActiveSearchSource(null);

    // Si aucune adresse de rue n'est précisée, on géocode sur la commune
    if (!address.trim()) {
      onChangeCoordinates({
        latitude: item.latitude,
        longitude: item.longitude,
      });
      setLastVerifiedLabel(`${item.city} (${item.postcode || ''})`);
    } else {
      // Si une rue est déjà saisie, tenter de géocoder l'adresse complète avec la nouvelle ville
      void (async () => {
        const fullQ = `${address.trim()} ${item.city}`;
        const coords = await LocationService.geocodeQuery(fullQ);
        if (coords) {
          onChangeCoordinates(coords);
          setLastVerifiedLabel(fullQ);
        }
      })();
    }
  };

  // Bouton pour forcer la vérification et le géocodage de ce qui est actuellement saisi
  const handleVerifyCurrentInput = async () => {
    const fullQuery = [address.trim(), city.trim()].filter(Boolean).join(' ');
    if (!fullQuery) return;

    setVerifying(true);
    try {
      const results = await LocationService.searchAddress(fullQuery);
      if (results.length > 0) {
        const best = results[0];
        if (best.type === 'municipality') {
          onChangeCity(best.city);
        } else {
          onChangeAddress(best.name || best.label);
          onChangeCity(best.city);
        }
        onChangeCoordinates({
          latitude: best.latitude,
          longitude: best.longitude,
        });
        setLastVerifiedLabel(best.label);
      } else {
        // Fallback ville seule si adresse introuvable
        if (city.trim()) {
          const cityCoords = await LocationService.geocodeQuery(city.trim(), 'municipality');
          if (cityCoords) {
            onChangeCoordinates(cityCoords);
            setLastVerifiedLabel(city.trim());
          }
        }
      }
    } finally {
      setVerifying(false);
    }
  };

  const hasCoordinates =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude);

  const calculatedDistance =
    hasCoordinates && refPoint
      ? LocationService.calculateDistanceKm(
          refPoint.latitude,
          refPoint.longitude,
          latitude as number,
          longitude as number,
        )
      : null;

  return (
    <View style={styles.container}>
      {/* En-tête de section avec badge d'aide */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleWrap}>
          <Ionicons name="location-sharp" size={17} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Localisation de l'entreprise</Text>
        </View>
        <View style={styles.helpBadge}>
          <Ionicons name="sparkles" size={11} color={Colors.accent} />
          <Text style={styles.helpBadgeText}>Aide à la saisie</Text>
        </View>
      </View>

      <Text style={styles.sectionSubtitle}>
        Recherchez l'adresse officielle pour éviter les fautes de frappe et garantir un placement parfait sur la carte.
      </Text>

      {/* Barre de recherche intelligente avec autocomplétion instantanée */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.accent} style={styles.searchIcon} />
        <CenteredTextInput
          style={styles.searchInput}
          placeholder="Rechercher une adresse, une rue ou une ville..."
          placeholderTextColor={Colors.textMuted}
          value={quickSearch}
          onChangeText={setQuickSearch}
          onFocus={onFocusInput}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {isSearching ? (
          <ActivityIndicator size="small" color={Colors.accent} style={{ marginRight: 8 }} />
        ) : quickSearch.length > 0 ? (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              setQuickSearch('');
              setQuickResults([]);
            }}
          >
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Liste des propositions de la recherche rapide */}
      {quickResults.length > 0 && activeSearchSource === 'QUICK' && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsHeaderText}>
              Adresses officielles correspondantes ({quickResults.length}) :
            </Text>
          </View>
          {quickResults.map((item, idx) => {
            const isMunicipality = item.type === 'municipality';
            const dist =
              refPoint && item.latitude && item.longitude
                ? LocationService.calculateDistanceKm(
                    refPoint.latitude,
                    refPoint.longitude,
                    item.latitude,
                    item.longitude,
                  )
                : null;

            return (
              <TouchableOpacity
                key={`${item.label}-${idx}`}
                style={[
                  styles.suggestionRow,
                  idx === quickResults.length - 1 && styles.suggestionRowLast,
                ]}
                onPress={() => handleSelectQuickResult(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.suggestionIconWrap,
                    isMunicipality && styles.suggestionIconWrapCity,
                  ]}
                >
                  <Ionicons
                    name={isMunicipality ? 'business' : 'home'}
                    size={16}
                    color={isMunicipality ? Colors.primary : Colors.accent}
                  />
                </View>

                <View style={styles.suggestionTextCol}>
                  <View style={styles.suggestionTitleRow}>
                    <Text style={styles.suggestionMainText} numberOfLines={1}>
                      {item.name || item.label}
                    </Text>
                    <View
                      style={[
                        styles.typePill,
                        isMunicipality && styles.typePillCity,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typePillText,
                          isMunicipality && styles.typePillTextCity,
                        ]}
                      >
                        {isMunicipality ? 'Commune' : 'Adresse exacte'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.suggestionSubText} numberOfLines={1}>
                    {item.postcode ? `${item.postcode} ` : ''}
                    {item.city}
                    {item.context ? ` • ${item.context}` : ''}
                  </Text>

                  {dist !== null && (
                    <Text style={styles.suggestionDistanceText}>
                      📍 À {LocationService.formatDistance(dist)} de votre adresse fixe
                    </Text>
                  )}
                </View>

                <Ionicons name="arrow-forward-circle" size={20} color={Colors.accent} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Bannière de confirmation de validation et coordonnées GPS */}
      {hasCoordinates ? (
        <View style={styles.verifiedCard}>
          <View style={styles.verifiedTopRow}>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.verifiedBadgeText}>Adresse validée & localisée ✓</Text>
            </View>
            {calculatedDistance !== null && (
              <View style={styles.distanceBadge}>
                <Ionicons name="navigate-outline" size={12} color={Colors.accent} />
                <Text style={styles.distanceBadgeText}>
                  À {LocationService.formatDistance(calculatedDistance)}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.verifiedLabelText} numberOfLines={2}>
            {lastVerifiedLabel || [address, city].filter(Boolean).join(', ')}
          </Text>

          <View style={styles.verifiedBottomRow}>
            <Text style={styles.coordsText}>
              GPS : {latitude?.toFixed(4)}, {longitude?.toFixed(4)} • Prêt pour la carte
            </Text>
          </View>
        </View>
      ) : (city.trim() || address.trim()) ? (
        <View style={styles.unverifiedCard}>
          <View style={styles.unverifiedInfo}>
            <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
            <Text style={styles.unverifiedText}>
              Position GPS non encore confirmée.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={handleVerifyCurrentInput}
            disabled={verifying}
            activeOpacity={0.7}
          >
            {verifying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="locate-outline" size={13} color="#FFFFFF" />
                <Text style={styles.verifyBtnText}>Vérifier & positionner</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Champs détaillés éditables manuellement */}
      <View style={styles.fieldsContainer}>
        {/* Champ Ville ou commune */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Ville ou commune</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="business-outline" size={16} color={Colors.textMuted} style={styles.fieldIcon} />
            <CenteredTextInput
              style={styles.fieldInput}
              value={city}
              onChangeText={handleCityChangeText}
              onFocus={onFocusInput}
              placeholder="Ex: Montpellier, Paris, Lyon, Clapiers..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
            {isSearchingCity ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
            ) : city.length > 0 ? (
              <TouchableOpacity onPress={() => handleCityChangeText('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Suggestions pour la ville lors de la saisie directe */}
          {citySuggestions.length > 0 && activeSearchSource === 'CITY' && (
            <View style={styles.citySuggestionsBox}>
              {citySuggestions.map((item, idx) => (
                <TouchableOpacity
                  key={`${item.label}-${idx}`}
                  style={[
                    styles.citySuggestionRow,
                    idx === citySuggestions.length - 1 && styles.suggestionRowLast,
                  ]}
                  onPress={() => handleSelectCitySuggestion(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location" size={14} color={Colors.primary} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.citySuggestionText}>
                      {item.city} {item.postcode ? `(${item.postcode})` : ''}
                    </Text>
                    {item.context && (
                      <Text style={styles.citySuggestionContext}>{item.context}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Champ Adresse postale */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Adresse postale (facultatif)</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="map-outline" size={16} color={Colors.textMuted} style={styles.fieldIcon} />
            <CenteredTextInput
              style={styles.fieldInput}
              value={address}
              onChangeText={handleAddressChangeText}
              onFocus={onFocusInput}
              placeholder="Ex: 5 rue Georges Besse, 10 rue de la République..."
              placeholderTextColor={Colors.textMuted}
            />
            {address.length > 0 && (
              <TouchableOpacity onPress={() => handleAddressChangeText('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Encadré conseil */}
      <View style={styles.tipCard}>
        <Ionicons name="bulb-outline" size={16} color={Colors.brandGreen} />
        <Text style={styles.tipText}>
          <Text style={{ fontWeight: '700', color: Colors.brandGreen }}>Astuce : </Text>
          Tapez votre adresse dans la recherche rapide (ex : « 5 rue Georges Besse Clapiers ») puis touchez la suggestion pour remplir la rue et la ville sans risquer d'erreur.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  helpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${Colors.accent}40`,
    gap: 4,
  },
  helpBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: `${Colors.accent}60`,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 14,
    color: Colors.text,
  },
  clearBtn: {
    padding: 4,
  },
  suggestionsContainer: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${Colors.accent}50`,
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionsHeader: {
    backgroundColor: `${Colors.accent}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: `${Colors.accent}30`,
  },
  suggestionsHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  suggestionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${Colors.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionIconWrapCity: {
    backgroundColor: `${Colors.primary}20`,
  },
  suggestionTextCol: {
    flex: 1,
    marginRight: 8,
  },
  suggestionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  suggestionMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  typePill: {
    backgroundColor: `${Colors.accent}25`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typePillCity: {
    backgroundColor: `${Colors.primary}25`,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
  },
  typePillTextCity: {
    color: Colors.primary,
  },
  suggestionSubText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  suggestionDistanceText: {
    fontSize: 11,
    color: Colors.brandGreen,
    fontWeight: '600',
    marginTop: 2,
  },
  verifiedCard: {
    backgroundColor: '#05966915',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B98150',
    padding: 10,
    marginBottom: 12,
  },
  verifiedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent,
  },
  verifiedLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginVertical: 2,
  },
  verifiedBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  coordsText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  unverifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F59E0B15',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B40',
    padding: 10,
    marginBottom: 12,
  },
  unverifiedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  unverifiedText: {
    fontSize: 11,
    color: '#F59E0B',
    flex: 1,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 4,
  },
  verifyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fieldsContainer: {
    gap: 10,
  },
  fieldGroup: {
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
  },
  fieldIcon: {
    marginRight: 8,
  },
  fieldInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: Colors.text,
  },
  citySuggestionsBox: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  citySuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  citySuggestionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  citySuggestionContext: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${Colors.brandGreen}15`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${Colors.brandGreen}35`,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  tipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    flex: 1,
  },
});
