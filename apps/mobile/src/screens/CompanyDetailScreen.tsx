import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBadge } from '../components/StatusBadge';
import { Colors } from '../constants/colors';
import { ApiService } from '../services/api.service';
import { STATUS_LABELS, Company, Status } from '../types/company';

interface CompanyDetailScreenProps {
  company: Company;
  onBack: () => void;
  onUpdated: () => void;
}

const ALL_STATUSES: Status[] = [
  'TO_SEND',
  'WAITING_FOR_REPLY',
  'TO_FOLLOW_UP',
  'REPLY_RECEIVED',
  'TO_CALL',
  'ACCEPTED',
  'REFUSED',
];

export const CompanyDetailScreen: React.FC<CompanyDetailScreenProps> = ({
  company: initialCompany,
  onBack,
  onUpdated,
}) => {
  const [company, setCompany] = useState<Company>(initialCompany);
  const [name, setName] = useState(initialCompany.name);
  const [city, setCity] = useState(initialCompany.city || '');
  const [email, setEmail] = useState(
    initialCompany.email?.endsWith('@sans-email.altertrack')
      ? ''
      : initialCompany.email || '',
  );
  const [phone, setPhone] = useState(initialCompany.phone || '');
  const [notes, setNotes] = useState(initialCompany.notes || '');
  const [status, setStatus] = useState<Status>(initialCompany.status);
  const [saving, setSaving] = useState(false);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);

  const isReplyReceived = status === 'REPLY_RECEIVED';

  const handleCall = () => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {
        Alert.alert('Erreur', "Impossible de lancer l'appel téléphonique");
      });
    }
  };

  const handleUpdateStatus = async (newStatus: Status) => {
    try {
      const updated = await ApiService.updateCompanyStatus(company.id, newStatus);
      setStatus(newStatus);
      setCompany(updated);
      onUpdated();
      Alert.alert('Statut mis à jour', `La fiche est désormais : ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la mise à jour');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', "Le nom de l'entreprise est obligatoire");
      return;
    }

    const emailToSave =
      email.trim() ||
      company.email ||
      `contact.${company.id.slice(0, 8)}@sans-email.altertrack`;

    setSaving(true);
    try {
      const updated = await ApiService.updateCompany(company.id, {
        name: name.trim(),
        city: city.trim() || undefined,
        email: emailToSave,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (status !== company.status) {
        await ApiService.updateCompanyStatus(company.id, status);
      }

      setCompany(updated);
      onUpdated();
      Alert.alert('Succès', 'Fiche entreprise enregistrée avec succès');
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSendFollowUp = () => {
    Alert.alert(
      'Envoi de la relance',
      `Confirmez-vous la génération par IA et l'envoi du mail de relance avec votre CV à ${company.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer la relance',
          onPress: async () => {
            setSendingFollowUp(true);
            try {
              const updated = await ApiService.sendFollowUp(company.id);
              setCompany(updated);
              setStatus(updated.status);
              onUpdated();
              Alert.alert('Relance envoyée', 'Le mail de relance a été expédié avec succès.');
            } catch (err) {
              Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'envoi");
            } finally {
              setSendingFollowUp(false);
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Suppression',
      `Êtes-vous certain de vouloir supprimer définitivement la fiche de ${company.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteCompany(company.id);
              onUpdated();
              onBack();
            } catch (err) {
              Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec de la suppression');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {company.name}
        </Text>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* BANNIÈRE CONTEXTUELLE : RÉPONSE REÇUE (Section 3.7 du CDC) */}
        {isReplyReceived && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerHeader}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.replyBannerTitle}>Réponse reçue !</Text>
            </View>
            <Text style={styles.replyBannerText}>
              Le recruteur a répondu à votre candidature. Choisissez la décision finale :
            </Text>
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => void handleUpdateStatus('ACCEPTED')}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.refuseBtn]}
                onPress={() => void handleUpdateStatus('REFUSED')}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Refuser</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Action téléphonique directe si À appeler */}
        {phone.length > 0 && (
          <TouchableOpacity
            style={[
              styles.callBanner,
              status === 'TO_CALL' && styles.callBannerProminent,
            ]}
            onPress={handleCall}
            activeOpacity={0.8}
          >
            <Ionicons
              name="call"
              size={20}
              color={status === 'TO_CALL' ? '#FFFFFF' : Colors.status.TO_CALL}
            />
            <Text
              style={[
                styles.callBannerText,
                status === 'TO_CALL' && styles.callBannerTextProminent,
              ]}
            >
              Appeler {phone}
            </Text>
          </TouchableOpacity>
        )}

        {/* Bouton de relance manuelle si À relancer */}
        {status === 'TO_FOLLOW_UP' && !company.followUpSentAt && (
          <TouchableOpacity
            style={styles.followUpBtn}
            onPress={handleSendFollowUp}
            disabled={sendingFollowUp}
            activeOpacity={0.8}
          >
            {sendingFollowUp ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                <Text style={styles.followUpBtnText}>Envoyer la relance maintenant</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Sélecteur de statut */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statut actuel</Text>
          <View style={styles.statusChipsContainer}>
            {ALL_STATUSES.map((st) => {
              const isCurrent = status === st;
              const color = Colors.status[st];
              return (
                <TouchableOpacity
                  key={st}
                  style={[
                    styles.statusChip,
                    isCurrent && {
                      backgroundColor: `${color}30`,
                      borderColor: color,
                    },
                  ]}
                  onPress={() => setStatus(st)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusDot, { backgroundColor: color }]} />
                  <Text
                    style={[
                      styles.statusChipText,
                      isCurrent && { color, fontWeight: '700' },
                    ]}
                  >
                    {STATUS_LABELS[st]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Formulaire des informations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de l'entreprise</Text>

          <Text style={styles.fieldLabel}>Nom de l'entreprise *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Google France"
            placeholderTextColor={Colors.textMuted}
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
            placeholder="Ex: recrutement@entreprise.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Ex: 01 23 45 67 89"
            placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>Notes personnelles (Non transmis à l'IA)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes internes, nom du responsable RH, détails de l'offre..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Dates du cycle */}
        <View style={styles.datesCard}>
          <Text style={styles.datesTitle}>Historique du cycle</Text>
          <Text style={styles.dateRow}>
            Création de la fiche :{' '}
            {new Date(company.createdAt).toLocaleDateString('fr-FR')}
          </Text>
          {company.firstMailSentAt && (
            <Text style={styles.dateRow}>
              Premier mail envoyé :{' '}
              {new Date(company.firstMailSentAt).toLocaleDateString('fr-FR')}
            </Text>
          )}
          {company.followUpSentAt && (
            <Text style={styles.dateRow}>
              Relance effectuée :{' '}
              {new Date(company.followUpSentAt).toLocaleDateString('fr-FR')}
            </Text>
          )}
          {company.lastMailId && (
            <Text style={styles.dateRowMuted}>
              Dernier ID email : {company.lastMailId}
            </Text>
          )}
        </View>

        {/* Bouton d'enregistrement */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
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
    flex: 1,
    marginHorizontal: 12,
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${Colors.danger}22`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  replyBanner: {
    backgroundColor: Colors.status.REPLY_RECEIVED,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.status.REPLY_RECEIVED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  replyBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  replyBannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  replyBannerText: {
    color: '#EDE9FE',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: Colors.success,
  },
  refuseBtn: {
    backgroundColor: Colors.danger,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  callBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.status.TO_CALL}20`,
    borderWidth: 1,
    borderColor: Colors.status.TO_CALL,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  callBannerProminent: {
    backgroundColor: Colors.status.TO_CALL,
  },
  callBannerText: {
    color: Colors.status.TO_CALL,
    fontWeight: '700',
    fontSize: 15,
  },
  callBannerTextProminent: {
    color: '#FFFFFF',
  },
  followUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.status.TO_FOLLOW_UP,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  followUpBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  statusChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
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
  datesCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  datesTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  dateRow: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  dateRowMuted: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
