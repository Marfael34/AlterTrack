import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { UpdateBanner } from './src/components/UpdateBanner';
import { Colors } from './src/constants/colors';
import { AlertProvider } from './src/context/AlertContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { ApiService } from './src/services/api.service';
import { FilterStorageService } from './src/services/filterStorage.service';
import { LocationService, ReferencePoint } from './src/services/location.service';
import { CompanyStats } from './src/types/company';

function AppContent() {
  const { token, isLoading } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refPoint, setRefPoint] = useState<ReferencePoint | null>(null);
  const [stats, setStats] = useState<CompanyStats | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const [point] = await Promise.all([
        LocationService.getReferencePoint(),
        FilterStorageService.loadFilters(),
      ]);
      setRefPoint(point);
    })();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void ApiService.getCompanyStats()
      .then(setStats)
      .catch(() => {});
  }, [token, refreshTrigger]);

  const handleDataChanged = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={Colors.brandCyan} />
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <AuthScreen />
        </SafeAreaView>
      </View>
    );
  }

  const urgentActionCount =
    (stats?.REPLY_RECEIVED || 0) + (stats?.TO_CALL || 0);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        {/* Bandeau « Nouvelle version disponible » (APK Android uniquement) */}
        <UpdateBanner />

        <RootNavigator
          refPoint={refPoint}
          onUpdateRefPoint={setRefPoint}
          urgentActionCount={urgentActionCount}
          onDataChanged={handleDataChanged}
        />
      </SafeAreaView>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AlertProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </AlertProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#070A10',
    alignItems: 'center',
    width: '100%',
  },
  center: {
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 960,
    backgroundColor: Colors.background,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 0 50px rgba(0, 0, 0, 0.7)',
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: Colors.border,
        }
      : {}),
  },
});
