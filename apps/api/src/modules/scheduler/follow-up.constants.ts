/**
 * Délai sans réponse, après le dernier contact (premier mail ou relance manuelle),
 * au bout duquel une candidature passe au statut « À appeler ».
 * Source unique : toute logique ou tout texte lié à ce délai doit s'y référer.
 */
export const CALL_FOLLOW_UP_DELAY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Date limite : un dernier contact antérieur ou égal à cette date est échu. */
export function callFollowUpThreshold(now: Date): Date {
  return new Date(now.getTime() - CALL_FOLLOW_UP_DELAY_DAYS * DAY_MS);
}

/** Date à laquelle l'appel sera proposé pour un contact effectué à `contactAt`. */
export function callFollowUpDueDate(contactAt: Date): Date {
  return new Date(contactAt.getTime() + CALL_FOLLOW_UP_DELAY_DAYS * DAY_MS);
}
