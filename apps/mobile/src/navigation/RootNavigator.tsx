import { DarkTheme, NavigationContainer, Theme, useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { MainTabBar, MainTabType } from '../components/MainTabBar';
import { Colors } from '../constants/colors';
import { AddCompanyScreen } from '../screens/AddCompanyScreen';
import { CompanyDetailScreen } from '../screens/CompanyDetailScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ReferencePoint } from '../services/location.service';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

type MainNavigation = NativeStackNavigationProp<RootStackParamList, 'Main'>;
type MainTab = Exclude<MainTabType, 'ADD'>;

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.background,
  },
};

interface SharedProps {
  refPoint: ReferencePoint | null;
  onUpdateRefPoint: (point: ReferencePoint | null) => void;
}

interface MainTabsProps extends SharedProps {
  urgentActionCount: number;
}

/**
 * Écran racine : onglets Candidatures / Carte / Profil. Le bouton « Ajouter »
 * ouvre l'écran d'ajout dans la pile, pour qu'il profite du geste retour.
 */
const MainTabs: React.FC<MainTabsProps> = ({ refPoint, onUpdateRefPoint, urgentActionCount }) => {
  const navigation = useNavigation<MainNavigation>();
  const [tab, setTab] = useState<MainTab>('HOME');
  const [returnCount, setReturnCount] = useState(0);

  // L'accueil reste monté sous les écrans empilés : on recharge la liste à
  // chaque retour pour refléter les changements faits ailleurs (EF-2.6).
  useEffect(() => {
    let hasLeft = false;
    const unsubscribeBlur = navigation.addListener('blur', () => {
      hasLeft = true;
    });
    const unsubscribeFocus = navigation.addListener('focus', () => {
      if (hasLeft) setReturnCount((count) => count + 1);
    });
    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
    };
  }, [navigation]);

  // Android : depuis Carte ou Profil, le retour ramène à l'onglet Candidatures.
  // Depuis Candidatures, comportement système standard (EF-3.4).
  useFocusEffect(
    useCallback(() => {
      if (tab === 'HOME') return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        setTab('HOME');
        return true;
      });
      return () => subscription.remove();
    }, [tab]),
  );

  const handleSelectTab = (selected: MainTabType) => {
    if (selected === 'ADD') {
      navigation.navigate('AddCompany');
    } else {
      setTab(selected);
    }
  };

  return (
    <>
      {tab === 'PROFILE' ? (
        // Remonté à chaque retour : ses statistiques sont chargées au montage.
        <ProfileScreen
          key={returnCount}
          onOpenSettings={() => navigation.navigate('Settings')}
          refPoint={refPoint}
          onUpdateRefPoint={onUpdateRefPoint}
        />
      ) : (
        <HomeScreen
          refreshTrigger={returnCount}
          onSelectCompany={(company) => navigation.navigate('CompanyDetail', { company })}
          onOpenSettings={() => navigation.navigate('Settings')}
          onOpenAddCompany={() => navigation.navigate('AddCompany')}
          refPoint={refPoint}
          onUpdateRefPoint={onUpdateRefPoint}
          initialViewMode={tab === 'MAP' ? 'MAP' : 'LIST'}
          onViewModeChanged={(mode) => setTab(mode === 'MAP' ? 'MAP' : 'HOME')}
        />
      )}

      <MainTabBar
        activeTab={tab}
        onSelectTab={handleSelectTab}
        urgentActionCount={urgentActionCount}
      />
    </>
  );
};

interface RootNavigatorProps extends MainTabsProps {
  onDataChanged: () => void;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({
  refPoint,
  onUpdateRefPoint,
  urgentActionCount,
  onDataChanged,
}) => (
  <NavigationContainer theme={navigationTheme}>
    <Stack.Navigator
      screenOptions={{
        // Chaque écran garde son propre en-tête ; le geste retour natif reste
        // actif sans l'en-tête de la pile (EF-3.1 / EF-3.2).
        headerShown: false,
        gestureEnabled: true,
        animation: 'default',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="Main">
        {() => (
          <MainTabs
            refPoint={refPoint}
            onUpdateRefPoint={onUpdateRefPoint}
            urgentActionCount={urgentActionCount}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="CompanyDetail">
        {({ route, navigation }) => (
          <CompanyDetailScreen
            company={route.params.company}
            onBack={() => navigation.goBack()}
            onUpdated={onDataChanged}
            refPoint={refPoint}
            onUpdateRefPoint={onUpdateRefPoint}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="AddCompany">
        {({ navigation }) => (
          <AddCompanyScreen
            onBack={() => navigation.goBack()}
            onCreated={onDataChanged}
            refPoint={refPoint}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Settings">
        {({ navigation }) => (
          <SettingsScreen
            onBack={() => navigation.goBack()}
            refPoint={refPoint}
            onUpdateRefPoint={onUpdateRefPoint}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  </NavigationContainer>
);
