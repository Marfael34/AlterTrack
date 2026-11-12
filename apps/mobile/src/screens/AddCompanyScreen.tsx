import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AddCompanyScreenProps {
  navigation: any;
  route?: { params?: { initialData?: any } };
}

export default function AddCompanyScreen({ navigation, route }: AddCompanyScreenProps) {
  const initialData = route?.params?.initialData;

  const [name, setName] = useState(initialData?.name || '');
  const [position, setPosition] = useState(initialData?.position || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [status, setStatus] = useState(initialData?.status || 'applied');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const statuses = [
    { key: 'applied', label: 'Postulé', color: '#6366F1' },
    { key: 'interview', label: 'Entretien', color: '#F59E0B' },
    { key: 'offer', label: 'Offre', color: '#10B981' },
    { key: 'rejected', label: 'Refusé', color: '#EF4444' },
  ];

  const handleSave = () => {
    console.log({ name, position, city, status, notes });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{initialData ? 'Modifier l\'entreprise' : 'Nouvelle Candidature'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nom de l'entreprise *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Capgemini, Thales..."
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Intitulé du poste *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Développeur Full-Stack (Alternance)"
            placeholderTextColor="#475569"
            value={position}
            onChangeText={setPosition}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ville / Localisation</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Perpignan, Toulouse..."
            placeholderTextColor="#475569"
            value={city}
            onChangeText={setCity}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Statut actuel</Text>
          <View style={styles.statusChipsRow}>
            {statuses.map((item) => {
              const isSelected = status === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.statusChip,
                    isSelected && { backgroundColor: item.color, borderColor: item.color },
                  ]}
                  onPress={() => setStatus(item.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.statusChipText, isSelected && { color: '#FFFFFF', fontWeight: '600' }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notes & Suivi</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Contacts RH, retours d'entretiens..."
            placeholderTextColor="#475569"
            value={notes}
            onChangeText={setNotes}
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.submitButtonText}>Enregistrer</Text>
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
  formContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 14,
  },
  textArea: {
    height: 110,
    paddingTop: 12,
  },
  statusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  statusChipText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  submitButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});