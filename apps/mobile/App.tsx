import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from './src/constants/colors';
import { AddCompanyScreen } from './src/screens/AddCompanyScreen';
import { CompanyDetailScreen } from './src/screens/CompanyDetailScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Company } from './src/types/company';

type Screen = 'HOME' | 'DETAIL' | 'ADD' | 'SETTINGS';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('HOME');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleOpenDetail = (company: Company) => {
    setSelectedCompany(company);
    setCurrentScreen('DETAIL');
  };

  const handleDataChanged = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {currentScreen === 'HOME' && (
        <HomeScreen
          key={refreshTrigger}
          onSelectCompany={handleOpenDetail}
          onOpenSettings={() => setCurrentScreen('SETTINGS')}
          onOpenAddCompany={() => setCurrentScreen('ADD')}
        />
      )}

      {currentScreen === 'DETAIL' && selectedCompany && (
        <CompanyDetailScreen
          company={selectedCompany}
          onBack={() => setCurrentScreen('HOME')}
          onUpdated={handleDataChanged}
        />
      )}

      {currentScreen === 'ADD' && (
        <AddCompanyScreen
          onBack={() => setCurrentScreen('HOME')}
          onCreated={handleDataChanged}
        />
      )}

      {currentScreen === 'SETTINGS' && (
        <SettingsScreen onBack={() => setCurrentScreen('HOME')} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
