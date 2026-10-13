import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
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

const STATUS_CHOICES: Array<{ key: Status; label: string; color: string }> = [
  { key: 'TO_SEND', label: 'À envoyer', color: Colors.status.TO_SEND },
  { key: 'WAITING_FOR_REPLY', label: 'En attente', color: Colors.status.WAITING_FOR_REPLY },
  { key: 'TO_FOLLOW_UP', label: 'À relancer', color: Colors.status.TO_FOLLOW_UP },
  { key: 'TO_CALL', label: 'À appeler', color: Colors.status.TO_CALL },
  { key: 'REPLY_RECEIVED', label: 'Réponse reçue', color: Colors.status.REPLY_RECEIVED },
  { key: 'REFUSED', label: 'Refusé', color: Colors.status.REFUSED },
  { key: 'ACCEPTED', label: 'Accepté', color: Colors.status.ACCEPTED },
];

export const AddCompanyScreen: React.FC<AddCompanyScreenProps> = ({
  onBack,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Status>('TO_SEND');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

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
        city: city.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
      });

      Alert.alert('Succès', 'Fiche entreprise ajoutée avec succès !');
      onCreated();
      onBack();
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'ajout");
    } finally {
      setLoading(false);
    }
  };

  const handlePickAndImportSpreadsheet = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      setImporting(true);

      const res = await ApiService.importSpreadsheet(
        file.uri,
        file.name,
        (file as unknown as { file?: unknown }).file,
      );

      let title = 'Importation réussie 🎉';
      let message = `${res.importedCount} entreprise(s) importée(s) avec succès !`;

      if (res.importedCount === 0) {
        title = 'Aucune entreprise importée ⚠️';
        message =
          res.errors.length > 0
            ? res.errors.slice(0, 4).join('\n')
            : "Aucune entreprise valide n'a été détectée. Vérifiez que votre tableau contient au moins une colonne Nom et une colonne Email.";
        Alert.alert(title, message);
      } else {
        if (res.skippedCount > 0) {
          message += `\n\n${res.skippedCount} ligne(s) ignorée(s) (doublons ou erreurs).`;
        }
        if (res.errors.length > 0) {
          message += `\n\nDétails :\n` + res.errors.slice(0, 3).join('\n');
          if (res.errors.length > 3) {
            message += `\n(+ ${res.errors.length - 3} autres)`;
          }
        }

        Alert.alert(title, message, [
          {
            text: 'Super !',
            onPress: () => {
              onCreated();
              onBack();
            },
          },
        ]);
      }
    } catch (err) {
      Alert.alert(
        'Erreur d’importation',
        err instanceof Error ? err.message : 'Échec de l’importation du fichier.',
      );
    } finally {
      setImporting(false);
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
        {/* Raccourci import tableur */}
        <TouchableOpacity
          style={[styles.importBanner, importing && styles.buttonDisabled]}
          onPress={handlePickAndImportSpreadsheet}
          disabled={importing}
          activeOpacity={0.8}
        >
          {importing ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <>
              <View style={styles.importIconCircle}>
                <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.importBannerTextContainer}>
                <Text style={styles.importBannerTitle}>
                  Importer depuis un tableur
                </Text>
                <Text style={styles.importBannerSubtitle}>
                  Fichier Excel (.xlsx, .xls) ou CSV en 1 clic
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OU SAISIE MANUELLE</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.fieldLabel}>Nom de l'entreprise *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: Capgemini, Thales, Startup..."
          placeholderTextColor={Colors.textMuted}
          autoFocus
        />

        <Text style={styles.fieldLabel}>Ville ou localisation</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="Ex: Paris, Lyon, Toulouse, En télétravail..."
          placeholderTextColor={Colors.textMuted}
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

        {/* Sélecteur de statut initial */}
        <Text style={styles.fieldLabel}>Statut initial</Text>
        <View style={styles.statusChipsContainer}>
          {STATUS_CHOICES.map((choice) => {
            const isSelected = status === choice.key;
            return (
              <TouchableOpacity
                key={choice.key}
                style={[
                  styles.statusChip,
                  isSelected && {
                    backgroundColor: `${choice.color}25`,
                    borderColor: choice.color,
                  },
                ]}
                onPress={() => setStatus(choice.key)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: choice.color },
                  ]}
                />
                <Text
                  style={[
                    styles.statusChipText,
                    isSelected && { color: '#FFFFFF', fontWeight: '700' },
                  ]}
                >
                  {choice.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
  importBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  importIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  importBannerTextContainer: {
    flex: 1,
  },
  importBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  importBannerSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
    marginBottom: 6,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
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
  statusChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  textArea: {
    minHeight: 90,
  },
  createButton: {
    backgroundColor: Colors.brandBlue,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: Colors.brandBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
