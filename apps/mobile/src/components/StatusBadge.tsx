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
        size === 'large' ? styles.badgeLarge : size === 'medium' ? styles.badgeMedium : styles.badgeSmall,
        { backgroundColor: `${badgeColor}22`, borderColor: `${badgeColor}88` },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: badgeColor }]} />
      <Text
        style={[
          styles.text,
          size === 'large' ? styles.textLarge : size === 'medium' ? styles.textMedium : styles.textSmall,
          { color: badgeColor },
        ]}
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
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeMedium: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 11,
  },
  textMedium: {
    fontSize: 13,
  },
  textLarge: {
    fontSize: 15,
  },
});
