import React, { useEffect, useState } from 'react';
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
import { CompanyActivity } from '../types/company';
import { CustomDatePicker } from './CustomDatePicker';

interface EditActivityModalProps {
  visible: boolean;
  activity: CompanyActivity | null;
  onClose: () => void;
  onSave: (
    activityId: string,
    data: {
      performedAt: string;
      title?: string;
      description?: string;
    },
  ) => Promise<void>;
}

export const EditActivityModal: React.FC<EditActivityModalProps> = ({
  visible,
  activity,
  onClose,
  onSave,
}) => {
  const [performedDate, setPerformedDate] = useState<Date>(new Date());
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (activity) {
      setTitle(activity.title || '');
      setDescription(activity.description || '');
      const parsed = new Date(activity.performedAt);
      setPerformedDate(isNaN(parsed.getTime()) ? new Date() : parsed);
    }
  }, [activity]);

  if (!activity) return null;

  const handleSave = async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      await onSave(activity.id, {
        performedAt: performedDate.toISOString(),
        title: title.trim(),
        description: description.trim() || undefined,
      });
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
              {/* En-tête */}
              <View style={styles.header}>
                <View style={styles.headerIconWrapper}>
                  <Ionicons name="calendar" size={20} color={Colors.accent} />
                </View>
                <View style={styles.headerContent}>
                  <Text style={styles.headerTitle}>Modifier la date</Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {activity.title}
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
                {/* Sélecteur de date interactif */}
                <CustomDatePicker
                  value={performedDate}
                  onChange={setPerformedDate}
                  label="Date & Heure de l'action"
                />

                {/* Titre */}
                <Text style={styles.inputLabel}>Titre de l'action</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Titre de l'action"
                  placeholderTextColor={Colors.textMuted}
                />

                {/* Description */}
                <Text style={styles.inputLabel}>Notes ou compte-rendu</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Notes complémentaires"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
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
                      <Text style={styles.submitBtnText}>Enregistrer la modification</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: `${Colors.border}80`,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: `${Colors.border}80`,
  },
  headerIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: `${Colors.accent}20`,
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
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: `${Colors.textSecondary}15`,
  },
  formScroll: {
    maxHeight: 480,
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
    minHeight: 80,
    lineHeight: 20,
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
