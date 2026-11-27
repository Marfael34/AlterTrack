import * as DocumentPicker from 'expo-document-picker';
import type { CvUploadResult } from '../types/config';
import { ApiService } from './api.service';
import { formatStandardCvName } from './storage.service';

/** Doit rester identique à la limite du serveur (CV_MAX_SIZE_BYTES côté API). */
export const CV_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const CV_MESSAGES = {
  unsupportedFormat: 'Format non pris en charge. Importez un fichier PDF.',
  tooLarge: 'Le fichier dépasse 10 Mo.',
  pickerUnavailable:
    "Impossible d'accéder à vos fichiers. Vérifiez les autorisations de l'application dans les réglages du téléphone.",
} as const;

export interface PickedCvFile {
  uri: string;
  size?: number;
  /** Objet File du navigateur (version web uniquement). */
  webFile?: unknown;
}

export type CvPickResult =
  | { kind: 'canceled' }
  | { kind: 'invalid'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'picked'; file: PickedCvFile };

function isPdf(asset: DocumentPicker.DocumentPickerAsset): boolean {
  const mime = (asset.mimeType || '').toLowerCase();
  const name = (asset.name || '').toLowerCase();
  // Certains gestionnaires Android (Drive, Téléchargements) omettent l'extension
  // ou le MIME : l'un des deux suffit ici, le serveur vérifie le contenu réel.
  return mime.includes('pdf') || name.endsWith('.pdf');
}

/**
 * Ouvre le sélecteur de documents natif (stockage local et fournisseurs cloud
 * proposés par le système : Google Drive, iCloud Drive…) et valide le fichier choisi.
 */
export async function pickCvFile(): Promise<CvPickResult> {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/x-pdf', '*/*'],
      // Copie dans le cache de l'app : l'URI d'origine (content://, iCloud)
      // peut expirer ou ne pas être lisible au moment de l'envoi.
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch {
    return { kind: 'unavailable', message: CV_MESSAGES.pickerUnavailable };
  }

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { kind: 'canceled' };
  }

  const asset = result.assets[0];
  if (!isPdf(asset)) {
    return { kind: 'invalid', message: CV_MESSAGES.unsupportedFormat };
  }
  if (typeof asset.size === 'number' && asset.size > CV_MAX_SIZE_BYTES) {
    return { kind: 'invalid', message: CV_MESSAGES.tooLarge };
  }

  return {
    kind: 'picked',
    file: { uri: asset.uri, size: asset.size, webFile: asset.file },
  };
}

/** Envoie le CV au serveur, qui fait autorité (contenu PDF, taille, nommage). */
export async function uploadPickedCv(
  file: PickedCvFile,
  fullName?: string | null,
): Promise<CvUploadResult> {
  return ApiService.uploadCv(
    file.uri,
    formatStandardCvName(fullName),
    file.webFile,
  );
}

export function formatCvFileSize(bytes?: number | null): string | null {
  if (typeof bytes !== 'number' || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export function formatCvUploadDate(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
