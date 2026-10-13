import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Company } from '../types/company';
import { StatusBadge } from './StatusBadge';

interface CompanyCardProps {
  company: Company;
  onPress: () => void;
}

export const CompanyCard: React.FC<CompanyCardProps> = ({ company, onPress }) => {
  const handleCall = () => {
    if (company.phone) {
      Linking.openURL(`tel:${company.phone}`).catch(() => {});
    }
  };

  const isToCall = company.status === 'TO_CALL';

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        company.status === 'REPLY_RECEIVED' && styles.cardHighlightReply,
        isToCall && styles.cardHighlightCall,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.companyName} numberOfLines={1}>
          {company.name}
        </Text>
        <StatusBadge status={company.status} size="small" />
      </View>

      <View style={styles.contactRow}>
        <Ionicons name="mail-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.contactText} numberOfLines={1}>
          {company.email}
        </Text>
      </View>

      {company.phone && (
        <View style={styles.phoneRow}>
          <Ionicons name="call-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.contactText}>{company.phone}</Text>
          {isToCall && (
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCall}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={12} color="#FFFFFF" />
              <Text style={styles.callButtonText}>Appeler</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {company.notes && (
        <Text style={styles.notesPreview} numberOfLines={2}>
          {company.notes}
        </Text>
      )}

      <View style={styles.footer}>
        {company.firstMailSentAt ? (
          <Text style={styles.dateText}>
            1er contact : {formatDate(company.firstMailSentAt)}
            {company.followUpSentAt && ` • Relance : ${formatDate(company.followUpSentAt)}`}
          </Text>
        ) : (
          <Text style={styles.dateText}>Non encore contacté</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHighlightReply: {
    borderColor: Colors.status.REPLY_RECEIVED,
    backgroundColor: '#1E1B38',
  },
  cardHighlightCall: {
    borderColor: Colors.status.TO_CALL,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  contactText: {
    color: Colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.TO_CALL,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  notesPreview: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: `${Colors.border}88`,
  },
  dateText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
});
