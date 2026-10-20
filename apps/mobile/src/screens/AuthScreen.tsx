import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CenteredTextInput,
  KeyboardAwareCenteredScrollView,
} from '../components/KeyboardAwareCenteredScrollView';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [gmailUser, setGmailUser] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Veuillez renseigner votre adresse e-mail.');
      return;
    }
    if (!password) {
      setErrorMessage('Veuillez renseigner votre mot de passe.');
      return;
    }

    if (tab === 'REGISTER') {
      if (password.length < 6) {
        setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
        return;
      }
      if (!confirmPassword) {
        setErrorMessage('Veuillez confirmer votre mot de passe.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Les mots de passe ne correspondent pas.');
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === 'LOGIN') {
        await login({ email: cleanEmail, password });
      } else {
        await register({
          email: cleanEmail,
          password,
          fullName: fullName.trim() || undefined,
          gmailUser: gmailUser.trim() || undefined,
          gmailAppPassword: gmailAppPassword.trim() || undefined,
        });
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Une erreur est survenue lors de l\'authentification.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <KeyboardAwareCenteredScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* En-tête / Logo AlterTrack */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="briefcase" size={36} color={Colors.brandCyan} />
          </View>
          <Text style={styles.appTitle}>AlterTrack</Text>
          <Text style={styles.subtitle}>
            Plateforme intelligente de suivi & envoi de candidatures
          </Text>
        </View>

        {/* Card principale */}
        <View style={styles.card}>
          {/* Tabs Connexion / Inscription */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, tab === 'LOGIN' && styles.tabButtonActive]}
              onPress={() => {
                setTab('LOGIN');
                setErrorMessage(null);
                setConfirmPassword('');
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="log-in-outline"
                size={18}
                color={tab === 'LOGIN' ? Colors.brandCyan : Colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[styles.tabText, tab === 'LOGIN' && styles.tabTextActive]}
              >
                Connexion
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                tab === 'REGISTER' && styles.tabButtonActive,
              ]}
              onPress={() => {
                setTab('REGISTER');
                setErrorMessage(null);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="person-add-outline"
                size={18}
                color={tab === 'REGISTER' ? Colors.brandCyan : Colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabText,
                  tab === 'REGISTER' && styles.tabTextActive,
                ]}
              >
                Créer un compte
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bannière d'erreur si présente */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={Colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Champs du formulaire */}
          {tab === 'REGISTER' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nom complet</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={Colors.textMuted}
                  style={styles.inputIcon}
                />
                <CenteredTextInput
                  style={styles.input}
                  placeholder="ex: Rafael Martinez"
                  placeholderTextColor={Colors.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Adresse e-mail</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={Colors.textMuted}
                style={styles.inputIcon}
              />
              <CenteredTextInput
                style={styles.input}
                placeholder="candidat@domaine.fr"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={Colors.textMuted}
                style={styles.inputIcon}
              />
              <CenteredTextInput
                style={[styles.input, { color: '#FFFFFF' }]}
                placeholder={showPassword ? 'Votre mot de passe' : '••••••••'}
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={Colors.brandCyan}
                cursorColor={Colors.brandCyan}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={20}
                  color={showPassword ? Colors.brandCyan : Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirmation du mot de passe lors de l'inscription */}
          {tab === 'REGISTER' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <View
                style={[
                  styles.inputWrapper,
                  confirmPassword.length > 0 &&
                    password !== confirmPassword &&
                    styles.inputWrapperError,
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={
                    confirmPassword.length > 0 && password === confirmPassword
                      ? Colors.success
                      : Colors.textMuted
                  }
                  style={styles.inputIcon}
                />
                <CenteredTextInput
                  style={[styles.input, { color: '#FFFFFF' }]}
                  placeholder={
                    showConfirmPassword
                      ? 'Répétez le mot de passe'
                      : '••••••••'
                  }
                  placeholderTextColor={Colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={Colors.brandCyan}
                  cursorColor={Colors.brandCyan}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye' : 'eye-off'}
                    size={20}
                    color={
                      showConfirmPassword ? Colors.brandCyan : Colors.textMuted
                    }
                  />
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={styles.passwordMismatchText}>
                  Les mots de passe ne correspondent pas
                </Text>
              )}
            </View>
          )}

          {/* Configuration d'envoi Gmail optionnelle lors de l'inscription */}
          {tab === 'REGISTER' && (
            <View style={styles.optionalSection}>
              <TouchableOpacity
                style={styles.optionalToggle}
                onPress={() => setShowEmailConfig(!showEmailConfig)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name="logo-google"
                    size={16}
                    color={Colors.brandCyan}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.optionalTitle}>
                    Configurer mon e-mail d'envoi (optionnel)
                  </Text>
                </View>
                <Ionicons
                  name={showEmailConfig ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>

              {showEmailConfig && (
                <View style={styles.optionalBody}>
                  <Text style={styles.helperText}>
                    Permet d'envoyer vos candidatures et mails de test directement
                    avec votre compte personnel Gmail.
                  </Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.subLabel}>Compte Gmail</Text>
                    <View style={styles.inputWrapper}>
                      <CenteredTextInput
                        style={styles.input}
                        placeholder="votre.adresse@gmail.com"
                        placeholderTextColor={Colors.textMuted}
                        value={gmailUser}
                        onChangeText={setGmailUser}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.subLabel}>
                      Mot de passe d'application Google (16 lettres)
                    </Text>
                    <View style={styles.inputWrapper}>
                      <CenteredTextInput
                        style={styles.input}
                        placeholder="abcd efgh ijkl mnop"
                        placeholderTextColor={Colors.textMuted}
                        value={gmailAppPassword}
                        onChangeText={setGmailAppPassword}
                        secureTextEntry={!showAppPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowAppPassword(!showAppPassword)}
                        style={styles.eyeButton}
                      >
                        <Ionicons
                          name={showAppPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={Colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Bouton de validation */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.text} size="small" />
            ) : (
              <>
                <Ionicons
                  name={tab === 'LOGIN' ? 'arrow-forward' : 'checkmark-circle'}
                  size={20}
                  color={Colors.text}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.submitButtonText}>
                  {tab === 'LOGIN' ? 'Se connecter' : 'Créer mon compte'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <Text style={styles.footerNote}>
          Vos données de connexion et mots de passe d'application sont sécurisés et
          isolés pour chaque utilisateur.
        </Text>
      </KeyboardAwareCenteredScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.brandCyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: Colors.brandCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.text,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  inputWrapperError: {
    borderColor: Colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  passwordMismatchText: {
    color: Colors.danger,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 8,
  },
  optionalSection: {
    marginTop: 4,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  optionalToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  optionalTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brandCyan,
  },
  optionalBody: {
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  helperText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 10,
    lineHeight: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandBlue,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    shadowColor: Colors.brandBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 20,
    lineHeight: 16,
    paddingHorizontal: 16,
  },
});
