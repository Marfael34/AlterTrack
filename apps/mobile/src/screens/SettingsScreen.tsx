import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { StorageService } from '../services/storage.service';
import { AppConfig } from '../types/config';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [template, setTemplate] = useState('');
  const [activeCvName, setActiveCvName] = useState<string | null>(null);
  const [hasCv, setHasCv] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [registeringPush, setRegisteringPush] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

  useEffect(() => {
    void loadInitialSettings();
  }, []);

  const loadInitialSettings = async () => {
    try {
      const [url, key] = await Promise.all([
        StorageService.getServerUrl(),
        StorageService.getApiKey(),
      ]);
      setServerUrl(url);
      setApiKey(key);

      // Charge la configuration distante si le serveur est joignable
      try {
        const config: AppConfig = await ApiService.getConfig();
        setTemplate(config.template);
        setHasCv(config.hasCv);
        setActiveCvName(config.cvOriginalName || null);
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
          'Notifications Push ⚠️',
          'Impossible de récupérer le token Push. Vérifiez que les permissions sont accordées dans les paramètres système de votre appareil.',
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
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      setUploadingCv(true);

      const updated = await ApiService.uploadCv(file.uri, file.name);
      setHasCv(true);
      setActiveCvName(updated.cvOriginalName || file.name);

      Alert.alert('CV synchronisé 🎉', `Le fichier "${file.name}" a été uploadé sur le serveur NestJS et sera joint aux prochains envois.`);
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'upload du CV");
    } finally {
      setUploadingCv(false);
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Section 1 : Connexion Serveur PC / Tailscale */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="server-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Connexion Serveur</Text>
          </View>

          <Text style={styles.fieldLabel}>URL du serveur NestJS</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://100.x.y.z:3000 ou http://192.168.x.y:3000"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Clé d'API statique (x-api-key)</Text>
          <TextInput
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
            pour être joint automatiquement aux candidatures et relances.
          </Text>

          <View style={styles.cvCard}>
            <Ionicons
              name={hasCv ? 'document-attach' : 'alert-circle-outline'}
              size={28}
              color={hasCv ? Colors.success : Colors.warning}
            />
            <View style={styles.cvInfo}>
              <Text style={styles.cvStatus}>
                {hasCv ? 'CV actif sur le serveur' : 'Aucun CV enregistré'}
              </Text>
              <Text style={styles.cvName} numberOfLines={1}>
                {activeCvName || 'Veuillez sélectionner un fichier PDF'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.cvButton, uploadingCv && styles.buttonDisabled]}
            onPress={handlePickAndUploadCv}
            disabled={uploadingCv}
            activeOpacity={0.8}
          >
            {uploadingCv ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.cvButtonText}>
                  {hasCv ? 'Remplacer le CV (PDF)' : 'Importer un CV (PDF)'}
                </Text>
              </>
            )}
          </TouchableOpacity>
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
              <TextInput
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
                {pushToken ? 'Notifications activées' : 'Token non synchronisé'}
              </Text>
              <Text style={styles.cvName} numberOfLines={1}>
                {pushToken || 'Appuyez ci-dessous pour autoriser et lier ce téléphone'}
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
      </ScrollView>
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
  buttonDisabled: {
    opacity: 0.6,
  },
});
