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

  async getCompanies(query?: { search?: string; status?: Status }): Promise<{
    items: Company[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.status) params.append('status', query.status);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/companies${queryString}`);
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
    data: { name?: string; email?: string; phone?: string; notes?: string },
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

  async getConfig(): Promise<AppConfig> {
    return this.request('/config');
  },

  async updateTemplate(template: string): Promise<AppConfig> {
    return this.request('/config/template', {
      method: 'PATCH',
      body: JSON.stringify({ template }),
    });
  },

  async uploadCv(fileUri: string, fileName: string): Promise<AppConfig> {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: 'application/pdf',
    } as unknown as Blob);

    return this.request('/config/cv', {
      method: 'POST',
      body: formData,
    });
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
};
