const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

/** Nombre de jours calendaires (heure locale) entre `date` et `now`. */
const calendarDaysBetween = (date: Date, now: Date): number => {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(now) - startOfDay(date)) / MS_PER_DAY);
};

/**
 * Date relative courte pour les cartes : « aujourd'hui », « hier »,
 * « il y a 3 j », « il y a 2 mois », « il y a 1 an », « dans 2 j ».
 */
export const formatRelativeDay = (dateStr: string, now: Date = new Date()): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const days = calendarDaysBetween(date, now);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days === -1) return 'demain';
  if (days < 0) return `dans ${-days} j`;
  if (days < DAYS_PER_MONTH) return `il y a ${days} j`;
  if (days < DAYS_PER_YEAR) return `il y a ${Math.floor(days / DAYS_PER_MONTH)} mois`;
  const years = Math.floor(days / DAYS_PER_YEAR);
  return `il y a ${years} an${years > 1 ? 's' : ''}`;
};
