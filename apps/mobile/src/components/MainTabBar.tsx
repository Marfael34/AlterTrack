import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';

export type MainTabType = 'HOME' | 'MAP' | 'ADD' | 'SETTINGS';

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
      key: 'SETTINGS',
      label: 'Paramètres',
      icon: 'settings-outline',
      iconActive: 'settings',
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
    backgroundColor: Colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
    ...(Platform.OS === 'web'
      ? {
          position: 'sticky' as any,
          bottom: 0,
          zIndex: 100,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
        }
      : {
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
        }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 10,
    position: 'relative',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  tabItemActive: {
    backgroundColor: `${Colors.surfaceHighlight}50`,
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
    marginTop: 2,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.cardBackground,
  },
  badgeText: {
    color: '#0B0F19',
    fontSize: 9,
    fontWeight: '800',
  },
});
