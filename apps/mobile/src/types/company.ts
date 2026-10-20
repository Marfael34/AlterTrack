export type Status =
  | 'AUTO_SEND'
  | 'TO_SEND'
  | 'WAITING_FOR_REPLY'
  | 'TO_FOLLOW_UP'
  | 'TO_CALL'
  | 'REPLY_RECEIVED'
  | 'REFUSED'
  | 'ACCEPTED';

export interface Company {
  id: string;
  name: string;
  email: string;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  notes?: string | null;
  status: Status;
  firstMailSentAt?: string | null;
  followUpReadyAt?: string | null;
  followUpSentAt?: string | null;
  lastMailId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyStats {
  AUTO_SEND: number;
  TO_SEND: number;
  WAITING_FOR_REPLY: number;
  TO_FOLLOW_UP: number;
  TO_CALL: number;
  REPLY_RECEIVED: number;
  REFUSED: number;
  ACCEPTED: number;
}

export const STATUS_LABELS: Record<Status, string> = {
  AUTO_SEND: 'Envoi automatique',
  TO_SEND: 'À envoyer (manuel)',
  WAITING_FOR_REPLY: 'En attente',
  TO_FOLLOW_UP: 'À relancer',
  REPLY_RECEIVED: 'Réponse reçue',
  TO_CALL: 'À appeler',
  ACCEPTED: 'Accepté',
  REFUSED: 'Refusé',
};
