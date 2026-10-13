import { Platform } from 'react-native';
import { Company, CompanyStats, Status } from '../types/company';
import { AppConfig } from '../types/config';
import { StorageService } from './storage.service';

export const ApiService = {
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = await StorageService.getServerUrl();
    const apiKey = await StorageService.getApiKey();

    const headers: Record<string, string> = {
      'x-api-key': apiKey,
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
    city?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    items: Company[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.status) params.append('status', query.status);
    if (query?.city) params.append('city', query.city);
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
    city?: string;
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
      city?: string;
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
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;

    // 1. Sur Web : utilisation directe du File / Blob du navigateur
    if (Platform.OS === 'web') {
      const formData = new FormData();
      if (
        (typeof Blob !== 'undefined' && webFile instanceof Blob) ||
        (typeof File !== 'undefined' && webFile instanceof File)
      ) {
        formData.append('file', webFile as Blob, fileName);
      } else {
        const res = await fetch(fileUri);
        const blob = await res.blob();
        formData.append('file', blob, fileName);
      }
      return this.request(endpoint, {
        method: 'POST',
        body: formData,
      });
    }

    // 2. Sur Mobile (Android / iOS) : streaming natif via expo-file-system
    try {
      const { File: ExpoFile, UploadType } = await import('expo-file-system');
      const file = new ExpoFile(fileUri);
      const res = await file.upload(url, {
        httpMethod: 'POST',
        uploadType: UploadType.MULTIPART,
        fieldName: 'file',
        mimeType,
        headers: {
          'x-api-key': apiKey,
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
    } catch (uploadErr) {
      if (uploadErr instanceof Error && uploadErr.message.startsWith('Erreur HTTP')) {
        throw uploadErr;
      }
      // Fallback FormData standard
      const formData = new FormData();
      try {
        const res = await fetch(fileUri);
        const blob = await res.blob();
        formData.append('file', blob, fileName);
      } catch {
        formData.append('file', {
          uri: fileUri,
          name: fileName,
          type: mimeType,
        } as unknown as Blob);
      }
      return this.request(endpoint, {
        method: 'POST',
        body: formData,
      });
    }
  },

  async uploadCv(
    fileUri: string,
    fileName: string,
    webFile?: unknown,
  ): Promise<AppConfig> {
    return this.uploadFile<AppConfig>(
      '/config/cv',
      fileUri,
      fileName,
      'application/pdf',
      webFile,
    );
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

  async sendInitialBatch(): Promise<{
    totalFound: number;
    successCount: number;
    failedCount: number;
  }> {
    return this.request('/mailing/send-initial', {
      method: 'POST',
      body: JSON.stringify({}),
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
};
