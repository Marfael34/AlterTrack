export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  gmailUser: string | null;
  hasGmailConfigured?: boolean;
  hasGmailAppPassword?: boolean;
  template: string | null;
  hasCv: boolean;
  cvOriginalName: string | null;
  expoPushToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName?: string;
  gmailUser?: string;
  gmailAppPassword?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  gmailUser?: string | null;
  gmailAppPassword?: string | null;
  password?: string;
  template?: string;
}
