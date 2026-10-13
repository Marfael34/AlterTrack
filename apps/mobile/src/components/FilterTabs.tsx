import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { STATUS_LABELS, Status, CompanyStats } from '../types/company';

interface FilterTabsProps {
  selectedStatus: Status | 'ALL';
  onSelectStatus: (status: Status | 'ALL') => void;
  stats?: CompanyStats;
  totalCount?: number;
}

const ALL_STATUSES: Status[] = [
  'TO_SEND',
  'WAITING_FOR_REPLY',
  'TO_FOLLOW_UP',
  'REPLY_RECEIVED',
  'TO_CALL',
  'ACCEPTED',
  'REFUSED',
];

export const FilterTabs: React.FC<FilterTabsProps> = ({
  selectedStatus,
  onSelectStatus,
  stats,
  totalCount = 0,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={[styles.tab, selectedStatus === 'ALL' && styles.tabActive]}
          onPress={() => onSelectStatus('ALL')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, selectedStatus === 'ALL' && styles.tabTextActive]}>
            Tous
          </Text>
          <View style={[styles.countBadge, selectedStatus === 'ALL' && styles.countBadgeActive]}>
            <Text
              style={[
                styles.countText,
                selectedStatus === 'ALL' && styles.countTextActive,
              ]}
            >
              {totalCount}
            </Text>
          </View>
        </TouchableOpacity>

        {ALL_STATUSES.map((status) => {
          const isActive = selectedStatus === status;
          const count = stats ? stats[status] || 0 : 0;
          const statusColor = Colors.status[status];

          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.tab,
                isActive && {
                  backgroundColor: `${statusColor}25`,
                  borderColor: statusColor,
                },
              ]}
              onPress={() => onSelectStatus(status)}
              activeOpacity={0.7}
            >
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text
                style={[
                  styles.tabText,
                  isActive && { color: statusColor, fontWeight: '700' },
                ]}
              >
                {STATUS_LABELS[status]}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: isActive ? statusColor : Colors.surfaceHighlight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      { color: isActive ? '#FFFFFF' : Colors.textSecondary },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: `${Colors.primary}25`,
    borderColor: Colors.primary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Colors.surfaceHighlight,
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
