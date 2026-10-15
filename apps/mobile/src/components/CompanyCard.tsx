import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Company } from '../types/company';
import { StatusBadge } from './StatusBadge';
import { LocationService } from '../services/location.service';

interface CompanyCardProps {
  company: Company;
  onPress: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
  distanceKm?: number | null;
}

export const CompanyCard: React.FC<CompanyCardProps> = ({
  company,
  onPress,
  selectable = false,
  selected = false,
  onToggleSelect,
  onLongPress,
  distanceKm,
}) => {
  const handleCall = () => {
    if (company.phone) {
      Linking.openURL(`tel:${company.phone}`).catch(() => {});
    }
  };

  const isToCall = company.status === 'TO_CALL';

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const handleCardPress = () => {
    if (selectable && onToggleSelect) {
      onToggleSelect();
    } else {
      onPress();
    }
  };

  const formattedDistance = LocationService.formatDistance(distanceKm);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        company.status === 'REPLY_RECEIVED' && styles.cardHighlightReply,
        isToCall && styles.cardHighlightCall,
        selected && styles.cardSelected,
      ]}
      onPress={handleCardPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Entreprise ${company.name}, statut ${company.status}`}
    >
      <View style={styles.mainRow}>
        {selectable && (
          <View style={styles.checkboxContainer} pointerEvents="none">
            <Ionicons
              name={selected ? 'checkbox' : 'square-outline'}
              size={24}
              color={selected ? Colors.primary : Colors.textMuted}
            />
          </View>
        )}

        <View style={styles.cardContent}>
          <View style={styles.header}>
            <View style={styles.titleWithCity}>
              <Text style={styles.companyName} numberOfLines={2}>
                {company.name}
              </Text>
              <View style={styles.badgesRow}>
                {company.city && (
                  <View style={styles.cityBadge}>
                    <Ionicons name="location-sharp" size={11} color={Colors.accent} />
                    <Text style={styles.cityText} numberOfLines={1}>
                      {company.city}
                    </Text>
                  </View>
                )}
                {formattedDistance && (
                  <View style={styles.distanceBadge}>
                    <Ionicons name="compass-outline" size={11} color={Colors.primary} />
                    <Text style={styles.distanceText}>{formattedDistance}</Text>
                  </View>
                )}
              </View>
            </View>
            <StatusBadge status={company.status} size="small" />
          </View>

          {/* Badge informatif accessible pour action requise */}
          {company.status === 'REPLY_RECEIVED' && (
            <View style={styles.urgentDecisionBadge}>
              <Ionicons name="sparkles" size={13} color={Colors.status.REPLY_RECEIVED} />
              <Text style={styles.urgentDecisionText}>
                Réponse reçue • Ouvrez la fiche pour accepter ou refuser
              </Text>
            </View>
          )}

          {isToCall && (
            <View style={styles.urgentCallBadge}>
              <Ionicons name="call" size={12} color={Colors.status.TO_CALL} />
              <Text style={styles.urgentCallText}>
                J+15 sans réponse • Appel téléphonique recommandé
              </Text>
            </View>
          )}

          {company.address ? (
            <View style={styles.addressRow}>
              <Ionicons name="navigate-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.addressText} numberOfLines={1}>
                {company.address}
              </Text>
            </View>
          ) : null}

          <View style={styles.contactRow}>
            <Ionicons
              name="mail-outline"
              size={14}
              color={
                !company.email || company.email.endsWith('@sans-email.altertrack')
                  ? Colors.textMuted
                  : Colors.textSecondary
              }
            />
            <Text
              style={[
                styles.contactText,
                (!company.email || company.email.endsWith('@sans-email.altertrack')) && {
                  color: Colors.textMuted,
                  fontStyle: 'italic',
                },
              ]}
              numberOfLines={1}
            >
              {!company.email || company.email.endsWith('@sans-email.altertrack')
                ? 'Aucun email renseigné'
                : company.email}
            </Text>
          </View>

          {company.phone && (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.contactText}>{company.phone}</Text>
              {isToCall && !selectable && (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={handleCall}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={12} color="#FFFFFF" />
                  <Text style={styles.callButtonText}>Appeler</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {company.notes && (
            <Text style={styles.notesPreview} numberOfLines={3}>
              {company.notes}
            </Text>
          )}

          <View style={styles.footer}>
            {company.firstMailSentAt ? (
              <Text style={styles.dateText}>
                1er contact : {formatDate(company.firstMailSentAt)}
                {company.followUpSentAt && ` • Relance : ${formatDate(company.followUpSentAt)}`}
              </Text>
            ) : (
              <Text style={styles.dateText}>Non encore contacté</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  urgentDecisionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.status.REPLY_RECEIVED}25`,
    borderColor: Colors.status.REPLY_RECEIVED,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 6,
    marginBottom: 8,
  },
  urgentDecisionText: {
    color: Colors.status.REPLY_RECEIVED,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  urgentCallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.status.TO_CALL}25`,
    borderColor: Colors.status.TO_CALL,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 6,
    marginBottom: 8,
  },
  urgentCallText: {
    color: Colors.status.TO_CALL,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  cardHighlightReply: {
    borderColor: Colors.status.REPLY_RECEIVED,
    backgroundColor: '#1E1B38',
  },
  cardHighlightCall: {
    borderColor: Colors.status.TO_CALL,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}12`,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleWithCity: {
    flex: 1,
    marginRight: 10,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  cityText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}20`,
    borderColor: `${Colors.primary}60`,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  distanceText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    marginBottom: 6,
  },
  addressText: {
    color: Colors.textMuted,
    fontSize: 12,
    flex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  contactText: {
    color: Colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.TO_CALL,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  notesPreview: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: `${Colors.border}88`,
  },
  dateText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
});
