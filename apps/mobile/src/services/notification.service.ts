import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { ApiService } from './api.service';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Type helper sans import statique pour éviter le crash au chargement d'Expo Go SDK 53+
type NotificationsType = typeof import('expo-notifications');
let notificationsModule: NotificationsType | null = null;

function getNotifications(): NotificationsType | null {
  if (isExpoGo || Platform.OS === 'web') {
    return null;
  }
  if (!notificationsModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      notificationsModule = require('expo-notifications');
      notificationsModule?.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      notificationsModule = null;
    }
  }
  return notificationsModule;
}

export const NotificationService = {
  isExpoGo,

  async registerForPushNotificationsAsync(): Promise<string | null> {
    if (isExpoGo) {
      console.log(
        '[NotificationService] Mode Expo Go détecté : notifications distantes désactivées par Expo SDK 53+ (nécessitent un build autonome APK).',
      );
      return null;
    }

    const Notifications = getNotifications();
    if (!Notifications) {
      return null;
    }

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Défaut',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8B5CF6',
        });
      }

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData?.data || null;

      if (token) {
        try {
          await ApiService.updatePushToken(token);
        } catch {
          // Serveur potentiellement pas encore joignable
        }
      }

      return token;
    } catch (e) {
      console.warn('[NotificationService] Erreur push :', e);
      return null;
    }
  },
};
