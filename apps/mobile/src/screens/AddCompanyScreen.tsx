import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
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
import { Status } from '../types/company';

interface AddCompanyScreenProps {
  onBack: () => void;
  onCreated: () => void;
}

export const AddCompanyScreen: React.FC<AddCompanyScreenProps> = ({
  onBack,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', "Le nom de l'entreprise est obligatoire");
      return;
    }
    if (!email.trim()) {
      Alert.alert('Validation', "L'adresse email est obligatoire");
      return;
    }

    setLoading(true);
    try {
      await ApiService.createCompany({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        status: 'TO_SEND' as Status,
      });

      Alert.alert('Succès', 'Fiche entreprise ajoutée avec le statut À envoyer !');
      onCreated();
      onBack();
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'ajout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle entreprise</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.fieldLabel}>Nom de l'entreprise *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: Capgemini, Thales, Startup..."
          placeholderTextColor={Colors.textMuted}
          autoFocus
        />

        <Text style={styles.fieldLabel}>Adresse e-mail de contact *</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Ex: rh@entreprise.com"
          placeholderTextColor={Colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Ex: 06 12 34 56 78 (pour l'étape d'appel)"
          placeholderTextColor={Colors.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={styles.fieldLabel}>Note / Description personnelle</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Texte libre strictement personnel (non transmis à l'IA)..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.infoText}>
            La fiche sera créée avec le statut « À envoyer ». Elle pourra être expédiée
            immédiatement via le bouton « Envoyer » en 1 clic.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.createButton, loading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.createButtonText}>Créer la fiche entreprise</Text>
          )}
        </TouchableOpacity>
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
  fieldLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${Colors.primary}18`,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
    marginBottom: 24,
    gap: 8,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  createButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
