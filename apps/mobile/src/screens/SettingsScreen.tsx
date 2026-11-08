import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeader}>Préférences</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications-outline" size={20} color="#6366F1" style={{ marginRight: 12 }} />
            <Text style={styles.settingText}>Notifications Push</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#1F2937', true: '#6366F1' }}
            thumbColor="#F8FAFC"
          />
        </View>

        <Text style={styles.sectionHeader}>Système & Connexion</Text>

        <TouchableOpacity 
          style={styles.settingRowButton} 
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ServerConfig' as any)}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="server-outline" size={20} color="#F59E0B" style={{ marginRight: 12 }} />
            <Text style={styles.settingText}>Configuration du serveur API</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingRowButton, { marginTop: 24, borderColor: 'rgba(239, 68, 68, 0.3)' }]} 
          activeOpacity={0.7}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
            <Text style={[styles.settingText, { color: '#EF4444' }]}>Se déconnecter</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backButton: {
    backgroundColor: '#1E293B',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  content: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 12,
  },
  settingRowButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 15,
    color: '#F8FAFC',
    fontWeight: '500',
  },
});