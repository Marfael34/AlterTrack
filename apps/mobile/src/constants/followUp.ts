/**
 * Délai (en jours) sans réponse après le dernier contact avant qu'une candidature
 * passe à « À appeler ». Le serveur fait autorité (apps/api/src/modules/scheduler/
 * follow-up.constants.ts) : cette valeur ne sert qu'aux textes affichés et doit rester identique.
 */
export const CALL_FOLLOW_UP_DELAY_DAYS = 7;
