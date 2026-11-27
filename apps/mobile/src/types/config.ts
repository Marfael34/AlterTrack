export interface AppConfig {
  id: string;
  template: string;
  hasCv: boolean;
  cvOriginalName?: string | null;
  cvFileSize?: number | null;
  cvUploadedAt?: string | null;
  expoPushToken?: string | null;
  updatedAt: string;
}

/** Réponse de POST /config/cv. */
export interface CvUploadResult {
  hasCv: boolean;
  cvOriginalName: string | null;
  cvFileSize?: number | null;
  cvUploadedAt?: string | null;
}
