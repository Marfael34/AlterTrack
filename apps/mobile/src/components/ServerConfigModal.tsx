import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { StorageService } from '../services/storage.service';
import { CenteredTextInput } from './KeyboardAwareCenteredScrollView';

interface ServerConfigModalProps {
  visible: boolean;
  onClose: () => void;
  currentUrl: string;
  onSave: (newUrl: string) => void;
}

export default function ServerConfigModal({
  visible,
  onClose,
  currentUrl,
  onSave,
}: ServerConfigModalProps) {
  const [url, setUrl] = useState(currentUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await StorageService.setServerUrl(cleanUrl);
      const response = await fetch(`${cleanUrl}/health`, {
        headers: {
          'x-api-key': process.env.EXPO_PUBLIC_API_KEY || '',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} sur ${cleanUrl}/health`);
      }

      const health = await response.json();
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
        message: `Erreur (${cleanUrl}) : ${err?.message || 'Échec réseau'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="server-outline" size={20} color="#6366F1" style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Configuration API</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalDescription}>
            Définissez l'URL de votre backend NestJS pour synchroniser vos candidatures en temps réel.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>URL du Serveur</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://api.altertrack.render.com"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {testResult === 'success' && (
            <View style={[styles.alertBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={[styles.alertText, { color: '#10B981' }]}>Connexion au serveur établie avec succès !</Text>
            </View>
          )}

          {testResult === 'error' && (
            <View style={[styles.alertBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={[styles.alertText, { color: '#EF4444' }]}>Impossible de joindre le serveur.</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestConnection}
              disabled={testing}
              activeOpacity={0.8}
            >
              <Text style={styles.testButtonText}>{testing ? 'Test en cours...' : 'Tester'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
                onSave(url);
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  modalDescription: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 20,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 14,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    fontSize: 13,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#1F2937',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  testButtonText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 14,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});