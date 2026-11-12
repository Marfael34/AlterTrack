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
  const isReplyReceived = company.status === 'REPLY_RECEIVED';

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

  // Initiales pour l'avatar (ex: CGI -> CG, Capgemini -> CA)
  const getInitials = (name: string) => {
    const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'EN';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const initials = getInitials(company.name);
  const statusColor = Colors.status[company.status] || Colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isReplyReceived && styles.cardHighlightReply,
        isToCall && styles.cardHighlightCall,
        selected && styles.cardSelected,
      ]}
      onPress={handleCardPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Entreprise ${company.name}, statut ${company.status}`}
    >
      <View style={styles.mainRow}>
        {selectable && (
          <View style={styles.checkboxContainer} pointerEvents="none">
            <Ionicons
              name={selected ? 'checkbox' : 'square-outline'}
              size={22}
              color={selected ? Colors.primary : Colors.textMuted}
            />
          </View>
        )}

        {/* Avatar avec initiales */}
        <View
          style={[
            styles.avatarCircle,
            { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}35` },
          ]}
        >
          <Text style={[styles.avatarText, { color: statusColor }]}>{initials}</Text>
        </View>

        <View style={styles.cardContent}>
          {/* Header : Nom + Badge de Statut */}
          <View style={styles.headerRow}>
            <Text style={styles.companyName} numberOfLines={1}>
              {company.name}
            </Text>
            <StatusBadge status={company.status} size="small" />
          </View>

          {/* Badges Localisation & Distance */}
          {(company.city || formattedDistance) && (
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
          )}

          {/* Bannières urgentes et interactives */}
          {isReplyReceived && (
            <View style={styles.urgentDecisionBadge}>
              <Ionicons name="sparkles" size={12} color={Colors.status.REPLY_RECEIVED} />
              <Text style={styles.urgentDecisionText} numberOfLines={1}>
                Réponse reçue • Décision requise
              </Text>
              <Ionicons name="chevron-forward" size={12} color={Colors.status.REPLY_RECEIVED} />
            </View>
          )}

          {isToCall && (
            <View style={styles.urgentCallBadge}>
              <Ionicons name="call" size={12} color={Colors.status.TO_CALL} />
              <Text style={styles.urgentCallText} numberOfLines={1}>
                J+15 sans réponse • Appel direct
              </Text>
              <Ionicons name="chevron-forward" size={12} color={Colors.status.TO_CALL} />
            </View>
          )}

          {/* Informations de contact direct */}
          <View style={styles.contactDetailsRow}>
            {company.email && !company.email.endsWith('@sans-email.altertrack') ? (
              <View style={styles.contactItem}>
                <Ionicons name="mail-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.contactText} numberOfLines={1}>
                  {company.email}
                </Text>
              </View>
            ) : null}

            {company.phone && (
              <View style={styles.contactItem}>
                <Ionicons name="call-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.contactText} numberOfLines={1}>
                  {company.phone}
                </Text>
              </View>
            )}
          </View>

          {/* Note personnelle discrète */}
          {company.notes ? (
            <Text style={styles.notesPreview} numberOfLines={2}>
              "{company.notes}"
            </Text>
          ) : null}

          {/* Footer métadonnées & Action rapide */}
          <View style={styles.footerRow}>
            <View style={styles.dateInfoContainer}>
              <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.dateText}>
                {company.firstMailSentAt
                  ? `Contacté le ${formatDate(company.firstMailSentAt)}`
                  : 'À contacter'}
                {company.followUpSentAt && ` • Relance : ${formatDate(company.followUpSentAt)}`}
              </Text>
            </View>

            {/* Bouton d'action directe d'appel téléphonique si téléphone renseigné */}
            {company.phone && !selectable && (
              <TouchableOpacity
                style={styles.quickCallBtn}
                onPress={handleCall}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="call" size={11} color="#FFFFFF" />
                <Text style={styles.quickCallText}>Appeler</Text>
              </TouchableOpacity>
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer' as any,
          transition: 'all 0.15s ease-in-out',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 5,
          elevation: 3,
        }),
  },
  cardHighlightReply: {
    borderColor: 'rgba(6, 182, 212, 0.4)',
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  cardHighlightCall: {
    borderColor: 'rgba(6, 182, 212, 0.4)',
    backgroundColor: 'rgba(6, 182, 212, 0.03)',
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxContainer: {
    marginTop: 6,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardContent: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    letterSpacing: 0.2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
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
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  distanceText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  urgentDecisionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
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
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
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
  contactDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '85%',
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
    marginBottom: 6,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  dateInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dateText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  quickCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  quickCallText: {
    color: '#090D16',
    fontSize: 11,
    fontWeight: '700',
  },
});
