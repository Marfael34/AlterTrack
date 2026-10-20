import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AddressFieldAssistant } from '../components/AddressFieldAssistant';
import { EmailPreviewModal } from '../components/EmailPreviewModal';
import {
  CenteredTextInput,
  KeyboardAwareCenteredScrollView,
} from '../components/KeyboardAwareCenteredScrollView';
import { ReferencePointModal } from '../components/ReferencePointModal';
import { StatusBadge } from '../components/StatusBadge';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { AlertService as Alert } from '../services/alert.service';
import { ApiService } from '../services/api.service';
import { LocationService, ReferencePoint } from '../services/location.service';
import { STATUS_LABELS, Company, Status } from '../types/company';

interface CompanyDetailScreenProps {
  company: Company;
  onBack: () => void;
  onUpdated: () => void;
  refPoint?: ReferencePoint | null;
  onUpdateRefPoint?: (point: ReferencePoint | null) => void;
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
  refPoint: propRefPoint,
  onUpdateRefPoint,
}) => {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company>(initialCompany);
  const [name, setName] = useState(initialCompany.name);
  const [address, setAddress] = useState(initialCompany.address || '');
  const [city, setCity] = useState(initialCompany.city || '');
  const [latitude, setLatitude] = useState<number | undefined>(
    typeof initialCompany.latitude === 'number' ? initialCompany.latitude : undefined,
  );
  const [longitude, setLongitude] = useState<number | undefined>(
    typeof initialCompany.longitude === 'number' ? initialCompany.longitude : undefined,
  );
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
  const [sendingInitial, setSendingInitial] = useState(false);
  const [refPoint, setRefPoint] = useState<ReferencePoint | null>(propRefPoint || null);
  const [isRefPointModalOpen, setIsRefPointModalOpen] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const scrollViewRef = useRef<any>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleNotesFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  React.useEffect(() => {
    if (propRefPoint !== undefined) {
      setRefPoint(propRefPoint);
    }
  }, [propRefPoint]);

  React.useEffect(() => {
    void (async () => {
      let activePoint = refPoint;
      if (!activePoint) {
        activePoint = await LocationService.getReferencePoint();
        setRefPoint(activePoint);
      }
      if (activePoint) {
        const d = await LocationService.getDistanceToCompany(initialCompany, activePoint);
        setDistanceKm(d);
      }
    })();
  }, [initialCompany, refPoint]);

  useEffect(() => {
    if (
      refPoint &&
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !isNaN(latitude) &&
      !isNaN(longitude)
    ) {
      const d = LocationService.calculateDistanceKm(
        refPoint.latitude,
        refPoint.longitude,
        latitude,
        longitude,
      );
      setDistanceKm(d);
    }
  }, [refPoint, latitude, longitude]);

  const handleSaveRefPoint = async (newPoint: ReferencePoint | null) => {
    setRefPoint(newPoint);
    if (onUpdateRefPoint) {
      onUpdateRefPoint(newPoint);
    }
    if (newPoint) {
      const d = await LocationService.getDistanceToCompany(company, newPoint);
      setDistanceKm(d);
    } else {
      setDistanceKm(null);
    }
  };

  const handleOpenMaps = () => {
    const destination = address || city || company.name;
    if (!destination) return;
    const encoded = encodeURIComponent(destination);
    const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', "Impossible d'ouvrir l'application de cartographie");
    });
  };

  const isReplyReceived = status === 'REPLY_RECEIVED';

  const handleCall = () => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {
        Alert.alert('Erreur', "Impossible de lancer l'appel téléphonique");
      });
    }
  };

  const handleOpenGmailApp = async () => {
    const targetEmail = email.trim() || company.email;
    if (!targetEmail || targetEmail.endsWith('@sans-email.altertrack')) {
      Alert.alert(
        'Adresse e-mail requise',
        'Veuillez renseigner une adresse e-mail valide pour cette entreprise.',
      );
      return;
    }

    const subject = `Candidature Alternance — ${company.name}`;
    const gmailAppUrl = `googlegmail:///co?to=${encodeURIComponent(targetEmail)}&subject=${encodeURIComponent(subject)}`;
    const mailtoUrl = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}`;

    try {
      const canOpenGmail = await Linking.canOpenURL(gmailAppUrl).catch(() => false);
      if (canOpenGmail) {
        await Linking.openURL(gmailAppUrl);
      } else {
        await Linking.openURL(mailtoUrl);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application Gmail.');
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
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        latitude,
        longitude,
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

  const handleSendInitial = () => {
    const targetEmail = email.trim() || company.email;
    if (!targetEmail || targetEmail.endsWith('@sans-email.altertrack')) {
      Alert.alert(
        'Adresse e-mail requise',
        'Veuillez d\'abord renseigner une adresse e-mail valide pour cette entreprise.',
      );
      return;
    }

    const cvNotice = user?.hasCv
      ? `\n\n📎 Pièce jointe : Votre CV (${user.cvOriginalName || 'CV.pdf'}) sera joint automatiquement.`
      : `\n\n⚠️ Attention : Aucun CV n'est stocké dans l'application. La candidature partira sans pièce jointe.`;

    Alert.alert(
      'Envoi de la candidature',
      `Confirmez-vous l'envoi de votre candidature personnalisée à ${company.name} (${targetEmail}) ?${cvNotice}`,
      [
        { text: 'Annuler', style: 'cancel' },
        ...(!user?.hasCv
          ? [
              {
                text: 'Aperçu & Ajouter CV 📎',
                onPress: () => setIsPreviewModalOpen(true),
              },
            ]
          : []),
        {
          text: 'Envoyer maintenant',
          onPress: async () => {
            setSendingInitial(true);
            try {
              const res = await ApiService.sendInitialSingle(company.id);
              setCompany(res.company);
              setStatus(res.company.status);
              onUpdated();
              const attachMsg = res.hasAttachment
                ? ` (avec votre CV ${res.attachmentName || ''} joint)`
                : '';
              if (res.isSimulation) {
                Alert.alert(
                  'Candidature marquée (Mode Simulation) 🧪',
                  `La candidature pour ${company.name} a bien été enregistrée et marquée "En attente de réponse"${attachMsg}.\n\n⚠️ Vos identifiants Gmail SMTP ne sont pas encore configurés pour l'envoi réel. Rendez-vous dans Paramètres > Mon Compte & Envoi Gmail pour saisir votre mot de passe d'application Google (16 lettres), ou utilisez le bouton "Gmail" pour envoyer directement depuis votre application mobile.`,
                );
              } else {
                Alert.alert(
                  'Candidature envoyée ✅',
                  `Votre e-mail de candidature a été expédié avec succès depuis Gmail à ${company.name}${attachMsg} !`,
                );
              }
            } catch (err: any) {
              Alert.alert(
                'Échec de l\'envoi',
                err?.message || 'Erreur lors de l\'envoi de la candidature',
              );
            } finally {
              setSendingInitial(false);
            }
          },
        },
      ],
    );
  };

  const handleSendCustomToCompany = async (
    customSubject: string,
    customBody: string,
  ) => {
    setSendingInitial(true);
    try {
      const res = await ApiService.sendInitialSingle(
        company.id,
        customSubject,
        customBody,
      );
      setCompany(res.company);
      setStatus(res.company.status);
      onUpdated();
      setIsPreviewModalOpen(false);
      if (res.isSimulation) {
        Alert.alert(
          'Candidature marquée (Mode Simulation) 🧪',
          `La candidature pour ${company.name} a bien été enregistrée et marquée "En attente de réponse".\n\n⚠️ Vos identifiants Gmail SMTP ne sont pas encore configurés pour l'envoi réel. Rendez-vous dans Paramètres > Mon Compte & Envoi Gmail pour saisir votre mot de passe d'application Google (16 lettres), ou utilisez le bouton "Ouvrir dans l'app Gmail".`,
        );
      } else {
        Alert.alert(
          'Candidature envoyée ✅',
          `Votre e-mail de candidature a été expédié avec succès depuis Gmail à ${company.name} !`,
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Échec de l\'envoi',
        err?.message || 'Erreur lors de l\'envoi de la candidature',
      );
      throw err;
    } finally {
      setSendingInitial(false);
    }
  };

  const handleSendFollowUp = () => {
    const cvNotice = user?.hasCv
      ? `\n\n📎 Votre CV (${user.cvOriginalName || 'CV.pdf'}) sera joint au mail de relance.`
      : '';

    Alert.alert(
      'Envoi de la relance',
      `Confirmez-vous la génération par IA et l'envoi du mail de relance à ${company.name} ?${cvNotice}`,
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
              Alert.alert('Relance envoyée ✅', 'Le mail de relance avec votre CV joint a été expédié avec succès.');
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

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <KeyboardAwareCenteredScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
        >
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

        {/* Bannière de prévisualisation et envoi pour candidature à envoyer */}
        {status === 'TO_SEND' && (
          <View style={styles.toSendBanner}>
            <View style={styles.toSendHeaderRow}>
              <Ionicons name="sparkles" size={17} color={Colors.accent} />
              <Text style={styles.toSendTitle}>Candidature en attente d'envoi</Text>
            </View>
            <Text style={styles.toSendSubtitle}>
              Envoyez votre candidature personnalisée avec votre CV directement à cette entreprise, ou prévisualisez l'e-mail au préalable.
            </Text>
            <View style={styles.toSendActionsRow}>
              <TouchableOpacity
                style={[
                  styles.sendInitialBtn,
                  sendingInitial && styles.buttonDisabled,
                ]}
                onPress={handleSendInitial}
                disabled={sendingInitial}
                activeOpacity={0.8}
              >
                {sendingInitial ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                    <Text style={styles.sendInitialBtnText}>
                      Envoyer la candidature
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewMailBtn}
                onPress={() => setIsPreviewModalOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="eye-outline" size={15} color={Colors.accent} />
                <Text style={styles.previewMailBtnText}>Aperçu / Test</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bouton de relance manuelle si À relancer */}
        {status === 'TO_FOLLOW_UP' && !company.followUpSentAt && (
          <View style={styles.followUpWrap}>
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
            <TouchableOpacity
              style={styles.followUpPreviewBtn}
              onPress={() => setIsPreviewModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="eye-outline" size={15} color={Colors.accent} />
              <Text style={styles.followUpPreviewBtnText}>Aperçu / Tester la relance</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Carte Localisation & Distance */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeaderRow}>
            <View style={styles.locationIconWrap}>
              <Ionicons name="location" size={20} color={Colors.accent} />
            </View>
            <View style={styles.locationInfoCol}>
              <Text style={styles.locationAddressText}>
                {address ? `${address}` : ''}
                {address && city ? ` • ${city}` : city || 'Localisation non renseignée'}
              </Text>
              {distanceKm !== null && refPoint ? (
                <TouchableOpacity
                  style={styles.locationDistanceRow}
                  onPress={() => setIsRefPointModalOpen(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={refPoint.isGps ? 'navigate' : 'home'}
                    size={13}
                    color={Colors.accent}
                  />
                  <Text style={styles.locationDistanceText}>
                    À {LocationService.formatDistance(distanceKm)} de {refPoint.label}
                  </Text>
                  <Ionicons name="create-outline" size={13} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.setRefPointBtn}
                  onPress={() => setIsRefPointModalOpen(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={14} color={Colors.primary} />
                  <Text style={styles.setRefPointText}>
                    Définir mon adresse fixe pour calculer la distance
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.openMapsButton}
            onPress={handleOpenMaps}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={15} color="#FFFFFF" />
            <Text style={styles.openMapsButtonText}>Ouvrir l'itinéraire (Plans / GPS)</Text>
          </TouchableOpacity>
        </View>

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
          <CenteredTextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Google France"
            placeholderTextColor={Colors.textMuted}
          />

          <AddressFieldAssistant
            address={address}
            city={city}
            latitude={latitude}
            longitude={longitude}
            onChangeAddress={setAddress}
            onChangeCity={setCity}
            onChangeCoordinates={({ latitude: lat, longitude: lng }) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
            refPoint={refPoint}
          />

          <View style={styles.emailLabelRow}>
            <Text style={styles.fieldLabelInline}>Adresse e-mail de contact *</Text>
            <View style={styles.inlineEmailActionsRow}>
              <TouchableOpacity
                style={styles.inlineGmailBtn}
                onPress={handleOpenGmailApp}
                activeOpacity={0.7}
              >
                <Ionicons name="mail" size={12} color="#EA4335" />
                <Text style={styles.inlineGmailText}>Gmail</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inlinePreviewBtn}
                onPress={() => setIsPreviewModalOpen(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="sparkles" size={12} color={Colors.accent} />
                <Text style={styles.inlinePreviewText}>Tester l'e-mail IA</Text>
              </TouchableOpacity>
            </View>
          </View>
          <CenteredTextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Ex: recrutement@entreprise.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
          <CenteredTextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Ex: 01 23 45 67 89"
            placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>Notes personnelles (Non transmis à l'IA)</Text>
          <CenteredTextInput
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
      </KeyboardAwareCenteredScrollView>
    </KeyboardAvoidingView>

      {/* Barre d'action rapide pour fermer le clavier */}
      {isKeyboardVisible && (
        <View style={styles.keyboardAccessoryBar}>
          <TouchableOpacity
            style={styles.dismissKeyBtn}
            onPress={() => Keyboard.dismiss()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-down" size={16} color={Colors.primary} />
            <Text style={styles.dismissKeyText}>Fermer le clavier</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de définition d'adresse fixe */}
      <ReferencePointModal
        visible={isRefPointModalOpen}
        onClose={() => setIsRefPointModalOpen(false)}
        currentPoint={refPoint}
        onSave={handleSaveRefPoint}
      />

      {/* Modal d'aperçu et test d'envoi IA */}
      <EmailPreviewModal
        visible={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        companyName={company.name}
        companyEmail={email || company.email}
        onSendToCompany={
          status === 'TO_SEND' ? handleSendCustomToCompany : undefined
        }
        nature={status === 'TO_FOLLOW_UP' ? 'FOLLOW_UP' : 'FIRST_CONTACT'}
        hasCv={user?.hasCv ?? false}
        cvOriginalName={user?.cvOriginalName}
      />
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
  toSendBanner: {
    backgroundColor: '#161F36',
    borderWidth: 1,
    borderColor: `${Colors.accent}50`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  toSendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toSendTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  toSendSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  toSendActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  sendInitialBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandBlue,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  sendInitialBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  previewMailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  previewMailBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  followUpWrap: {
    gap: 8,
    marginBottom: 16,
  },
  followUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.status.TO_FOLLOW_UP,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  followUpBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  followUpPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.accent}18`,
    borderWidth: 1,
    borderColor: `${Colors.accent}40`,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  followUpPreviewBtnText: {
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 12,
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
  emailLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 10,
  },
  fieldLabelInline: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  inlineEmailActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineGmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EA433518',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inlineGmailText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA4335',
  },
  inlinePreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.accent}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inlinePreviewText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
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
  locationCard: {
    backgroundColor: '#1E1B38',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: `${Colors.primary}60`,
    marginBottom: 20,
    gap: 12,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfoCol: {
    flex: 1,
    gap: 3,
  },
  locationAddressText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  locationDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationDistanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },
  locationHintText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandBlue,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  openMapsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  setRefPointBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${Colors.primary}18`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  setRefPointText: {
    color: Colors.primary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  keyboardAvoid: {
    flex: 1,
  },
  keyboardAccessoryBar: {
    backgroundColor: '#131B2E',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  dismissKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: `${Colors.primary}18`,
  },
  dismissKeyText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});

