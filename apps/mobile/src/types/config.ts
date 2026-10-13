export interface AppConfig {
  id: string;
  template: string;
  hasCv: boolean;
  cvOriginalName?: string | null;
  expoPushToken?: string | null;
  updatedAt: string;
}
