import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { ApiService } from '../services/api.service';
import { StorageService } from '../services/storage.service';
import { CenteredTextInput } from './KeyboardAwareCenteredScrollView';

interface ServerConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (url: string) => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  visible,
  onClose,
  onSaved,
}) => {
  const [serverUrl, setServerUrl] = useState('');
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [localWifiUrl, setLocalWifiUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      void (async () => {
        const current = await StorageService.getServerUrl();
        setServerUrl(current);
        setTunnelUrl(StorageService.getTunnelUrl());
        setLocalWifiUrl(StorageService.getLocalWifiUrl());
        setTestResult(null);
      })();
    }
  }, [visible]);

  const handleTestAndSave = async () => {
    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      setTestResult({
        success: false,
        message: 'Veuillez saisir une URL de serveur valide.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      await StorageService.setServerUrl(cleanUrl);
      const health = await ApiService.checkHealth();
      setTestResult({
        success: true,
        message: `Connexion réussie ! API : ${health.status} | Base : ${health.database}`,
      });
      if (onSaved) {
        onSaved(cleanUrl);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message:
          err?.message ||
          'Impossible de joindre le serveur. Vérifiez que Docker est allumé et l’URL exacte.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="server-outline" size={22} color={Colors.brandCyan} />
                <Text style={styles.headerTitle}>Configuration Serveur (Dev)</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>
              Définissez l’adresse URL de l’API NestJS pour connecter l’application.
            </Text>

            {/* Input URL */}
            <Text style={styles.label}>URL du serveur</Text>
            <CenteredTextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={(text) => {
                setServerUrl(text);
                setTestResult(null);
              }}
              placeholder="https://...trycloudflare.com ou http://192.168.x.y:3000"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Quick Presets */}
            <Text style={styles.subLabel}>Raccourcis rapides :</Text>
            <View style={styles.presetsRow}>
              {tunnelUrl ? (
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    serverUrl === tunnelUrl && styles.presetChipActive,
                  ]}
                  onPress={() => {
                    setServerUrl(tunnelUrl);
                    setTestResult(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="globe-outline"
                    size={14}
                    color={serverUrl === tunnelUrl ? '#FFFFFF' : Colors.brandCyan}
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

              {localWifiUrl ? (
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    serverUrl === localWifiUrl && styles.presetChipActive,
                  ]}
                  onPress={() => {
                    setServerUrl(localWifiUrl);
                    setTestResult(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="wifi-outline"
                    size={14}
                    color={serverUrl === localWifiUrl ? '#FFFFFF' : Colors.primary}
                  />
                  <Text
                    style={[
                      styles.presetChipText,
                      serverUrl === localWifiUrl && styles.presetChipTextActive,
                    ]}
                  >
                    Wi-Fi local (PC)
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Test Feedback Result */}
            {testResult && (
              <View
                style={[
                  styles.resultBox,
                  testResult.success ? styles.resultSuccess : styles.resultError,
                ]}
              >
                <Ionicons
                  name={
                    testResult.success
                      ? 'checkmark-circle-outline'
                      : 'alert-circle-outline'
                  }
                  size={20}
                  color={testResult.success ? Colors.success : Colors.danger}
                />
                <Text
                  style={[
                    styles.resultText,
                    testResult.success
                      ? styles.resultTextSuccess
                      : styles.resultTextError,
                  ]}
                >
                  {testResult.message}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Fermer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  testing && styles.saveBtnDisabled,
                ]}
                onPress={handleTestAndSave}
                disabled={testing}
                activeOpacity={0.8}
              >
                {testing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Tester & Enregistrer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  modalCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 18,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    marginBottom: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetChipActive: {
    backgroundColor: Colors.surfaceHighlight,
    borderColor: Colors.brandCyan,
  },
  presetChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  presetChipTextActive: {
    color: Colors.brandCyan,
    fontWeight: '700',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  resultSuccess: {
    backgroundColor: 'rgba(0, 240, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 153, 0.3)',
  },
  resultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  resultText: {
    fontSize: 13,
    flex: 1,
  },
  resultTextSuccess: {
    color: Colors.success,
  },
  resultTextError: {
    color: Colors.danger,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
