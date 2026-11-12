import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';

export type MainTabType = 'HOME' | 'MAP' | 'ADD' | 'PROFILE';

interface MainTabBarProps {
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  urgentActionCount?: number;
}

export const MainTabBar: React.FC<MainTabBarProps> = ({
  activeTab,
  onSelectTab,
  urgentActionCount,
}) => {
  const tabs: Array<{
    key: MainTabType;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconActive: keyof typeof Ionicons.glyphMap;
    badge?: number;
    badgeColor?: string;
  }> = [
    {
      key: 'HOME',
      label: 'Candidatures',
      icon: 'briefcase-outline',
      iconActive: 'briefcase',
      badge: urgentActionCount && urgentActionCount > 0 ? urgentActionCount : undefined,
      badgeColor: Colors.status.REPLY_RECEIVED,
    },
    {
      key: 'MAP',
      label: 'Carte radar',
      icon: 'map-outline',
      iconActive: 'map',
    },
    {
      key: 'ADD',
      label: 'Ajouter',
      icon: 'add-circle-outline',
      iconActive: 'add-circle',
    },
    {
      key: 'PROFILE',
      label: 'Profil',
      icon: 'person-outline',
      iconActive: 'person',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const activeColor =
            tab.key === 'MAP'
              ? Colors.accent
              : tab.key === 'ADD'
              ? Colors.brandGreen
              : tab.key === 'PROFILE'
              ? Colors.brandCyan
              : Colors.primary;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => onSelectTab(tab.key)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <View style={styles.iconWrapper}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={22}
                  color={isActive ? activeColor : Colors.textMuted}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: tab.badgeColor || Colors.primary },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive && { color: activeColor, fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {isActive && (
                <View
                  style={[
                    styles.activeIndicator,
                    { backgroundColor: activeColor },
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0E1422',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    ...(Platform.OS === 'web'
      ? {
          position: 'sticky' as any,
          bottom: 0,
          zIndex: 100,
          boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.5)',
        }
      : {
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 12,
    position: 'relative',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  tabItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  iconWrapper: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0E1422',
  },
  badgeText: {
    color: '#090D16',
    fontSize: 9,
    fontWeight: '800',
  },
});
