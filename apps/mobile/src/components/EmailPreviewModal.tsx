import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api.service';
import { StorageService, formatStandardCvName } from '../services/storage.service';

interface EmailPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  companyName: string;
  companyEmail?: string;
  onSendToCompany?: (subject: string, body: string) => Promise<void>;
  nature?: 'FIRST_CONTACT' | 'FOLLOW_UP';
  hasCv?: boolean;
  cvOriginalName?: string | null;
  onCvUploaded?: () => void;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  visible,
  onClose,
  companyName,
  companyEmail,
  onSendToCompany,
  nature = 'FIRST_CONTACT',
  hasCv = true,
  cvOriginalName = null,
  onCvUploaded,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingToCompany, setSendingToCompany] = useState(false);
  const [currentHasCv, setCurrentHasCv] = useState(hasCv);
  const [currentCvName, setCurrentCvName] = useState(cvOriginalName);
  const [uploadingCvModal, setUploadingCvModal] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    isSimulation: boolean;
    recipient: string;
    note: string;
    attachmentName: string | null;
  } | null>(null);

  useEffect(() => {
    setCurrentHasCv(hasCv);
    setCurrentCvName(
      cvOriginalName || (hasCv ? formatStandardCvName(user?.fullName) : null),
    );
  }, [hasCv, cvOriginalName, user?.fullName]);

  useEffect(() => {
    if (visible && companyName) {
      void initModal();
    }
  }, [visible, companyName, nature]);

  const initModal = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const savedEmail = await StorageService.getTestEmail();
      if (savedEmail) {
        setTestEmail(savedEmail);
      }

      const preview = await ApiService.previewEmail(companyName, nature);
      setSubject(preview.subject);
      setBody(preview.body);
    } catch (err) {
      Alert.alert(
        'Erreur IA',
        err instanceof Error ? err.message : 'Impossible de générer l’aperçu du mail',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleModalPickCv = async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
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
      const standardName = formatStandardCvName(user?.fullName);

      setUploadingCvModal(true);

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
      setCurrentHasCv(true);
      setCurrentCvName(localInfo.fileName);

      if (onCvUploaded) {
        onCvUploaded();
      }

      Alert.alert(
        'CV stocké et joint ✅',
        `Le fichier "${localInfo.fileName}" est stocké et sera joint automatiquement à cet e-mail.`,
      );
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || "Échec de l'import du CV");
    } finally {
      setUploadingCvModal(false);
    }
  };

  const handleRegenerate = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const preview = await ApiService.previewEmail(companyName, nature);
      setSubject(preview.subject);
      setBody(preview.body);
    } catch (err) {
      Alert.alert(
        'Erreur IA',
        err instanceof Error ? err.message : 'Échec de la régénération',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    const trimmed = testEmail.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      Alert.alert(
        'Adresse e-mail invalide',
        'Veuillez renseigner votre adresse e-mail personnelle pour recevoir le test.',
      );
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    try {
      await StorageService.setTestEmail(trimmed);
      const res = await ApiService.sendTestEmail(
        trimmed,
        companyName,
        subject,
        body,
      );
      setTestResult({
        success: res.success,
        isSimulation: res.isSimulation,
        recipient: res.recipient,
        note: res.note,
        attachmentName: res.attachmentName,
      });

      if (res.isSimulation) {
        Alert.alert(
          'Simulation réussie 🧪',
          `L'e-mail a été préparé avec votre CV joint.\n\nMode simulation activé : renseignez GMAIL_USER et GMAIL_APP_PASSWORD dans le .env du serveur pour expédier réellement le mail à ${res.recipient}.`,
        );
      } else {
        Alert.alert(
          'E-mail expédié ! ✉️',
          `L'e-mail a été expédié à ${res.recipient} dans les conditions réelles d'une entreprise :\n- Objet : "${res.subject}"\n- Pièce jointe : CV inclus\n\nVérifiez la boîte de réception !`,
        );
      }
    } catch (err) {
      Alert.alert(
        'Échec de l’envoi',
        err instanceof Error ? err.message : 'Erreur lors de l’envoi du mail',
      );
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendToCompany = () => {
    if (!onSendToCompany) return;
    Alert.alert(
      'Envoi à l\'entreprise',
      `Confirmez-vous l'envoi de cet e-mail personnalisé avec votre CV à ${companyName} (${companyEmail || 'adresse de contact'}) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer maintenant',
          onPress: async () => {
            setSendingToCompany(true);
            try {
              await onSendToCompany(subject, body);
            } catch (err: any) {
              // géré par l'appelant
            } finally {
              setSendingToCompany(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenInGmail = async () => {
    const target = companyEmail?.trim() || '';
    if (!target || target.endsWith('@sans-email.altertrack')) {
      Alert.alert(
        'Adresse e-mail requise',
        'Veuillez renseigner une adresse e-mail valide pour cette entreprise.',
      );
      return;
    }

    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    const gmailAppUrl = `googlegmail:///co?to=${encodeURIComponent(target)}&subject=${encodedSubject}&body=${encodedBody}`;
    const mailtoUrl = `mailto:${encodeURIComponent(target)}?subject=${encodedSubject}&body=${encodedBody}`;

    try {
      const canOpenGmail = await Linking.canOpenURL(gmailAppUrl).catch(() => false);
      if (canOpenGmail) {
        await Linking.openURL(gmailAppUrl);
      } else {
        await Linking.openURL(mailtoUrl);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application de messagerie Gmail.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="sparkles" size={18} color={Colors.accent} />
                <Text style={styles.headerTitle} numberOfLines={1}>
                  Aperçu & Test de l'e-mail IA
                </Text>
              </View>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {nature === 'FOLLOW_UP' ? 'Relance J+15' : 'Premier contact'} • {companyName}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>
                Génération de l'e-mail personnalisé par Google Gemini...
              </Text>
              <Text style={styles.loadingSubtext}>
                Adaptation du modèle pour {companyName}
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Statut pièce jointe CV */}
              <View
                style={[
                  styles.cvBadgeRow,
                  currentHasCv ? styles.cvBadgeSuccess : styles.cvBadgeWarning,
                ]}
              >
                <Ionicons
                  name={currentHasCv ? 'document-attach' : 'warning-outline'}
                  size={18}
                  color={currentHasCv ? Colors.success : Colors.warning}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.cvBadgeTitle,
                      { color: currentHasCv ? Colors.success : Colors.warning },
                    ]}
                  >
                    {currentHasCv
                      ? 'CV joint automatiquement ✅'
                      : 'Aucun CV stocké dans l\'application ⚠️'}
                  </Text>
                  <Text style={styles.cvBadgeSubtext} numberOfLines={1}>
                    {currentHasCv
                      ? `Pièce jointe : ${currentCvName || 'CV.pdf'}`
                      : 'Votre candidature partira sans pièce jointe.'}
                  </Text>
                </View>

                {!currentHasCv && (
                  <TouchableOpacity
                    style={styles.modalUploadCvBtn}
                    onPress={handleModalPickCv}
                    disabled={uploadingCvModal}
                    activeOpacity={0.8}
                  >
                    {uploadingCvModal ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={13} color="#FFFFFF" />
                        <Text style={styles.modalUploadCvBtnText}>Importer</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Objet du mail */}
              <View style={styles.fieldBlock}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>Objet du mail (modifiable) :</Text>
                  <TouchableOpacity
                    style={styles.refreshChip}
                    onPress={handleRegenerate}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh" size={13} color={Colors.accent} />
                    <Text style={styles.refreshChipText}>Régénérer</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.subjectInput}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Objet du mail..."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {/* Corps du message */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Corps du message (modifiable) :</Text>
                <TextInput
                  style={styles.bodyInput}
                  value={body}
                  onChangeText={setBody}
                  placeholder="Corps du mail personnalisé..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                />
              </View>

              {/* Action Envoi Direct Entreprise & Gmail */}
              {onSendToCompany && (
                <View style={styles.directSendCard}>
                  <Text style={styles.directSendLabel}>
                    Prêt à envoyer votre candidature ?
                  </Text>
                  <View style={styles.directSendActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.sendToCompanyBtn,
                        sendingToCompany && styles.btnDisabled,
                      ]}
                      onPress={handleSendToCompany}
                      disabled={sendingToCompany}
                      activeOpacity={0.8}
                    >
                      {sendingToCompany ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                          <Text style={styles.sendToCompanyBtnText}>
                            Envoyer via AlterTrack (avec CV)
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.openGmailBtn}
                      onPress={handleOpenInGmail}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="mail" size={16} color="#FFFFFF" />
                      <Text style={styles.openGmailBtnText}>
                        Ouvrir dans l'application Gmail
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {companyEmail && (
                    <Text style={styles.directSendTargetText}>
                      Destinataire officiel : {companyEmail}
                    </Text>
                  )}
                </View>
              )}

              {/* Section Test d'envoi */}
              <View style={styles.testSectionCard}>
                <View style={styles.testHeaderRow}>
                  <Ionicons name="paper-plane-outline" size={18} color={Colors.primary} />
                  <Text style={styles.testTitle}>Envoyer à une adresse de test (Format Entreprise)</Text>
                </View>
                <Text style={styles.testDescription}>
                  Envoyez cet e-mail exact à l'adresse de votre choix. Le destinataire le recevra exactement comme une vraie entreprise (avec l'objet ci-dessus, le texte personnalisé et votre CV joint, sans mention de test).
                </Text>

                <TextInput
                  style={styles.testEmailInput}
                  value={testEmail}
                  onChangeText={setTestEmail}
                  placeholder="votre.email@gmail.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={[
                    styles.sendTestBtn,
                    sendingTest && styles.btnDisabled,
                  ]}
                  onPress={handleSendTestEmail}
                  disabled={sendingTest}
                  activeOpacity={0.8}
                >
                  {sendingTest ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.sendTestBtnText}>
                        Envoyer l'e-mail à cette adresse
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {testResult && (
                  <View
                    style={[
                      styles.resultBanner,
                      testResult.isSimulation
                        ? styles.resultSimulation
                        : styles.resultReal,
                    ]}
                  >
                    <Ionicons
                      name={
                        testResult.isSimulation
                          ? 'information-circle'
                          : 'checkmark-circle'
                      }
                      size={18}
                      color={testResult.isSimulation ? Colors.accent : Colors.success}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle}>
                        {testResult.isSimulation
                          ? 'Simulation validée'
                          : 'Test envoyé avec succès !'}
                      </Text>
                      <Text style={styles.resultText}>{testResult.note}</Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.footerCloseBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.footerCloseBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  modalContainer: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 30,
  },
  cvBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  cvBadgeSuccess: {
    backgroundColor: `${Colors.success}18`,
    borderColor: `${Colors.success}40`,
  },
  cvBadgeWarning: {
    backgroundColor: `${Colors.warning}18`,
    borderColor: `${Colors.warning}40`,
  },
  cvBadgeTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  cvBadgeSubtext: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  modalUploadCvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.status.TO_CALL,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  modalUploadCvBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  fieldBlock: {
    gap: 6,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.accent}18`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  refreshChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
  },
  subjectInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  bodyInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 13,
    lineHeight: 20,
    minHeight: 140,
    maxHeight: 220,
  },
  testSectionCard: {
    backgroundColor: '#161B2B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${Colors.primary}50`,
    gap: 10,
  },
  testHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  testDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  testEmailInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 13,
  },
  sendTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 11,
    gap: 8,
  },
  sendTestBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  resultSimulation: {
    backgroundColor: `${Colors.accent}15`,
    borderColor: `${Colors.accent}50`,
  },
  resultReal: {
    backgroundColor: `${Colors.success}15`,
    borderColor: `${Colors.success}50`,
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  resultText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  directSendCard: {
    backgroundColor: `${Colors.brandCyan}12`,
    borderWidth: 1.5,
    borderColor: `${Colors.brandCyan}50`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  directSendLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  directSendActionsRow: {
    gap: 8,
  },
  sendToCompanyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandBlue,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
    shadowColor: Colors.brandBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  sendToCompanyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  openGmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EA4335',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#EA4335',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  openGmailBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  directSendTargetText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  footerCloseBtn: {
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footerCloseBtnText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
});
