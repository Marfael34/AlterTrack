import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CenteredTextInput,
  KeyboardAwareCenteredScrollView,
} from '../components/KeyboardAwareCenteredScrollView';
import { EmailPreviewModal } from '../components/EmailPreviewModal';
import { ReferencePointModal } from '../components/ReferencePointModal';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { AlertService as Alert } from '../services/alert.service';
import { ApiService } from '../services/api.service';
import { LocationService, ReferencePoint } from '../services/location.service';
import { NotificationService } from '../services/notification.service';
import { StorageService, formatStandardCvName } from '../services/storage.service';
import { AppConfig } from '../types/config';

interface SettingsScreenProps {
  onBack: () => void;
  refPoint?: ReferencePoint | null;
  onUpdateRefPoint?: (point: ReferencePoint | null) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  refPoint: propRefPoint,
  onUpdateRefPoint,
}) => {
  const { user, updateProfile, refreshProfile, logout } = useAuth();

  const [profileFullName, setProfileFullName] = useState(user?.fullName || '');
  const [profileGmailUser, setProfileGmailUser] = useState(user?.gmailUser || '');
  const [profileGmailAppPassword, setProfileGmailAppPassword] = useState('');
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [testingGmail, setTestingGmail] = useState(false);

  const [refPoint, setRefPoint] = useState<ReferencePoint | null>(propRefPoint || null);
  const [isRefPointModalOpen, setIsRefPointModalOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [template, setTemplate] = useState('');
  const [activeCvName, setActiveCvName] = useState<string | null>(null);
  const [hasCv, setHasCv] = useState(false);
  const [cvDetails, setCvDetails] = useState<{
    fileName: string;
    fileSize?: number;
    uploadedAt?: string;
  } | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [tunnelUrl, setTunnelUrl] = useState<string>('');

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [deletingCv, setDeletingCv] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [registeringPush, setRegisteringPush] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

  const [testEmail, setTestEmail] = useState('');
  const [testCompany, setTestCompany] = useState('Capgemini');
  const [sendingTestMail, setSendingTestMail] = useState(false);
  const [testMailResult, setTestMailResult] = useState<{
    success: boolean;
    isSimulation: boolean;
    recipient: string;
    subject: string;
    attachmentName: string | null;
    note: string;
  } | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  useEffect(() => {
    if (propRefPoint !== undefined) {
      setRefPoint(propRefPoint);
    }
  }, [propRefPoint]);

  useEffect(() => {
    if (user) {
      setProfileFullName(user.fullName || '');
      setProfileGmailUser(user.gmailUser || user.email || '');
    }
  }, [user]);

  useEffect(() => {
    void loadInitialSettings();
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({
        fullName: profileFullName.trim() || undefined,
        gmailUser: profileGmailUser.trim() || null,
        gmailAppPassword: profileGmailAppPassword.trim() || undefined,
      });
      setProfileGmailAppPassword('');
      Alert.alert(
        'Profil mis à jour ✅',
        'Vos coordonnées et identifiants Gmail d\'envoi ont été enregistrés avec succès !',
      );
    } catch (err: any) {
      Alert.alert(
        'Erreur',
        err?.message || 'Impossible de mettre à jour le profil.',
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTestGmail = async () => {
    const targetEmail = user?.email || profileGmailUser.trim();
    if (!targetEmail) {
      Alert.alert('Erreur', 'Veuillez renseigner votre adresse e-mail.');
      return;
    }

    setTestingGmail(true);
    try {
      const res = await ApiService.sendTestEmail(
        targetEmail,
        'Test AlterTrack',
        'Validation de connexion Gmail — AlterTrack',
        `Bonjour ${user?.fullName || ''},\n\nFélicitations ! Vos identifiants Gmail sont correctement configurés dans AlterTrack.\nVos futures candidatures et relances pourront être expédiées directement depuis votre compte Google (${targetEmail}).\n\nDate : ${new Date().toLocaleString('fr-FR')}`,
      );

      if (res.isSimulation) {
        Alert.alert(
          'Mode Simulation 🧪',
          `L'envoi a été simulé avec succès.\n\n⚠️ Votre mot de passe d'application Google (16 lettres) n'est pas encore enregistré. Saisissez-le ci-dessus et cliquez sur "Enregistrer mes paramètres Gmail" pour activer l'envoi réel.`,
        );
      } else {
        Alert.alert(
          'Connexion Gmail Réussie ! ✉️',
          `Un e-mail de test réel a été expédié avec succès depuis votre compte Gmail vers ${targetEmail} !\nVérifiez votre boîte de réception.`,
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Échec du test Gmail ❌',
        err?.message || 'Erreur lors de la connexion Gmail. Assurez-vous d\'utiliser un mot de passe d\'application de 16 lettres sans espace.',
      );
    } finally {
      setTestingGmail(false);
    }
  };

  const handleOpenGoogleAppPasswords = () => {
    Linking.openURL('https://myaccount.google.com/apppasswords').catch(() => {
      Alert.alert('Lien', 'Rendez-vous sur https://myaccount.google.com/apppasswords');
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter de votre compte AlterTrack ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  };

  const loadInitialSettings = async () => {
    try {
      const [url, key, savedTestEmail, localCv] = await Promise.all([
        StorageService.getServerUrl(),
        StorageService.getApiKey(),
        StorageService.getTestEmail(),
        StorageService.getLocalCv(),
      ]);
      setServerUrl(url);
      setApiKey(key);
      if (savedTestEmail) {
        setTestEmail(savedTestEmail);
      }
      setTunnelUrl(StorageService.getTunnelUrl());

      if (localCv) {
        setCvDetails(localCv);
        setActiveCvName(localCv.fileName);
        setHasCv(true);
      }

      // Charge la configuration distante si le serveur est joignable
      try {
        const config: AppConfig = await ApiService.getConfig();
        setTemplate(config.template);
        if (config.hasCv) {
          setHasCv(true);
          const fallbackStd = formatStandardCvName(user?.fullName || profileFullName);
          setActiveCvName(user?.cvOriginalName || config.cvOriginalName || localCv?.fileName || fallbackStd);
        } else if (!localCv) {
          setHasCv(false);
          setActiveCvName(null);
        }
        setPushToken(config.expoPushToken || null);
      } catch {
        // Serveur pas encore joignable ou pas encore configuré
      }
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('IDLE');
    try {
      await StorageService.setServerUrl(serverUrl);
      await StorageService.setApiKey(apiKey);

      const health = await ApiService.checkHealth();
      setConnectionStatus('SUCCESS');
      Alert.alert(
        'Connexion réussie ✅',
        `Serveur AlterTrack joignable !\nStatut : ${health.status}\nBase de données : ${health.database}`,
      );

      // Recharger le template, CV et token push
      const config = await ApiService.getConfig();
      setTemplate(config.template);
      setHasCv(config.hasCv);
      setActiveCvName(config.cvOriginalName || null);
      setPushToken(config.expoPushToken || null);
    } catch (err) {
      setConnectionStatus('ERROR');
      Alert.alert(
        'Échec de connexion ❌',
        err instanceof Error
          ? err.message
          : 'Impossible de joindre le serveur. Vérifiez l’URL et Tailscale.',
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRegisterPush = async () => {
    setRegisteringPush(true);
    try {
      const token = await NotificationService.registerForPushNotificationsAsync();
      if (token) {
        setPushToken(token);
        Alert.alert(
          'Notifications Push ✅',
          'Token Expo Push synchronisé avec succès avec le serveur ! Vous recevrez des alertes instantanées lors des réponses recruteurs.',
        );
      } else {
        Alert.alert(
          'Notifications Push (Expo Go)',
          'Dans l’application Expo Go, Google et Expo désactivent les notifications push distantes (qui nécessitent un build autonome APK pour FCM). Vos candidatures, modèles IA, relances et CV fonctionnent quant à eux à 100% !',
        );
      }
    } catch (err) {
      Alert.alert(
        'Erreur',
        err instanceof Error ? err.message : 'Erreur lors de la synchronisation push.',
      );
    } finally {
      setRegisteringPush(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!template.trim()) {
      Alert.alert('Validation', 'Le modèle de mail ne peut pas être vide');
      return;
    }

    setSavingTemplate(true);
    try {
      await ApiService.updateTemplate(template.trim());
      Alert.alert('Succès', 'Modèle de mail de référence mis à jour pour Gemini !');
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la sauvegarde');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handlePickAndUploadCv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/x-pdf', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const rawName = file.name || 'CV.pdf';
      const isPdfMime = file.mimeType
        ? file.mimeType.toLowerCase().includes('pdf')
        : false;
      const isPdfExt = rawName.toLowerCase().endsWith('.pdf');

      if (!isPdfMime && !isPdfExt) {
        Alert.alert(
          'Format non reconnu',
          'Veuillez sélectionner un document au format PDF (.pdf).',
        );
        return;
      }

      // Format uniforme : nom_prenom_CV.pdf
      const standardName = formatStandardCvName(user?.fullName || profileFullName);

      setUploadingCv(true);

      const updated = await ApiService.uploadCv(
        file.uri,
        standardName,
        (file as unknown as { file?: unknown }).file,
      );

      const localInfo = {
        fileName: updated.cvOriginalName || standardName,
        fileSize: file.size,
        fileUri: file.uri,
        uploadedAt: new Date().toISOString(),
        isSynced: true,
      };

      await StorageService.setLocalCv(localInfo);
      setCvDetails(localInfo);
      setHasCv(true);
      setActiveCvName(localInfo.fileName);

      try {
        await refreshProfile();
      } catch {
        // ignore offline
      }

      const formattedSize = file.size
        ? ` (${Math.round(file.size / 1024)} Ko)`
        : '';

      Alert.alert(
        'CV stocké et synchronisé 🎉',
        `Le fichier "${localInfo.fileName}"${formattedSize} a été enregistré dans l'application et synchronisé sur votre serveur.\n\nIl sera joint automatiquement à toutes vos candidatures et relances.`,
      );
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'upload du CV");
    } finally {
      setUploadingCv(false);
    }
  };

  const handleViewCv = async () => {
    try {
      const url = await ApiService.getCvDownloadUrl();
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert(
        'Visualisation du CV',
        err?.message || 'Impossible d\'ouvrir le CV.',
      );
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
              setHasCv(false);
              setActiveCvName(null);
              setCvDetails(null);
              await refreshProfile();
              Alert.alert(
                'CV supprimé ✅',
                'Le fichier CV a été retiré de l\'application et du serveur.',
              );
            } catch (err: any) {
              Alert.alert('Erreur', err?.message || 'Échec de la suppression');
            } finally {
              setDeletingCv(false);
            }
          },
        },
      ],
    );
  };

  const handleSendTestEmail = async () => {
    const trimmedEmail = testEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      Alert.alert(
        'Adresse e-mail requise',
        'Veuillez renseigner votre adresse e-mail personnelle pour recevoir le test.',
      );
      return;
    }

    setSendingTestMail(true);
    setTestMailResult(null);

    try {
      await StorageService.setTestEmail(trimmedEmail);
      const res = await ApiService.sendTestEmail(
        trimmedEmail,
        testCompany.trim() || undefined,
      );

      setTestMailResult({
        success: res.success,
        isSimulation: res.isSimulation,
        recipient: res.recipient,
        subject: res.subject,
        attachmentName: res.attachmentName,
        note: res.note,
      });

      if (res.isSimulation) {
        Alert.alert(
          'Simulation réussie 🧪',
          `L'e-mail a été préparé avec votre CV joint.\n\nMode simulation actif : pour expédier réellement l'e-mail, renseignez GMAIL_USER et GMAIL_APP_PASSWORD dans le fichier .env du serveur.`,
        );
      } else {
        Alert.alert(
          'E-mail expédié ! ✉️',
          `L'e-mail a été expédié à ${res.recipient} dans les conditions réelles d'une entreprise :\n- Objet : "${res.subject}"\n- Pièce jointe : CV inclus\n\nVérifiez la boîte de réception !`,
        );
      }
    } catch (err) {
      Alert.alert(
        'Erreur lors de l’envoi',
        err instanceof Error ? err.message : 'Échec de l\'envoi du mail',
      );
    } finally {
      setSendingTestMail(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAwareCenteredScrollView contentContainerStyle={styles.scrollContent}>
        {/* Section 0 : Mon Compte & Envoi d'E-mails */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-circle-outline" size={22} color={Colors.brandCyan} />
            <Text style={styles.sectionTitle}>Mon Compte & Envoi Gmail</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Configurez vos identifiants d'envoi Gmail pour que vos candidatures et mails de test soient expédiés avec votre propre adresse e-mail.
          </Text>

          {/* Badge utilisateur connecté */}
          <View style={styles.accountBadge}>
            <View style={styles.accountAvatar}>
              <Text style={styles.accountAvatarText}>
                {(user?.fullName || user?.email || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>
                {user?.fullName || 'Utilisateur AlterTrack'}
              </Text>
              <Text style={styles.accountEmail}>{user?.email}</Text>
            </View>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={16} color={Colors.danger} />
              <Text style={styles.logoutBtnText}>Déconnexion</Text>
            </TouchableOpacity>
          </View>

          {/* Statut d'activation de l'envoi Gmail */}
          {user?.hasGmailConfigured ? (
            <View style={styles.gmailStatusBadgeSuccess}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.gmailStatusTitleSuccess}>
                  Envoi Gmail direct actif ✅
                </Text>
                <Text style={styles.gmailStatusTextSuccess}>
                  Vos candidatures et relances sont expédiées réellement depuis {user.gmailUser || user.email}.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.gmailStatusBadgeWarning}>
              <Ionicons name="warning" size={18} color={Colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.gmailStatusTitleWarning}>
                  Envoi direct Gmail non configuré ⚠️
                </Text>
                <Text style={styles.gmailStatusTextWarning}>
                  Pour envoyer vos candidatures directement depuis AlterTrack avec votre adresse Gmail ({user?.email}), renseignez votre mot de passe d'application Google (16 lettres) ci-dessous.
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.fieldLabel}>Nom complet</Text>
          <CenteredTextInput
            style={styles.input}
            value={profileFullName}
            onChangeText={setProfileFullName}
            placeholder="ex: Rafael Martinez"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Adresse Gmail d'envoi</Text>
          <CenteredTextInput
            style={styles.input}
            value={profileGmailUser}
            onChangeText={setProfileGmailUser}
            placeholder="votre.compte@gmail.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Mot de passe d'application Google (16 lettres)</Text>
          <View style={styles.passwordInputWrapper}>
            <CenteredTextInput
              style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
              value={profileGmailAppPassword}
              onChangeText={setProfileGmailAppPassword}
              placeholder={user?.hasGmailConfigured ? '•••••••••••••••• (configuré)' : '16 lettres générées sur Google'}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showGmailPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowGmailPassword(!showGmailPassword)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showGmailPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Guide Google App Password */}
          <View style={styles.gmailHelpCard}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.brandCyan} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.gmailHelpText}>
                <Text style={{ fontWeight: '700', color: Colors.text }}>Comment obtenir le mot de passe ?</Text> Activez la validation en 2 étapes sur Google, puis générez un mot de passe d'application (16 lettres sans espace) pour AlterTrack.
              </Text>
              <TouchableOpacity
                style={styles.openGoogleLinkBtn}
                onPress={handleOpenGoogleAppPasswords}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={13} color={Colors.brandCyan} />
                <Text style={styles.openGoogleLinkBtnText}>
                  Ouvrir la page Google App Passwords ↗
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileActionBtnsCol}>
            <TouchableOpacity
              style={[styles.saveProfileBtn, savingProfile && styles.buttonDisabled]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
              activeOpacity={0.8}
            >
              {savingProfile ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.saveProfileBtnText}>Enregistrer mes paramètres Gmail</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.testGmailBtn,
                testingGmail && styles.buttonDisabled,
              ]}
              onPress={handleTestGmail}
              disabled={testingGmail}
              activeOpacity={0.8}
            >
              {testingGmail ? (
                <ActivityIndicator color={Colors.accent} size="small" />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={16} color={Colors.accent} />
                  <Text style={styles.testGmailBtnText}>Tester l'envoi Gmail vers mon adresse</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 1 : Connexion Serveur PC / Tailscale */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="server-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Connexion Serveur</Text>
          </View>

          <Text style={styles.fieldLabel}>URL du serveur NestJS</Text>
          <CenteredTextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="https://...trycloudflare.com ou http://192.168.x.y:3000"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Raccourcis d'URL (Tunnel Cloudflare 4G/5G, Wi-Fi local) */}
          <View style={styles.presetsRow}>
            {tunnelUrl ? (
              <TouchableOpacity
                style={[
                  styles.presetChip,
                  serverUrl === tunnelUrl && styles.presetChipActive,
                ]}
                onPress={() => setServerUrl(tunnelUrl)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="globe-outline"
                  size={13}
                  color={serverUrl === tunnelUrl ? '#FFFFFF' : Colors.accent}
                />
                <Text
                  style={[
                    styles.presetChipText,
                    serverUrl === tunnelUrl && styles.presetChipTextActive,
                  ]}
                >
                  Tunnel 4G/5G
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.presetChip,
                serverUrl === StorageService.getLocalWifiUrl() && styles.presetChipActive,
              ]}
              onPress={() => setServerUrl(StorageService.getLocalWifiUrl())}
              activeOpacity={0.7}
            >
              <Ionicons
                name="wifi-outline"
                size={13}
                color={serverUrl === StorageService.getLocalWifiUrl() ? '#FFFFFF' : Colors.primary}
              />
              <Text
                style={[
                  styles.presetChipText,
                  serverUrl === StorageService.getLocalWifiUrl() && styles.presetChipTextActive,
                ]}
              >
                Wi-Fi local (PC)
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tunnelInfoCard}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
            <Text style={styles.tunnelInfoText}>
              <Text style={{ fontWeight: '700', color: Colors.text }}>Accès partout (4G/5G) :</Text> Utilisez le Tunnel Cloudflare pour joindre votre serveur en déplacement.
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Clé d'API statique (x-api-key)</Text>
          <CenteredTextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="Clé secrète configurée dans .env"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.testButton, testingConnection && styles.buttonDisabled]}
            onPress={handleTestConnection}
            disabled={testingConnection}
            activeOpacity={0.8}
          >
            {testingConnection ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name={
                    connectionStatus === 'SUCCESS'
                      ? 'checkmark-circle'
                      : connectionStatus === 'ERROR'
                      ? 'alert-circle'
                      : 'wifi-outline'
                  }
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.testButtonText}>Tester la connexion</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Section 2 : Gestion du CV PDF */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="document-text-outline" size={20} color={Colors.status.TO_CALL} />
            <Text style={styles.sectionTitle}>Curriculum Vitae (PDF)</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Ce fichier est stocké sur votre téléphone et synchronisé sur le serveur
            afin d'être joint automatiquement à toutes vos candidatures et relances.
          </Text>

          <View style={styles.cvCard}>
            <Ionicons
              name={hasCv ? 'document-attach' : 'alert-circle-outline'}
              size={30}
              color={hasCv ? Colors.success : Colors.warning}
            />
            <View style={styles.cvInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cvStatus}>
                  {hasCv ? 'CV actif & stocké sur l\'app' : 'Aucun CV enregistré'}
                </Text>
                {hasCv && (
                  <View style={styles.cvSyncTag}>
                    <Text style={styles.cvSyncTagText}>Synchronisé ✅</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cvName} numberOfLines={1}>
                {activeCvName || 'Veuillez sélectionner un fichier PDF'}
              </Text>
              {hasCv && cvDetails?.fileSize ? (
                <Text style={styles.cvMetaText}>
                  Taille : {Math.round(cvDetails.fileSize / 1024)} Ko • Format PDF
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.cvActionsRow}>
            <TouchableOpacity
              style={[
                styles.cvButton,
                { flex: 1 },
                uploadingCv && styles.buttonDisabled,
              ]}
              onPress={handlePickAndUploadCv}
              disabled={uploadingCv || deletingCv}
              activeOpacity={0.8}
            >
              {uploadingCv ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.cvButtonText}>
                    {hasCv ? 'Remplacer le CV' : 'Importer mon CV (PDF)'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {hasCv && (
              <TouchableOpacity
                style={styles.viewCvBtn}
                onPress={handleViewCv}
                activeOpacity={0.8}
              >
                <Ionicons name="eye-outline" size={16} color={Colors.accent} />
                <Text style={styles.viewCvBtnText}>Voir</Text>
              </TouchableOpacity>
            )}

            {hasCv && (
              <TouchableOpacity
                style={[
                  styles.deleteCvBtn,
                  deletingCv && styles.buttonDisabled,
                ]}
                onPress={handleDeleteCv}
                disabled={deletingCv || uploadingCv}
                activeOpacity={0.8}
              >
                {deletingCv ? (
                  <ActivityIndicator color={Colors.danger} size="small" />
                ) : (
                  <Ionicons name="trash-outline" size={17} color={Colors.danger} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Section : Adresse fixe de référence (Distance) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="home-outline" size={20} color={Colors.accent} />
            <Text style={styles.sectionTitle}>Adresse fixe de référence</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Définissez votre domicile, école ou lieu de formation. Les distances en km sont calculées automatiquement vers toutes les entreprises.
          </Text>

          <View style={styles.cvCard}>
            <Ionicons
              name={refPoint?.isGps ? 'navigate' : 'home'}
              size={26}
              color={refPoint ? Colors.accent : Colors.textMuted}
            />
            <View style={styles.cvInfo}>
              <Text style={styles.cvStatus}>
                {refPoint
                  ? refPoint.isGps
                    ? 'Position GPS active'
                    : 'Adresse fixe enregistrée'
                  : 'Aucune adresse définie'}
              </Text>
              <Text style={styles.cvName} numberOfLines={2}>
                {refPoint ? refPoint.label : 'Définissez votre adresse pour voir les distances'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.cvButton, { flex: 1, backgroundColor: Colors.primary }]}
              onPress={() => setIsRefPointModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="location-outline" size={18} color="#FFFFFF" />
              <Text style={styles.cvButtonText}>
                {refPoint ? 'Modifier l’adresse fixe' : 'Définir mon adresse fixe'}
              </Text>
            </TouchableOpacity>

            {refPoint && (
              <TouchableOpacity
                style={[
                  styles.cvButton,
                  {
                    paddingHorizontal: 16,
                    backgroundColor: Colors.cardBackground,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  },
                ]}
                onPress={async () => {
                  await LocationService.setReferencePoint(null);
                  setRefPoint(null);
                  if (onUpdateRefPoint) {
                    onUpdateRefPoint(null);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Section 3 : Modèle de mail de base (Template Gemini) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="sparkles-outline" size={20} color={Colors.accent} />
            <Text style={styles.sectionTitle}>Modèle de mail (Référence IA)</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Google Gemini utilise ce texte comme référence pour rédiger vos mails
            personnalisés et relances.
          </Text>

          {loadingConfig ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <CenteredTextInput
                style={[styles.input, styles.templateArea]}
                value={template}
                onChangeText={setTemplate}
                placeholder="Rédigez ici votre texte de motivation de base..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.saveTemplateButton, savingTemplate && styles.buttonDisabled]}
                onPress={handleSaveTemplate}
                disabled={savingTemplate}
                activeOpacity={0.8}
              >
                {savingTemplate ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.saveTemplateButtonText}>
                      Enregistrer le modèle
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Section : Test d'envoi d'e-mail (Format Entreprise réel) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="paper-plane-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Test d'envoi d'e-mail (Format Entreprise)</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Renseignez une adresse e-mail pour lui envoyer la candidature personnalisée exactement telle qu'une entreprise la recevrait (avec le vrai objet, le corps de texte personnalisé et votre CV joint, sans mention de test).
          </Text>

          <Text style={styles.fieldLabel}>Adresse e-mail destinataire *</Text>
          <CenteredTextInput
            style={styles.input}
            value={testEmail}
            onChangeText={setTestEmail}
            placeholder="votre.email@gmail.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Entreprise cible pour la personnalisation</Text>
          <CenteredTextInput
            style={styles.input}
            value={testCompany}
            onChangeText={setTestCompany}
            placeholder="Ex: Capgemini, Thalès, Ubisoft..."
            placeholderTextColor={Colors.textMuted}
          />

          <View style={styles.testActionsRow}>
            <TouchableOpacity
              style={styles.previewBtn}
              onPress={() => setIsPreviewModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="eye-outline" size={16} color={Colors.accent} />
              <Text style={styles.previewBtnText}>Aperçu & Personnaliser</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendTestMailBtn, sendingTestMail && styles.buttonDisabled]}
              onPress={handleSendTestEmail}
              disabled={sendingTestMail}
              activeOpacity={0.8}
            >
              {sendingTestMail ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.sendTestMailBtnText}>Envoyer l'e-mail</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {testMailResult && (
            <View
              style={[
                styles.testResultBox,
                testMailResult.isSimulation
                  ? styles.testResultSimulation
                  : styles.testResultReal,
              ]}
            >
              <Ionicons
                name={
                  testMailResult.isSimulation
                    ? 'information-circle-outline'
                    : 'checkmark-circle-outline'
                }
                size={22}
                color={testMailResult.isSimulation ? Colors.accent : Colors.success}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.testResultTitle}>
                  {testMailResult.isSimulation
                    ? 'Mode Simulation validé'
                    : 'E-mail de test expédié avec succès !'}
                </Text>
                <Text style={styles.testResultNote}>
                  Destinataire : {testMailResult.recipient}
                </Text>
                <Text style={styles.testResultNote}>
                  Objet : {testMailResult.subject}
                </Text>
                {testMailResult.attachmentName && (
                  <Text style={styles.testResultNote}>
                    Pièce jointe : 📎 {testMailResult.attachmentName}
                  </Text>
                )}
                <Text style={styles.testResultFootnote}>{testMailResult.note}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Section 4 : Notifications Push */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color={Colors.status.REPLY_RECEIVED}
            />
            <Text style={styles.sectionTitle}>Notifications Push (Expo)</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Recevez une alerte instantanée sur ce smartphone dès qu'un recruteur
            répond ou qu'une relance téléphonique est requise (J+15).
          </Text>

          <View style={styles.cvCard}>
            <Ionicons
              name={pushToken ? 'notifications-circle' : 'notifications-off-outline'}
              size={28}
              color={pushToken ? Colors.status.REPLY_RECEIVED : Colors.textMuted}
            />
            <View style={styles.cvInfo}>
              <Text style={styles.cvStatus}>
                {pushToken
                  ? 'Notifications activées'
                  : NotificationService.isExpoGo
                    ? 'Mode Expo Go (Actif sur APK)'
                    : 'Token non synchronisé'}
              </Text>
              <Text style={styles.cvName} numberOfLines={1}>
                {pushToken
                  ? pushToken
                  : NotificationService.isExpoGo
                    ? 'Push distants désactivés par Expo Go. Candidatures 100% actives.'
                    : 'Appuyez ci-dessous pour autoriser et lier ce téléphone'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.pushButton, registeringPush && styles.buttonDisabled]}
            onPress={handleRegisterPush}
            disabled={registeringPush}
            activeOpacity={0.8}
          >
            {registeringPush ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <Text style={styles.pushButtonText}>
                  {pushToken
                    ? 'Re-synchroniser ce téléphone'
                    : 'Activer les notifications push'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer Brand */}
        <View style={styles.footerBrand}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <Text style={styles.footerVersion}>AlterTrack v1.0.0 — Auto-hébergé</Text>
        </View>
      </KeyboardAwareCenteredScrollView>

      {/* Modal de définition d'adresse fixe */}
      <ReferencePointModal
        visible={isRefPointModalOpen}
        onClose={() => setIsRefPointModalOpen(false)}
        currentPoint={refPoint}
        onSave={(point) => {
          setRefPoint(point);
          if (onUpdateRefPoint) {
            onUpdateRefPoint(point);
          }
        }}
      />

      {/* Modal d'aperçu de l'e-mail IA */}
      <EmailPreviewModal
        visible={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        companyName={testCompany.trim() || 'Entreprise Test'}
        nature="FIRST_CONTACT"
        hasCv={hasCv}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 13,
  },
  templateArea: {
    minHeight: 150,
    lineHeight: 20,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 14,
    gap: 6,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cvCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    gap: 12,
  },
  cvInfo: {
    flex: 1,
  },
  cvStatus: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  cvName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cvButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.status.TO_CALL,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  cvButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cvSyncTag: {
    backgroundColor: `${Colors.success}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: `${Colors.success}40`,
  },
  cvSyncTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  cvMetaText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
  cvActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewCvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${Colors.accent}18`,
    borderWidth: 1,
    borderColor: `${Colors.accent}50`,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  viewCvBtnText: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  deleteCvBtn: {
    backgroundColor: `${Colors.danger}15`,
    borderWidth: 1,
    borderColor: `${Colors.danger}40`,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
    gap: 6,
  },
  saveTemplateButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  pushButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.status.REPLY_RECEIVED,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 6,
    gap: 6,
  },
  pushButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  footerBrand: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    gap: 6,
  },
  footerLogo: {
    width: 120,
    height: 32,
    opacity: 0.85,
  },
  footerVersion: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetChipActive: {
    backgroundColor: `${Colors.accent}25`,
    borderColor: Colors.accent,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  presetChipTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  tunnelInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${Colors.accent}15`,
    borderColor: `${Colors.accent}40`,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  tunnelInfoText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  testActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  previewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.accent}18`,
    borderWidth: 1,
    borderColor: `${Colors.accent}45`,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  previewBtnText: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  sendTestMailBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  sendTestMailBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  testResultSimulation: {
    backgroundColor: `${Colors.accent}12`,
    borderColor: `${Colors.accent}40`,
  },
  testResultReal: {
    backgroundColor: `${Colors.success}12`,
    borderColor: `${Colors.success}40`,
  },
  testResultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  testResultNote: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  testResultFootnote: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 15,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    gap: 12,
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.brandCyan}25`,
    borderWidth: 1.5,
    borderColor: Colors.brandCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.brandCyan,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  accountEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.danger}15`,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${Colors.danger}40`,
  },
  logoutBtnText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '600',
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  eyeBtn: {
    padding: 6,
  },
  gmailHelpCard: {
    flexDirection: 'row',
    backgroundColor: `${Colors.brandCyan}12`,
    borderWidth: 1,
    borderColor: `${Colors.brandCyan}30`,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  gmailHelpText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  gmailStatusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: `${Colors.success}15`,
    borderWidth: 1,
    borderColor: `${Colors.success}50`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  gmailStatusTitleSuccess: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: 2,
  },
  gmailStatusTextSuccess: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  gmailStatusBadgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: `${Colors.warning}15`,
    borderWidth: 1,
    borderColor: `${Colors.warning}50`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  gmailStatusTitleWarning: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.warning,
    marginBottom: 2,
  },
  gmailStatusTextWarning: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  openGoogleLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 2,
  },
  openGoogleLinkBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brandCyan,
    textDecorationLine: 'underline',
  },
  profileActionBtnsCol: {
    gap: 10,
  },
  saveProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandBlue,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  saveProfileBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  testGmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.accent}18`,
    borderWidth: 1,
    borderColor: `${Colors.accent}50`,
    borderRadius: 10,
    paddingVertical: 11,
    gap: 8,
  },
  testGmailBtnText: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
});
