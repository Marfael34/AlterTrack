import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { File as ExpoFile } from 'expo-file-system';
import {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  UserProfile,
} from '../types/auth';
import { Company, CompanyActivity, CompanyStats, Status } from '../types/company';
import { AppConfig } from '../types/config';
import { StorageService } from './storage.service';

export const ApiService = {
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = await StorageService.getServerUrl();
    const apiKey = await StorageService.getApiKey();
    const token = await StorageService.getAuthToken();

    const headers: Record<string, string> = {
      'x-api-key': apiKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Erreur HTTP ${response.status}`;
      try {
        const errorJson = (await response.json()) as { message?: string | string[] };
        if (Array.isArray(errorJson.message)) {
          errorMessage = errorJson.message.join(', ');
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // Fallback status text
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  },

  async checkHealth(): Promise<{ status: string; database: string }> {
    return this.request('/health');
  },

  async getCompanies(query?: {
    search?: string;
    status?: Status;
    statuses?: Status[];
    city?: string;
    cities?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    items: Company[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.statuses && query.statuses.length > 0) {
      params.append('statuses', query.statuses.join(','));
    } else if (query?.status) {
      params.append('status', query.status);
    }
    if (query?.cities && query.cities.length > 0) {
      params.append('cities', query.cities.join(','));
    } else if (query?.city) {
      params.append('city', query.city);
    }
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/companies${queryString}`);
  },

  async getCities(): Promise<Array<{ city: string; count: number }>> {
    return this.request('/companies/cities');
  },

  async getCompanyStats(): Promise<CompanyStats> {
    return this.request('/companies/stats');
  },

  async getCompany(id: string): Promise<Company> {
    return this.request(`/companies/${id}`);
  },

  async createCompany(data: {
    name: string;
    email: string;
    address?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    notes?: string;
    status?: Status;
  }): Promise<Company> {
    return this.request('/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCompany(
    id: string,
    data: {
      name?: string;
      email?: string;
      address?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      phone?: string;
      notes?: string;
    },
  ): Promise<Company> {
    return this.request(`/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateCompanyStatus(id: string, status: Status): Promise<Company> {
    return this.request(`/companies/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async deleteCompany(id: string): Promise<void> {
    await this.request(`/companies/${id}`, {
      method: 'DELETE',
    });
  },

  async getCompanyActivities(companyId: string): Promise<CompanyActivity[]> {
    return this.request(`/companies/${companyId}/activities`);
  },

  async addCompanyActivity(
    companyId: string,
    data: {
      title: string;
      type?: string;
      description?: string;
      performedAt?: string;
    },
  ): Promise<CompanyActivity> {
    return this.request(`/companies/${companyId}/activities`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteCompanyActivity(
    companyId: string,
    activityId: string,
  ): Promise<void> {
    await this.request(`/companies/${companyId}/activities/${activityId}`, {
      method: 'DELETE',
    });
  },

  async updateCompanyActivity(
    companyId: string,
    activityId: string,
    data: {
      title?: string;
      type?: string;
      description?: string;
      performedAt?: string;
    },
  ): Promise<CompanyActivity> {
    return this.request(`/companies/${companyId}/activities/${activityId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteCompanies(options: {
    ids?: string[];
    all?: boolean;
  }): Promise<{ deletedCount: number }> {
    return this.request('/companies/batch', {
      method: 'DELETE',
      body: JSON.stringify(options),
    });
  },

  async getConfig(): Promise<AppConfig> {
    return this.request('/config');
  },

  async updateTemplate(template: string): Promise<AppConfig> {
    return this.request('/config/template', {
      method: 'PATCH',
      body: JSON.stringify({ template }),
    });
  },

  async uploadFile<T>(
    endpoint: string,
    fileUri: string,
    fileName: string,
    mimeType: string,
    webFile?: unknown,
  ): Promise<T> {
    const baseUrl = await StorageService.getServerUrl();
    const apiKey = await StorageService.getApiKey();
    const token = await StorageService.getAuthToken();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;

    // 1. Sur Mobile (Android / iOS) : Privilégier le streaming natif OkHttp / NSURLSession
    // Cela contourne complètement JS FormData/fetch et élimine l'erreur "Unsupported FormDataPart implementation"
    if (Platform.OS !== 'web' && typeof FileSystem.uploadAsync === 'function') {
      try {
        const res = await FileSystem.uploadAsync(url, fileUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: mimeType || 'application/pdf',
          headers: {
            'x-api-key': apiKey,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'application/json',
          },
        });

        if (res.status >= 400) {
          let msg = `Erreur HTTP ${res.status}`;
          try {
            const err = JSON.parse(res.body) as { message?: string | string[] };
            if (Array.isArray(err.message)) msg = err.message.join(', ');
            else if (err.message) msg = err.message;
          } catch {
            // ignore
          }
          throw new Error(msg);
        }

        return JSON.parse(res.body) as T;
      } catch (nativeErr) {
        if (nativeErr instanceof Error && nativeErr.message.startsWith('Erreur HTTP')) {
          throw nativeErr;
        }
        console.warn('Native uploadAsync failed, falling back to multi-strategy FormData:', nativeErr);
      }
    }

    // 2. Fallback FormData (Web ou environnement où uploadAsync n'est pas disponible)
    const formData = new FormData();
    let fileAppended = false;

    // A. Sur Web ou si webFile est fourni
    if (
      (typeof Blob !== 'undefined' && webFile instanceof Blob) ||
      (typeof File !== 'undefined' && webFile instanceof File)
    ) {
      formData.append('file', webFile as Blob, fileName);
      fileAppended = true;
    }

    // B. Tentative via fetch(fileUri).blob() (compatible WinterCG Expo fetch)
    if (!fileAppended) {
      try {
        const fileResponse = await fetch(fileUri);
        const blob = await fileResponse.blob();
        formData.append('file', blob, fileName);
        fileAppended = true;
      } catch (blobErr) {
        console.warn('Fetch local file to blob fallback failed:', blobErr);
      }
    }

    // C. Tentative via la classe File d'expo-file-system (implémente .bytes() pour Expo modern fetch)
    if (!fileAppended) {
      try {
        if (typeof ExpoFile === 'function') {
          const expoFile = new ExpoFile(fileUri);
          formData.append('file', expoFile as unknown as Blob, fileName);
          fileAppended = true;
        }
      } catch (expoFileErr) {
        console.warn('ExpoFile fallback failed:', expoFileErr);
      }
    }

    // D. Dernier recours (objet React Native classique)
    if (!fileAppended) {
      const cleanUri =
        Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri;
      formData.append('file', {
        uri: cleanUri,
        name: fileName,
        type: mimeType || 'application/pdf',
      } as unknown as Blob);
    }

    return this.request(endpoint, {
      method: 'POST',
      body: formData,
    });
  },

  async uploadCv(
    fileUri: string,
    fileName: string,
    webFile?: unknown,
  ): Promise<AppConfig> {
    const safeName = fileName.toLowerCase().endsWith('.pdf')
      ? fileName
      : `${fileName}.pdf`;
    return this.uploadFile<AppConfig>(
      '/config/cv',
      fileUri,
      safeName,
      'application/pdf',
      webFile,
    );
  },

  async deleteCv(): Promise<{ success: boolean; message: string }> {
    return this.request('/config/cv', {
      method: 'DELETE',
    });
  },

  async getCvDownloadUrl(): Promise<string> {
    const baseUrl = await StorageService.getServerUrl();
    const token = await StorageService.getAuthToken();
    const apiKey = await StorageService.getApiKey();

    const params = new URLSearchParams();
    if (token) {
      params.append('token', token);
    } else if (apiKey) {
      params.append('apiKey', apiKey);
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return `${baseUrl}/config/cv/download${queryString}`;
  },

  async importSpreadsheet(
    fileUri: string,
    fileName: string,
    webFile?: unknown,
  ): Promise<{
    totalRows: number;
    importedCount: number;
    skippedCount: number;
    errors: string[];
    imported: Company[];
  }> {
    const isCsv = fileName.toLowerCase().endsWith('.csv');
    const mimeType = isCsv
      ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    return this.uploadFile(
      '/companies/import',
      fileUri,
      fileName,
      mimeType,
      webFile,
    );
  },

  async sendInitialBatch(companyIds?: string[]): Promise<{
    totalFound: number;
    successCount: number;
    failedCount: number;
    cvAttached?: boolean;
    cvName?: string | null;
  }> {
    return this.request('/mailing/send-initial', {
      method: 'POST',
      body: JSON.stringify({ companyIds }),
    });
  },

  async sendInitialSingle(
    companyId: string,
    subject?: string,
    body?: string,
  ): Promise<{
    success: boolean;
    company: Company;
    messageId: string;
    isSimulation?: boolean;
    hasAttachment?: boolean;
    attachmentName?: string | null;
  }> {
    return this.request(`/mailing/send-single/${companyId}`, {
      method: 'POST',
      body: JSON.stringify({ subject, body }),
    });
  },

  async sendFollowUp(companyId: string): Promise<Company> {
    return this.request(`/mailing/send-follow-up/${companyId}`, {
      method: 'POST',
    });
  },

  async checkReplies(): Promise<{
    messagesScanned: number;
    repliesDetected: number;
  }> {
    return this.request('/mailing/check-replies', {
      method: 'POST',
    });
  },

  async updatePushToken(expoPushToken: string): Promise<AppConfig> {
    return this.request('/config/push-token', {
      method: 'PATCH',
      body: JSON.stringify({ expoPushToken }),
    });
  },

  async previewEmail(
    companyName: string,
    nature?: 'FIRST_CONTACT' | 'FOLLOW_UP',
  ): Promise<{ subject: string; body: string }> {
    return this.request('/mailing/test-gemini', {
      method: 'POST',
      body: JSON.stringify({ companyName, nature }),
    });
  },

  async sendTestEmail(
    toEmail: string,
    companyName?: string,
    subject?: string,
    body?: string,
  ): Promise<{
    success: boolean;
    recipient: string;
    companyTarget: string;
    subject: string;
    body: string;
    hasAttachment: boolean;
    attachmentName: string | null;
    messageId: string;
    isSimulation: boolean;
    smtpUser: string | null;
    note: string;
  }> {
    return this.request('/mailing/send-test', {
      method: 'POST',
      body: JSON.stringify({ toEmail, companyName, subject, body }),
    });
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getProfile(): Promise<UserProfile> {
    return this.request('/auth/me');
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    return this.request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
