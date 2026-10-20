import React from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { CompanyActivity } from '../types/company';

interface CompanyActivityTimelineProps {
  activities: CompanyActivity[];
  onAddPress: () => void;
  onEditPress?: (activity: CompanyActivity) => void;
  onDeletePress?: (activityId: string) => void;
  loading?: boolean;
}

export const getActivityTypeConfig = (type: string) => {
  switch (type) {
    case 'CALL':
      return {
        label: 'Appel',
        icon: 'call' as keyof typeof Ionicons.glyphMap,
        color: '#00D2C4',
      };
    case 'INTERVIEW_HR':
      return {
        label: 'Entretien RH',
        icon: 'people' as keyof typeof Ionicons.glyphMap,
        color: '#00F099',
      };
    case 'INTERVIEW_TECH':
      return {
        label: 'Entretien Tech',
        icon: 'code-slash' as keyof typeof Ionicons.glyphMap,
        color: '#10B981',
      };
    case 'LINKEDIN':
      return {
        label: 'LinkedIn',
        icon: 'share-social' as keyof typeof Ionicons.glyphMap,
        color: '#0A66C2',
      };
    case 'DIRECT_MAIL':
      return {
        label: 'Mail direct',
        icon: 'mail-outline' as keyof typeof Ionicons.glyphMap,
        color: '#0066FF',
      };
    case 'HAND_DELIVERED':
      return {
        label: 'En main propre',
        icon: 'hand-right' as keyof typeof Ionicons.glyphMap,
        color: '#EC4899',
      };
    case 'EMAIL_SENT':
      return {
        label: 'Email envoyé',
        icon: 'paper-plane' as keyof typeof Ionicons.glyphMap,
        color: '#0066FF',
      };
    case 'FOLLOW_UP_SENT':
      return {
        label: 'Relance envoyée',
        icon: 'refresh' as keyof typeof Ionicons.glyphMap,
        color: '#F97316',
      };
    case 'REPLY_RECEIVED':
      return {
        label: 'Réponse reçue',
        icon: 'chatbubble-ellipses' as keyof typeof Ionicons.glyphMap,
        color: '#00D2C4',
      };
    case 'STATUS_CHANGE':
      return {
        label: 'Changement statut',
        icon: 'swap-horizontal' as keyof typeof Ionicons.glyphMap,
        color: '#F59E0B',
      };
    case 'CREATION':
      return {
        label: 'Création fiche',
        icon: 'add-circle' as keyof typeof Ionicons.glyphMap,
        color: '#8B5CF6',
      };
    case 'NOTE':
    default:
      return {
        label: 'Action / Note',
        icon: 'document-text' as keyof typeof Ionicons.glyphMap,
        color: '#8B5CF6',
      };
  }
};

export const formatActivityDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const timeStr = d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isToday) return `Aujourd'hui à ${timeStr}`;
    if (isYesterday) return `Hier à ${timeStr}`;

    return `${d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    })} à ${timeStr}`;
  } catch {
    return dateStr;
  }
};

export const CompanyActivityTimeline: React.FC<CompanyActivityTimelineProps> = ({
  activities,
  onAddPress,
  onEditPress,
  onDeletePress,
  loading = false,
}) => {
  const confirmDelete = (act: CompanyActivity) => {
    if (!onDeletePress) return;
    Alert.alert(
      'Supprimer cette entrée',
      `Voulez-vous vraiment retirer "${act.title}" de l'historique ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => onDeletePress(act.id),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* En-tête de section avec bouton d'ajout */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="time" size={18} color={Colors.accent} />
          <Text style={styles.headerTitle}>Historique & Activités</Text>
          {activities.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activities.length}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={onAddPress}
          activeOpacity={0.8}
          accessibilityLabel="Ajouter une action dans l'historique"
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Contenu */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.loadingText}>Chargement de l'historique...</Text>
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Aucune action enregistrée</Text>
          <Text style={styles.emptySubtitle}>
            Notez vos appels, relances LinkedIn ou entretiens pour suivre vos échanges avec cette entreprise.
          </Text>
          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={onAddPress}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={18} color={Colors.accent} />
            <Text style={styles.emptyAddBtnText}>Ajouter une première action</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.timelineList}>
          {activities.map((act, index) => {
            const config = getActivityTypeConfig(act.type);
            const isLast = index === activities.length - 1;
            const isDeletable =
              act.type !== 'CREATION' && Boolean(onDeletePress);

            return (
              <View key={act.id || index} style={styles.timelineRow}>
                {/* Colonne gauche : Puce et ligne de liaison */}
                <View style={styles.nodeColumn}>
                  <View
                    style={[
                      styles.nodeBullet,
                      {
                        backgroundColor: `${config.color}22`,
                        borderColor: config.color,
                      },
                    ]}
                  >
                    <Ionicons name={config.icon} size={14} color={config.color} />
                  </View>
                  {!isLast && <View style={styles.connectingLine} />}
                </View>

                {/* Colonne droite : Carte d'activité */}
                <View style={styles.cardWrapper}>
                  <View style={styles.card}>
                    {/* Ligne d'en-tête de carte */}
                    <View style={styles.cardHeaderRow}>
                      <View
                        style={[
                          styles.typeBadge,
                          {
                            backgroundColor: `${config.color}15`,
                            borderColor: `${config.color}40`,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.typeDot,
                            { backgroundColor: config.color },
                          ]}
                        />
                        <Text
                          style={[styles.typeBadgeText, { color: config.color }]}
                        >
                          {config.label}
                        </Text>
                      </View>

                      <View style={styles.cardHeaderRight}>
                        <TouchableOpacity
                          style={styles.dateBtn}
                          onPress={() => onEditPress && onEditPress(act)}
                          disabled={!onEditPress}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dateText}>
                            {formatActivityDate(act.performedAt)}
                          </Text>
                          {Boolean(onEditPress) && (
                            <Ionicons
                              name="pencil-sharp"
                              size={11}
                              color={Colors.textSecondary}
                              style={styles.dateEditIcon}
                            />
                          )}
                        </TouchableOpacity>
                        {isDeletable && (
                          <TouchableOpacity
                            onPress={() => confirmDelete(act)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.deleteBtn}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={14}
                              color={Colors.textMuted}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Titre */}
                    <Text style={styles.activityTitle}>{act.title}</Text>

                    {/* Description optionnelle */}
                    {Boolean(act.description) && (
                      <View style={styles.descriptionContainer}>
                        <Text style={styles.descriptionText}>
                          {act.description}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginTop: 18,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  countBadge: {
    backgroundColor: `${Colors.accent}22`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${Colors.accent}55`,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.accent}15`,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.accent}44`,
    gap: 6,
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
  },
  timelineList: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  nodeColumn: {
    alignItems: 'center',
    width: 34,
    marginRight: 10,
  },
  nodeBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  connectingLine: {
    flex: 1,
    width: 2,
    backgroundColor: `${Colors.border}`,
    marginVertical: 4,
  },
  cardWrapper: {
    flex: 1,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: `${Colors.background}CC`,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: `${Colors.textSecondary}10`,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  dateEditIcon: {
    marginLeft: 4,
  },
  deleteBtn: {
    padding: 2,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 19,
  },
  descriptionContainer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: `${Colors.border}88`,
  },
  descriptionText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
