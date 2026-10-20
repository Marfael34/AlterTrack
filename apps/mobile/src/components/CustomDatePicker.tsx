import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface CustomDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  label = "Date de l'action",
}) => {
  const [currentMonth, setCurrentMonth] = useState<number>(value.getMonth());
  const [currentYear, setCurrentYear] = useState<number>(value.getFullYear());
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [hours, setHours] = useState<string>(
    String(value.getHours()).padStart(2, '0'),
  );
  const [minutes, setMinutes] = useState<string>(
    String(value.getMinutes()).padStart(2, '0'),
  );

  const now = new Date();
  const isToday =
    value.getDate() === now.getDate() &&
    value.getMonth() === now.getMonth() &&
    value.getFullYear() === now.getFullYear();

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const isYesterday =
    value.getDate() === yesterday.getDate() &&
    value.getMonth() === yesterday.getMonth() &&
    value.getFullYear() === yesterday.getFullYear();

  const isCustom = !isToday && !isYesterday;

  // Raccourci Aujourd'hui
  const setToday = () => {
    const d = new Date();
    d.setHours(parseInt(hours, 10) || now.getHours());
    d.setMinutes(parseInt(minutes, 10) || now.getMinutes());
    setCurrentMonth(d.getMonth());
    setCurrentYear(d.getFullYear());
    onChange(d);
    setShowCalendar(false);
  };

  // Raccourci Hier
  const setYesterday = () => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    d.setHours(parseInt(hours, 10) || now.getHours());
    d.setMinutes(parseInt(minutes, 10) || now.getMinutes());
    setCurrentMonth(d.getMonth());
    setCurrentYear(d.getFullYear());
    onChange(d);
    setShowCalendar(false);
  };

  // Mois précédent / suivant
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Sélection d'un jour
  const handleSelectDay = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day);
    newDate.setHours(parseInt(hours, 10) || 12);
    newDate.setMinutes(parseInt(minutes, 10) || 0);
    onChange(newDate);
  };

  // Mise à jour de l'heure
  const handleTimeChange = (newHours: string, newMins: string) => {
    setHours(newHours);
    setMinutes(newMins);
    const h = parseInt(newHours, 10);
    const m = parseInt(newMins, 10);
    if (!isNaN(h) && h >= 0 && h <= 23 && !isNaN(m) && m >= 0 && m <= 59) {
      const d = new Date(value);
      d.setHours(h);
      d.setMinutes(m);
      onChange(d);
    }
  };

  // Calcul des jours du mois
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex =
    (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // 0 = Lundi

  const formattedSummary = value.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={styles.summaryBadge}
          onPress={() => setShowCalendar(!showCalendar)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={13} color={Colors.accent} />
          <Text style={styles.summaryBadgeText}>
            {formattedSummary} à {String(value.getHours()).padStart(2, '0')}:
            {String(value.getMinutes()).padStart(2, '0')}
          </Text>
          <Ionicons
            name={showCalendar ? 'chevron-up' : 'chevron-down'}
            size={13}
            color={Colors.accent}
          />
        </TouchableOpacity>
      </View>

      {/* Raccourcis rapides */}
      <View style={styles.shortcutRow}>
        <TouchableOpacity
          style={[styles.shortcutBtn, isToday && styles.shortcutBtnActive]}
          onPress={setToday}
          activeOpacity={0.7}
        >
          <Ionicons
            name="today-outline"
            size={14}
            color={isToday ? '#FFFFFF' : Colors.textSecondary}
          />
          <Text
            style={[
              styles.shortcutText,
              isToday && styles.shortcutTextActive,
            ]}
          >
            Aujourd'hui
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shortcutBtn, isYesterday && styles.shortcutBtnActive]}
          onPress={setYesterday}
          activeOpacity={0.7}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={isYesterday ? '#FFFFFF' : Colors.textSecondary}
          />
          <Text
            style={[
              styles.shortcutText,
              isYesterday && styles.shortcutTextActive,
            ]}
          >
            Hier
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.shortcutBtn,
            (showCalendar || isCustom) && styles.shortcutBtnActive,
          ]}
          onPress={() => setShowCalendar(!showCalendar)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="calendar"
            size={14}
            color={showCalendar || isCustom ? '#FFFFFF' : Colors.textSecondary}
          />
          <Text
            style={[
              styles.shortcutText,
              (showCalendar || isCustom) && styles.shortcutTextActive,
            ]}
          >
            {isCustom ? 'Autre date' : 'Calendrier'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calendrier interactif rétractable */}
      {showCalendar && (
        <View style={styles.calendarContainer}>
          {/* Header mois & navigation */}
          <View style={styles.calendarHeader}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={prevMonth}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={18} color={Colors.text} />
            </TouchableOpacity>

            <Text style={styles.monthTitle}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Text>

            <TouchableOpacity
              style={styles.navBtn}
              onPress={nextMonth}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-forward" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Jours de la semaine */}
          <View style={styles.weekDaysRow}>
            {WEEK_DAYS.map((wd) => (
              <Text key={wd} style={styles.weekDayText}>
                {wd}
              </Text>
            ))}
          </View>

          {/* Grille des jours */}
          <View style={styles.daysGrid}>
            {/* Espaces vides avant le 1er du mois */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.emptyCell} />
            ))}

            {/* Jours du mois */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelectedDay =
                value.getDate() === day &&
                value.getMonth() === currentMonth &&
                value.getFullYear() === currentYear;

              const isCurrentToday =
                now.getDate() === day &&
                now.getMonth() === currentMonth &&
                now.getFullYear() === currentYear;

              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={[
                    styles.dayCell,
                    isSelectedDay && styles.dayCellSelected,
                    isCurrentToday && !isSelectedDay && styles.dayCellToday,
                  ]}
                  onPress={() => handleSelectDay(day)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelectedDay && styles.dayTextSelected,
                      isCurrentToday && !isSelectedDay && styles.dayTextToday,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Ajustement de l'heure */}
          <View style={styles.timeAdjustRow}>
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.timeAdjustLabel}>Heure :</Text>
            <View style={styles.timeInputsWrapper}>
              <TextInput
                style={styles.timeInput}
                value={hours}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '').slice(0, 2);
                  handleTimeChange(cleaned, minutes);
                }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="HH"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.timeColon}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={minutes}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '').slice(0, 2);
                  handleTimeChange(hours, cleaned);
                }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="MM"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Raccourcis d'heure */}
            <View style={styles.quickTimePills}>
              <TouchableOpacity
                style={styles.quickTimePill}
                onPress={() => handleTimeChange('09', '00')}
              >
                <Text style={styles.quickTimePillText}>09h</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickTimePill}
                onPress={() => handleTimeChange('14', '00')}
              >
                <Text style={styles.quickTimePillText}>14h</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickTimePill}
                onPress={() => {
                  const n = new Date();
                  handleTimeChange(
                    String(n.getHours()).padStart(2, '0'),
                    String(n.getMinutes()).padStart(2, '0'),
                  );
                }}
              >
                <Text style={styles.quickTimePillText}>Maintenant</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.accent}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  summaryBadgeText: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '600',
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 6,
  },
  shortcutBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  shortcutTextActive: {
    color: '#FFFFFF',
  },
  calendarContainer: {
    marginTop: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    textTransform: 'capitalize',
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: `${Colors.textSecondary}15`,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  weekDayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  emptyCell: {
    width: '14.28%',
    height: 36,
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginVertical: 1,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  dayText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTextToday: {
    color: Colors.accent,
    fontWeight: '700',
  },
  timeAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: `${Colors.border}80`,
    gap: 8,
  },
  timeAdjustLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  timeInputsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timeInput: {
    width: 26,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    padding: 2,
  },
  timeColon: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  quickTimePills: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 'auto',
  },
  quickTimePill: {
    backgroundColor: `${Colors.textSecondary}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickTimePillText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
