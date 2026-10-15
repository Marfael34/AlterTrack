import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MainTabBar, MainTabType } from './src/components/MainTabBar';
import { Colors } from './src/constants/colors';
import { AddCompanyScreen } from './src/screens/AddCompanyScreen';
import { CompanyDetailScreen } from './src/screens/CompanyDetailScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ApiService } from './src/services/api.service';
import { FilterStorageService } from './src/services/filterStorage.service';
import { LocationService, ReferencePoint } from './src/services/location.service';
import { Company, CompanyStats } from './src/types/company';

type AppScreen = 'HOME' | 'MAP' | 'DETAIL' | 'ADD' | 'SETTINGS';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('HOME');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refPoint, setRefPoint] = useState<ReferencePoint | null>(null);
  const [stats, setStats] = useState<CompanyStats | null>(null);

  useEffect(() => {
    void (async () => {
      const [point] = await Promise.all([
        LocationService.getReferencePoint(),
        FilterStorageService.loadFilters(),
      ]);
      setRefPoint(point);
    })();
  }, []);

  useEffect(() => {
    void ApiService.getCompanyStats()
      .then(setStats)
      .catch(() => {});
  }, [refreshTrigger]);

  const handleOpenDetail = (company: Company) => {
    setSelectedCompany(company);
    setCurrentScreen('DETAIL');
  };

  const handleDataChanged = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const urgentActionCount =
    (stats?.REPLY_RECEIVED || 0) + (stats?.TO_CALL || 0);

  const activeMainTab: MainTabType =
    currentScreen === 'MAP'
      ? 'MAP'
      : currentScreen === 'ADD'
      ? 'ADD'
      : currentScreen === 'SETTINGS'
      ? 'SETTINGS'
      : 'HOME';

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />

          {/* Écran principal : Candidatures (Liste ou Carte) */}
          {(currentScreen === 'HOME' || currentScreen === 'MAP') && (
            <HomeScreen
              key={refreshTrigger}
              refreshTrigger={refreshTrigger}
              onSelectCompany={handleOpenDetail}
              onOpenSettings={() => setCurrentScreen('SETTINGS')}
              onOpenAddCompany={() => setCurrentScreen('ADD')}
              refPoint={refPoint}
              onUpdateRefPoint={setRefPoint}
              initialViewMode={currentScreen === 'MAP' ? 'MAP' : 'LIST'}
              onViewModeChanged={(mode) =>
                setCurrentScreen(mode === 'MAP' ? 'MAP' : 'HOME')
              }
            />
          )}

          {/* Fiche détail d'une entreprise */}
          {currentScreen === 'DETAIL' && selectedCompany && (
            <CompanyDetailScreen
              company={selectedCompany}
              onBack={() => setCurrentScreen('HOME')}
              onUpdated={handleDataChanged}
              refPoint={refPoint}
              onUpdateRefPoint={setRefPoint}
            />
          )}

          {/* Ajout d'une entreprise / Import */}
          {currentScreen === 'ADD' && (
            <AddCompanyScreen
              onBack={() => setCurrentScreen('HOME')}
              onCreated={handleDataChanged}
              refPoint={refPoint}
            />
          )}

          {/* Paramètres & IA */}
          {currentScreen === 'SETTINGS' && (
            <SettingsScreen
              onBack={() => setCurrentScreen('HOME')}
              refPoint={refPoint}
              onUpdateRefPoint={setRefPoint}
            />
          )}

          {/* Barre de navigation ergonomique inférieure (visible hors fiche détail) */}
          {currentScreen !== 'DETAIL' && (
            <MainTabBar
              activeTab={activeMainTab}
              onSelectTab={(tab) => setCurrentScreen(tab)}
              urgentActionCount={urgentActionCount}
            />
          )}
        </SafeAreaView>
      </View>
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
