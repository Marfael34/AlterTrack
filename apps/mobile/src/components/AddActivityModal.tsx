import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { CustomDatePicker } from './CustomDatePicker';

export interface ActivityChoice {
  type: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  defaultTitle: string;
}

export const PREDEFINED_ACTIVITY_TYPES: ActivityChoice[] = [
  {
    type: 'CALL',
    label: 'Appel téléphonique',
    icon: 'call',
    color: '#00D2C4',
    defaultTitle: 'Appel téléphonique passé',
  },
  {
    type: 'INTERVIEW_HR',
    label: 'Entretien RH',
    icon: 'people',
    color: '#00F099',
    defaultTitle: 'Entretien RH réalisé',
  },
  {
    type: 'INTERVIEW_TECH',
    label: 'Entretien Tech',
    icon: 'code-slash',
    color: '#10B981',
    defaultTitle: 'Entretien Technique passé',
  },
  {
    type: 'LINKEDIN',
    label: 'Relance LinkedIn',
    icon: 'share-social',
    color: '#0A66C2',
    defaultTitle: 'Prise de contact LinkedIn',
  },
  {
    type: 'DIRECT_MAIL',
    label: 'Mail direct',
    icon: 'mail',
    color: '#0066FF',
    defaultTitle: 'Mail direct envoyé',
  },
  {
    type: 'HAND_DELIVERED',
    label: 'Déposé en main propre',
    icon: 'hand-right',
    color: '#EC4899',
    defaultTitle: 'Candidature déposée en main propre',
  },
  {
    type: 'NOTE',
    label: 'Note libre',
    icon: 'document-text',
    color: '#8B5CF6',
    defaultTitle: 'Note de suivi',
  },
];

interface AddActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (activity: {
    type: string;
    title: string;
    description?: string;
    performedAt?: string;
  }) => Promise<void>;
  companyName: string;
}

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  visible,
  onClose,
  onSave,
  companyName,
}) => {
  const [selectedType, setSelectedType] = useState<string>('CALL');
  const [title, setTitle] = useState<string>(PREDEFINED_ACTIVITY_TYPES[0].defaultTitle);
  const [description, setDescription] = useState<string>('');
  const [performedDate, setPerformedDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState<boolean>(false);

  const handleSelectType = (choice: ActivityChoice) => {
    setSelectedType(choice.type);
    setTitle(choice.defaultTitle);
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      await onSave({
        type: selectedType,
        title: title.trim(),
        description: description.trim() || undefined,
        performedAt: performedDate.toISOString(),
      });

      // Réinitialisation
      setDescription('');
      setPerformedDate(new Date());
      onClose();
    } catch {
      // Géré par l'appelant
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerIconWrapper}>
                  <Ionicons name="time" size={20} color={Colors.accent} />
                </View>
                <View style={styles.headerContent}>
                  <Text style={styles.headerTitle}>Ajouter une action</Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {companyName}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Catégories rapides */}
                <Text style={styles.inputLabel}>Type d'action</Text>
                <View style={styles.typesGrid}>
                  {PREDEFINED_ACTIVITY_TYPES.map((choice) => {
                    const isSelected = selectedType === choice.type;
                    return (
                      <TouchableOpacity
                        key={choice.type}
                        style={[
                          styles.typeChip,
                          isSelected && {
                            backgroundColor: `${choice.color}22`,
                            borderColor: choice.color,
                          },
                        ]}
                        onPress={() => handleSelectType(choice)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={choice.icon}
                          size={15}
                          color={isSelected ? choice.color : Colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.typeChipText,
                            isSelected && {
                              color: choice.color,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {choice.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Champ Titre */}
                <Text style={styles.inputLabel}>Intitulé de l'action *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ex: Entretien téléphonique avec M. Dupont"
                  placeholderTextColor={Colors.textMuted}
                />

                {/* Date et heure de l'action avec calendrier */}
                <CustomDatePicker
                  value={performedDate}
                  onChange={setPerformedDate}
                  label="Date de l'action"
                />

                {/* Notes et compte-rendu */}
                <Text style={styles.inputLabel}>Notes ou compte-rendu (Optionnel)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Ex: Échange très positif sur le profil Alternant Dev. Prochaine étape : test technique jeudi prochain."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </ScrollView>

              {/* Bouton d'action */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (!title.trim() || saving) && styles.submitBtnDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!title.trim() || saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Enregistrer dans l'historique</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${Colors.accent}1A`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: `${Colors.textSecondary}15`,
  },
  formScroll: {
    maxHeight: 520,
  },
  formScrollContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 6,
  },
  typeChipText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
    lineHeight: 20,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 6,
  },
  timeOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  timeOptionTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
