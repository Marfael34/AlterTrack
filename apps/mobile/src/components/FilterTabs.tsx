import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { CompanyStats, STATUS_LABELS, Status } from '../types/company';

interface FilterTabsProps {
  selectedStatuses?: Status[];
  selectedStatus?: Status | 'ALL';
  onToggleStatus: (status: Status) => void;
  onSelectAll: () => void;
  stats?: CompanyStats;
  totalCount?: number;
}

const ALL_STATUSES: Array<{
  key: Status;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'REPLY_RECEIVED', icon: 'chatbubble-ellipses' }, // Mis en avant car urgent !
  { key: 'TO_CALL', icon: 'call' }, // Mis en avant car urgent !
  { key: 'TO_SEND', icon: 'mail-unread' },
  { key: 'WAITING_FOR_REPLY', icon: 'time' },
  { key: 'TO_FOLLOW_UP', icon: 'refresh-circle' },
  { key: 'ACCEPTED', icon: 'checkmark-circle' },
  { key: 'REFUSED', icon: 'close-circle' },
];

export const FilterTabs: React.FC<FilterTabsProps> = ({
  selectedStatuses = [],
  selectedStatus,
  onToggleStatus,
  onSelectAll,
  stats,
  totalCount = 0,
}) => {
  const isAll =
    selectedStatus === 'ALL' ||
    (selectedStatuses.length === 0 && !selectedStatus);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Puce "Toutes" */}
        <TouchableOpacity
          style={[styles.tab, isAll && styles.tabActive]}
          onPress={onSelectAll}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Toutes les candidatures"
        >
          <Text style={[styles.tabText, isAll && styles.tabTextActive]}>
            Toutes
          </Text>
          <View style={[styles.countBadge, isAll && styles.countBadgeActive]}>
            <Text style={[styles.countText, isAll && styles.countTextActive]}>
              {totalCount}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Puces de chaque statut métier */}
        {ALL_STATUSES.map(({ key: status, icon }) => {
          const isActive =
            selectedStatus === status || selectedStatuses.includes(status);
          const count = stats ? stats[status] || 0 : 0;
          const statusColor = Colors.status[status];
          const isUrgent =
            (status === 'REPLY_RECEIVED' || status === 'TO_CALL') && count > 0;

          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.tab,
                isUrgent && !isActive && styles.tabUrgent,
                isActive && {
                  backgroundColor: `${statusColor}22`,
                  borderColor: statusColor,
                  borderWidth: 1.5,
                },
              ]}
              onPress={() => onToggleStatus(status)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${STATUS_LABELS[status]}, ${count} candidature${count > 1 ? 's' : ''}`}
            >
              <Ionicons
                name={icon}
                size={13}
                color={isActive ? statusColor : isUrgent ? statusColor : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  isActive && { color: statusColor, fontWeight: '700' },
                  isUrgent && !isActive && { color: Colors.text, fontWeight: '600' },
                ]}
              >
                {STATUS_LABELS[status]}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  isActive && { backgroundColor: statusColor },
                  isUrgent && !isActive && {
                    backgroundColor: `${statusColor}30`,
                    borderColor: statusColor,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    isActive && { color: '#0B0F19' },
                    isUrgent && !isActive && { color: statusColor },
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  tabActive: {
    backgroundColor: `${Colors.primary}25`,
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  tabUrgent: {
    borderColor: `${Colors.status.REPLY_RECEIVED}80`,
    backgroundColor: `${Colors.cardBackground}`,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: Colors.surfaceHighlight,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeActive: {
    backgroundColor: Colors.primary,
  },
  countText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  countTextActive: {
    color: '#FFFFFF',
  },
});
