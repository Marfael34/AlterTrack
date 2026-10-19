import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ReferencePointModal } from '../components/ReferencePointModal';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api.service';
import { LocationService, ReferencePoint } from '../services/location.service';
import { formatStandardCvName } from '../services/storage.service';
import { CompanyStats } from '../types/company';

interface ProfileScreenProps {
  onOpenSettings: () => void;
  refPoint?: ReferencePoint | null;
  onUpdateRefPoint?: (point: ReferencePoint | null) => void;
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
    ? stats.TO_SEND +
      stats.WAITING_FOR_REPLY +
      stats.TO_FOLLOW_UP +
      stats.TO_CALL +
      stats.REPLY_RECEIVED +
      stats.REFUSED +
      stats.ACCEPTED
    : 0;

  return (
    <View style={styles.container}>
      {/* Header supérieur */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Profil</Text>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={onOpenSettings}
          accessibilityLabel="Ouvrir les paramètres"
        >
          <Ionicons name="settings-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.brandCyan}
            colors={[Colors.brandCyan]}
          />
        }
      >
        {/* CARTE HERO UTILISATEUR */}
        <View style={styles.heroCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {getInitials(user?.fullName, user?.email)}
              </Text>
              <View style={styles.avatarOnlineDot} />
            </View>

            <View style={styles.heroInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.fullName || 'Candidat Alternance'}
                </Text>
                <TouchableOpacity
                  style={styles.editPill}
                  onPress={handleOpenEditModal}
                  accessibilityLabel="Modifier le profil"
                >
                  <Ionicons name="pencil" size={12} color={Colors.brandCyan} />
                  <Text style={styles.editPillText}>Modifier</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.userEmail} numberOfLines={1}>
                {user?.email}
              </Text>

              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Compte Alternant Actif</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ACCÈS CENTRAL AUX PARAMÈTRES (Recommandé par l'utilisateur) */}
        <TouchableOpacity
          style={styles.settingsBannerCard}
          onPress={onOpenSettings}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Accéder aux paramètres de l'application"
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
              Modèle de mail IA, serveur, notifications, tests d'envoi & CV
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={Colors.textSecondary} />
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
              <TouchableOpacity
                style={styles.actionBtnOutline}
                onPress={handleViewCv}
                disabled={loadingCvUrl}
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
            ) : null}

            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={onOpenSettings}
            >
              <Ionicons name="cloud-upload-outline" size={16} color="#0B0F19" />
              <Text style={styles.actionBtnPrimaryText}>
                {user?.hasCv ? 'Gérer mon CV' : 'Importer mon CV'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. ADRESSE FIXE DE RÉFÉRENCE */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <View style={[styles.iconCircle, { backgroundColor: '#00D2C420' }]}>
                <Ionicons name="navigate-circle" size={20} color={Colors.brandCyan} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Adresse de référence</Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  {refPoint?.label || 'Non définie (domicile ou point de départ)'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.actionBtnOutline}
              onPress={() => setIsRefPointModalOpen(true)}
            >
              <Ionicons name="location-outline" size={16} color={Colors.brandCyan} />
              <Text style={styles.actionBtnOutlineText}>
                {refPoint ? 'Modifier l\'adresse' : 'Définir mon adresse'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. EXPÉDITION GMAIL */}
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
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier mon profil</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.inputLabel}>Nom complet (Prénom et Nom)</Text>
              <TextInput
                style={styles.textInput}
                value={editFullName}
                onChangeText={setEditFullName}
                placeholder="ex: Raphael Martinez"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
              />
              <Text style={styles.inputHint}>
                Ce nom est automatiquement utilisé pour standardiser le fichier de votre CV (ex: martinez_raphael_CV.pdf).
              </Text>

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>
                Adresse Gmail d'envoi
              </Text>
              <TextInput
                style={styles.textInput}
                value={editGmailUser}
                onChangeText={setEditGmailUser}
                placeholder="votre.email@gmail.com"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>
                Mot de passe d'application Google (16 caractères)
              </Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                  value={editGmailAppPassword}
                  onChangeText={setEditGmailAppPassword}
                  placeholder={user?.hasGmailAppPassword ? '•••• •••• •••• •••• (inchangé)' : 'abcd efgh ijkl mnop'}
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showGmailPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowGmailPassword(!showGmailPassword)}
                >
                  <Ionicons
                    name={showGmailPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.inputHint}>
                Générez ce mot de passe dans votre compte Google (Sécurité &gt; Mots de passe d'application).
              </Text>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsEditModalOpen(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator size="small" color="#0B0F19" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Enregistrer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL ADRESSE DE RÉFÉRENCE */}
      <ReferencePointModal
        visible={isRefPointModalOpen}
        onClose={() => setIsRefPointModalOpen(false)}
        currentPoint={refPoint}
        onSave={(point) => {
          setRefPoint(point);
          if (onUpdateRefPoint) onUpdateRefPoint(point);
          setIsRefPointModalOpen(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // CARTE HERO
  heroCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)' }
      : {
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        }),
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.brandCyan + '25',
    borderWidth: 2,
    borderColor: Colors.brandCyan,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.brandCyan,
    letterSpacing: 1,
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.brandGreen,
    borderWidth: 2,
    borderColor: Colors.cardBackground,
  },
  heroInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.brandCyan,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#00F09915',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00F09940',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brandGreen,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.brandGreen,
  },

  // BANNIÈRE ACCÈS PARAMÈTRES
  settingsBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.brandCyan + '50',
    marginBottom: 20,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 18px rgba(0, 210, 196, 0.12)' }
      : {
          elevation: 4,
          shadowColor: Colors.brandCyan,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.15,
          shadowRadius: 5,
        }),
  },
  settingsBannerIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.brandCyan + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingsBannerContent: {
    flex: 1,
    marginRight: 8,
  },
  settingsBannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  settingsBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  settingsBadge: {
    backgroundColor: Colors.brandCyan + '25',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  settingsBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.brandCyan,
    textTransform: 'uppercase',
  },
  settingsBannerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  // STATS
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
    color: Colors.text,
  },

  // MENUS
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  // FOOTER
  footer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  footerSubText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  modalBody: {
    padding: 18,
    paddingBottom: 28,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    marginBottom: 4,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputHint: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: Colors.brandCyan,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B0F19',
  },
});
