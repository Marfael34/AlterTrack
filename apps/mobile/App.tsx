import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from './src/constants/colors';
import { AddCompanyScreen } from './src/screens/AddCompanyScreen';
import { CompanyDetailScreen } from './src/screens/CompanyDetailScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LocationService, ReferencePoint } from './src/services/location.service';
import { Company } from './src/types/company';

type Screen = 'HOME' | 'DETAIL' | 'ADD' | 'SETTINGS';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('HOME');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refPoint, setRefPoint] = useState<ReferencePoint | null>(null);

  React.useEffect(() => {
    void (async () => {
      const point = await LocationService.getReferencePoint();
      setRefPoint(point);
    })();
  }, []);

  const handleOpenDetail = (company: Company) => {
    setSelectedCompany(company);
    setCurrentScreen('DETAIL');
  };

  const handleDataChanged = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        {currentScreen === 'HOME' && (
          <HomeScreen
            key={refreshTrigger}
            onSelectCompany={handleOpenDetail}
            onOpenSettings={() => setCurrentScreen('SETTINGS')}
            onOpenAddCompany={() => setCurrentScreen('ADD')}
            refPoint={refPoint}
            onUpdateRefPoint={setRefPoint}
          />
        )}

        {currentScreen === 'DETAIL' && selectedCompany && (
          <CompanyDetailScreen
            company={selectedCompany}
            onBack={() => setCurrentScreen('HOME')}
            onUpdated={handleDataChanged}
            refPoint={refPoint}
            onUpdateRefPoint={setRefPoint}
          />
        )}

        {currentScreen === 'ADD' && (
          <AddCompanyScreen
            onBack={() => setCurrentScreen('HOME')}
            onCreated={handleDataChanged}
          />
        )}

        {currentScreen === 'SETTINGS' && (
          <SettingsScreen
            onBack={() => setCurrentScreen('HOME')}
            refPoint={refPoint}
            onUpdateRefPoint={setRefPoint}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
