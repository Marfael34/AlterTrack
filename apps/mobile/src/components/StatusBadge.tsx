import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { STATUS_LABELS, Status } from '../types/company';

interface StatusBadgeProps {
  status: Status;
  size?: 'small' | 'medium' | 'large';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'small' }) => {
  const badgeColor = Colors.status[status] || Colors.primary;
  const label = STATUS_LABELS[status] || status;

  return (
    <View
      style={[
        styles.badge,
        size === 'large'
          ? styles.badgeLarge
          : size === 'medium'
          ? styles.badgeMedium
          : styles.badgeSmall,
        {
          backgroundColor: `${badgeColor}18`,
          borderColor: `${badgeColor}45`,
        },
      ]}
    >
      <View style={[styles.dotWrapper, { backgroundColor: `${badgeColor}30` }]}>
        <View style={[styles.dot, { backgroundColor: badgeColor }]} />
      </View>
      <Text
        style={[
          styles.text,
          size === 'large'
            ? styles.textLarge
            : size === 'medium'
            ? styles.textMedium
            : styles.textSmall,
          { color: badgeColor },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  badgeMedium: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  badgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 8,
  },
  dotWrapper: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  textSmall: {
    fontSize: 11,
  },
  textMedium: {
    fontSize: 12,
  },
  textLarge: {
    fontSize: 14,
  },
});
