import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { AlertButton, AlertType, CustomAlertOptions } from '../services/alert.service';

interface CustomAlertModalProps {
  alert: CustomAlertOptions | null;
  onDismiss: () => void;
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  alert,
  onDismiss,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (alert) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-fermeture optionnelle
      if (alert.autoCloseMs && alert.autoCloseMs > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, alert.autoCloseMs);
        return () => clearTimeout(timer);
      }
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [alert]);

  if (!alert) return null;

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const handleButtonPress = (btn: AlertButton) => {
    handleDismiss();
    if (btn.onPress) {
      // Petite temporisation pour que l'animation de fermeture soit fluide
      setTimeout(() => {
        btn.onPress?.();
      }, 50);
    }
  };

  const type: AlertType = alert.type || 'INFO';

  // Configuration visuelle selon le type
  const config = {
    SUCCESS: {
      color: Colors.brandGreen,
      bgColor: '#00F09920',
      borderColor: Colors.brandGreen,
      iconName: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
      badgeLabel: 'SUCCÈS',
      btnBg: Colors.brandGreen,
      btnTextColor: '#0B0F19',
    },
    WARNING: {
      color: Colors.warning,
      bgColor: '#F59E0B20',
      borderColor: Colors.warning,
      iconName: 'warning' as keyof typeof Ionicons.glyphMap,
      badgeLabel: 'AVERTISSEMENT',
      btnBg: Colors.warning,
      btnTextColor: '#0B0F19',
    },
    ERROR: {
      color: Colors.danger,
      bgColor: '#EF444420',
      borderColor: Colors.danger,
      iconName: 'alert-circle' as keyof typeof Ionicons.glyphMap,
      badgeLabel: 'ATTENTION',
      btnBg: Colors.danger,
      btnTextColor: '#FFFFFF',
    },
    INFO: {
      color: Colors.brandCyan,
      bgColor: '#00D2C420',
      borderColor: Colors.brandCyan,
      iconName: 'information-circle' as keyof typeof Ionicons.glyphMap,
      badgeLabel: 'NOTIFICATION',
      btnBg: Colors.brandCyan,
      btnTextColor: '#0B0F19',
    },
  }[type];

  const buttons = alert.buttons && alert.buttons.length > 0
    ? alert.buttons
    : [{ text: 'OK', style: 'default' as const }];

  return (
    <Modal
      transparent
      visible={!!alert}
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalCard,
                {
                  borderColor: config.borderColor,
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                  ...(Platform.OS === 'web'
                    ? {
                        boxShadow: `0 8px 32px ${config.color}35`,
                      }
                    : {
                        shadowColor: config.color,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                        elevation: 12,
                      }),
                },
              ]}
            >
              {/* HALO LUMINEUX & ICÔNE D'EN-TÊTE */}
              <View style={[styles.iconWrapper, { backgroundColor: config.bgColor, borderColor: config.color }]}>
                <Ionicons name={config.iconName} size={32} color={config.color} />
              </View>

              {/* BADGE DE TYPE */}
              <View style={[styles.typeBadge, { backgroundColor: config.bgColor, borderColor: config.color }]}>
                <Text style={[styles.typeBadgeText, { color: config.color }]}>
                  {config.badgeLabel}
                </Text>
              </View>

              {/* TITRE */}
              <Text style={styles.title}>{alert.title}</Text>

              {/* MESSAGE DÉTAILLÉ */}
              {alert.message ? (
                <Text style={styles.message}>{alert.message}</Text>
              ) : null}

              {/* BOUTONS D'ACTION */}
              <View
                style={[
                  styles.buttonsContainer,
                  buttons.length > 2 && styles.buttonsContainerVertical,
                ]}
              >
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';

                  let btnStyle: any = styles.btnPrimary;
                  let btnTextStyle: any = [styles.btnTextPrimary, { color: config.btnTextColor }];
                  let btnBg = config.btnBg;

                  if (isCancel) {
                    btnStyle = styles.btnSecondary;
                    btnTextStyle = [styles.btnTextSecondary, { color: Colors.textSecondary }];
                    btnBg = Colors.surface;
                  } else if (isDestructive) {
                    btnStyle = styles.btnDestructive;
                    btnTextStyle = [styles.btnTextPrimary, { color: '#FFFFFF' }];
                    btnBg = Colors.danger;
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.buttonBase,
                        btnStyle,
                        { backgroundColor: btnBg },
                        buttons.length === 2 && { flex: 1 },
                      ]}
                      onPress={() => handleButtonPress(btn)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.btnTextBase, btnTextStyle]} numberOfLines={1}>
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 16, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.cardBackground,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  message: {
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  buttonsContainerVertical: {
    flexDirection: 'column',
    width: '100%',
  },
  buttonBase: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    flex: 1,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnDestructive: {
    flex: 1,
  },
  btnTextBase: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnTextPrimary: {
    fontWeight: '800',
  },
  btnTextSecondary: {
    fontWeight: '600',
  },
});
