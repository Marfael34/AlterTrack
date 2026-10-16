import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { ApiService } from '../services/api.service';
import { StorageService } from '../services/storage.service';

interface EmailPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  companyName: string;
  nature?: 'FIRST_CONTACT' | 'FOLLOW_UP';
  hasCv?: boolean;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  visible,
  onClose,
  companyName,
  nature = 'FIRST_CONTACT',
  hasCv = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    isSimulation: boolean;
    recipient: string;
    note: string;
    attachmentName: string | null;
  } | null>(null);

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
                  hasCv ? styles.cvBadgeSuccess : styles.cvBadgeWarning,
                ]}
              >
                <Ionicons
                  name={hasCv ? 'attach-outline' : 'warning-outline'}
                  size={16}
                  color={hasCv ? Colors.success : Colors.warning}
                />
                <Text
                  style={[
                    styles.cvBadgeText,
                    { color: hasCv ? Colors.success : Colors.warning },
                  ]}
                >
                  {hasCv
                    ? 'Le CV (PDF) sera joint automatiquement'
                    : 'Attention : aucun CV uploadé sur le serveur'}
                </Text>
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
  cvBadgeText: {
    fontSize: 12,
    fontWeight: '600',
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
