import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Switch,
  ScrollView,
} from 'react-native';
import {
  CenteredTextInput,
  KeyboardAwareCenteredScrollView,
} from '../components/KeyboardAwareCenteredScrollView';
import { ReferencePointModal } from '../components/ReferencePointModal';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { AlertService as Alert } from '../services/alert.service';
import { ApiService } from '../services/api.service';
import { LocationService, ReferencePoint } from '../services/location.service';
import { StorageService, formatStandardCvName } from '../services/storage.service';
import { CompanyStats } from '../types/company';

interface SettingsScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onOpenSettings,
  refPoint: propRefPoint,
  onUpdateRefPoint,
}) => {
  const { user, updateProfile, refreshProfile, logout } = useAuth();

  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCvUrl, setLoadingCvUrl] = useState(false);
  const [deletingCv, setDeletingCv] = useState(false);

  // Adresse fixe de référence
  const [refPoint, setRefPoint] = useState<ReferencePoint | null>(propRefPoint || null);
  const [isRefPointModalOpen, setIsRefPointModalOpen] = useState(false);

  // Modal d'édition du profil
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(user?.fullName || '');
  const [editGmailUser, setEditGmailUser] = useState(user?.gmailUser || '');
  const [editGmailAppPassword, setEditGmailAppPassword] = useState('');
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (propRefPoint !== undefined) {
      setRefPoint(propRefPoint);
    }
  }, [propRefPoint]);

  useEffect(() => {
    void loadStats();
  }, []);

  useEffect(() => {
    if (user) {
      setEditFullName(user.fullName || '');
      setEditGmailUser(user.gmailUser || user.email || '');
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const data = await ApiService.getCompanyStats();
      setStats(data);
    } catch {
      // Ignorer si offline
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshProfile(),
        loadStats(),
        (async () => {
          const pt = await LocationService.getReferencePoint();
          setRefPoint(pt);
          if (onUpdateRefPoint) onUpdateRefPoint(pt);
        })(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenEditModal = () => {
    setEditFullName(user?.fullName || '');
    setEditGmailUser(user?.gmailUser || user?.email || '');
    setEditGmailAppPassword('');
    setShowGmailPassword(false);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({
        fullName: editFullName.trim() || undefined,
        gmailUser: editGmailUser.trim() || null,
        gmailAppPassword: editGmailAppPassword.trim() || undefined,
      });
      setIsEditModalOpen(false);
      setEditGmailAppPassword('');
      Alert.alert(
        'Profil mis à jour ✅',
        'Vos coordonnées ont été mises à jour avec succès.',
      );
    } catch (err: any) {
      Alert.alert(
        'Erreur de mise à jour',
        err?.message || 'Impossible de mettre à jour le profil.',
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleViewCv = async () => {
    setLoadingCvUrl(true);
    try {
      const url = await ApiService.getCvDownloadUrl();
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert(
        'Visualisation du CV',
        err?.message || 'Impossible d\'ouvrir votre CV.',
      );
    } finally {
      setLoadingCvUrl(false);
    }
  };

  const handleDeleteCv = () => {
    Alert.alert(
      'Supprimer mon CV',
      'Confirmez-vous la suppression de votre CV stocké sur votre téléphone et le serveur ?\n\nVos prochains e-mails seront envoyés sans pièce jointe.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            setDeletingCv(true);
            try {
              await ApiService.deleteCv();
              await StorageService.removeLocalCv();
              await refreshProfile();
              Alert.alert(
                'CV supprimé ✅',
                'Le fichier CV a été retiré de l\'application et du serveur.',
              );
            } catch (err: any) {
              Alert.alert('Erreur', err?.message || 'Échec de la suppression du CV.');
            } finally {
              setDeletingCv(false);
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous certain de vouloir vous déconnecter d\'AlterTrack ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ],
    );
  };

  // Calcul des initiales pour l'avatar
  const getInitials = (name?: string | null, email?: string): string => {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'AT';
  };

  const standardCvName = formatStandardCvName(user?.fullName);

  const totalTracked = stats
    ? stats.AUTO_SEND +
      stats.TO_SEND +
      stats.WAITING_FOR_REPLY +
      stats.TO_FOLLOW_UP +
      stats.TO_CALL +
      stats.REPLY_RECEIVED +
      stats.REFUSED +
      stats.ACCEPTED
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeader}>Préférences</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications-outline" size={20} color="#6366F1" style={{ marginRight: 12 }} />
            <Text style={styles.settingText}>Notifications Push</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#1F2937', true: '#6366F1' }}
            thumbColor="#F8FAFC"
          />
        </View>

        {/* ACCÈS CENTRAL AUX PARAMÈTRES */}
        <TouchableOpacity
          style={styles.settingsBannerCard}
          onPress={onOpenSettings}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ServerConfig' as any)}
        >
          <View style={styles.settingsBannerIconWrapper}>
            <Ionicons name="settings-sharp" size={24} color={Colors.brandCyan} />
          </View>
          <View style={styles.settingsBannerContent}>
            <View style={styles.settingsBannerHeaderRow}>
              <Text style={styles.settingsBannerTitle}>Paramètres & IA</Text>
              <View style={styles.settingsBadge}>
                <Text style={styles.settingsBadgeText}>Configuration</Text>
              </View>
            </View>
            <Text style={styles.settingsBannerSubtitle}>
              Modèle de mail IA, serveur, notifications, tests d'envoi & export
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748B" />
        </TouchableOpacity>

        {/* MINI DASHBOARD STATISTIQUES */}
        <View style={styles.sectionHeader}>
          <Ionicons name="bar-chart-outline" size={18} color={Colors.brandCyan} />
          <Text style={styles.sectionTitle}>Activité & Recherche</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: Colors.brandCyan }]}>
              {totalTracked}
            </Text>
            <Text style={styles.statLabel}>Entreprises</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: Colors.status.WAITING_FOR_REPLY }]}>
              {stats?.WAITING_FOR_REPLY || 0}
            </Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: Colors.status.TO_FOLLOW_UP }]}>
              {stats?.TO_FOLLOW_UP || 0}
            </Text>
            <Text style={styles.statLabel}>À relancer</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: Colors.status.REPLY_RECEIVED }]}>
              {(stats?.REPLY_RECEIVED || 0) + (stats?.TO_CALL || 0)}
            </Text>
            <Text style={styles.statLabel}>Réponses</Text>
          </View>
        </View>

        {/* DOSSIER CANDIDAT */}
        <View style={styles.sectionHeader}>
          <Ionicons name="folder-open-outline" size={18} color={Colors.brandCyan} />
          <Text style={styles.sectionTitle}>Mon Dossier de Candidature</Text>
        </View>

        {/* 1. CURRICULUM VITAE */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <View style={[styles.iconCircle, { backgroundColor: '#0066FF20' }]}>
                <Ionicons name="document-text" size={20} color={Colors.brandBlue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Curriculum Vitae (PDF)</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {standardCvName}
                </Text>
              </View>
            </View>

            {user?.hasCv ? (
              <View style={[styles.badge, { backgroundColor: '#00F09920', borderColor: Colors.brandGreen }]}>
                <Text style={[styles.badgeText, { color: Colors.brandGreen }]}>CV Prêt</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: '#F59E0B20', borderColor: Colors.warning }]}>
                <Text style={[styles.badgeText, { color: Colors.warning }]}>Non fourni</Text>
              </View>
            )}
          </View>

          <View style={styles.cardActionsRow}>
            {user?.hasCv ? (
              <>
                <TouchableOpacity
                  style={styles.actionBtnOutline}
                  onPress={handleViewCv}
                  disabled={loadingCvUrl || deletingCv}
                >
                  {loadingCvUrl ? (
                    <ActivityIndicator size="small" color={Colors.brandCyan} />
                  ) : (
                    <>
                      <Ionicons name="eye-outline" size={16} color={Colors.brandCyan} />
                      <Text style={styles.actionBtnOutlineText}>Aperçu PDF</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteCvBtn, deletingCv && { opacity: 0.6 }]}
                  onPress={handleDeleteCv}
                  disabled={deletingCv || loadingCvUrl}
                  accessibilityLabel="Supprimer mon CV"
                >
                  {deletingCv ? (
                    <ActivityIndicator size="small" color={Colors.danger} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      <Text style={styles.deleteCvBtnText}>Supprimer</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noCvHintText}>
                Aucun CV enregistré sur le serveur.
              </Text>
            )}
          </View>
        </View>

        {/* 2. EXPÉDITION GMAIL */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <View style={[styles.iconCircle, { backgroundColor: '#EF444420' }]}>
                <Ionicons name="mail" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Expéditeur d'e-mails</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {user?.gmailUser || user?.email || 'Gmail non configuré'}
                </Text>
              </View>
            </View>

            {user?.hasGmailAppPassword ? (
              <View style={[styles.badge, { backgroundColor: '#00F09920', borderColor: Colors.brandGreen }]}>
                <Text style={[styles.badgeText, { color: Colors.brandGreen }]}>Actif 🔒</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: '#F59E0B20', borderColor: Colors.warning }]}>
                <Text style={[styles.badgeText, { color: Colors.warning }]}>App Password requis</Text>
              </View>
            )}
          </View>

          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.actionBtnOutline}
              onPress={handleOpenEditModal}
            >
              <Ionicons name="key-outline" size={16} color={Colors.brandCyan} />
              <Text style={styles.actionBtnOutlineText}>Modifier identifiants</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnSecondary}
              onPress={onOpenSettings}
            >
              <Ionicons name="paper-plane-outline" size={16} color={Colors.text} />
              <Text style={styles.actionBtnSecondaryText}>Tester l'envoi</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SÉCURITÉ & SESSION */}
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.brandCyan} />
          <Text style={styles.sectionTitle}>Session & Sécurité</Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={onOpenSettings}
            activeOpacity={0.7}
          >
            <View style={styles.menuRowLeft}>
              <Ionicons name="options-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.menuRowText}>Toutes les options de l'application</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={styles.menuRowLeft}>
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
              <Text style={[styles.menuRowText, { color: Colors.danger }]}>
                Se déconnecter
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>

        {/* VERSION */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>AlterTrack Mobile • v1.0.0</Text>
          <Text style={styles.footerSubText}>
            Plateforme optimisée pour la recherche d'alternance
          </Text>
        </View>
      </ScrollView>

      {/* MODAL MODIFIER LE PROFIL */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
            <Text style={[styles.settingText, { color: '#EF4444' }]}>Se déconnecter</Text>
          </View>
        </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backButton: {
    backgroundColor: '#1E293B',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  content: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // CARTES GÉNÉRIQUES
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.brandCyan + '80',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brandCyan,
  },
  deleteCvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${Colors.danger}15`,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${Colors.danger}40`,
  },
  deleteCvBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger,
  },
  noCvHintText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.brandGreen,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B0F19',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 12,
  },
  settingRowButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 15,
    color: '#F8FAFC',
    fontWeight: '500',
  },
});