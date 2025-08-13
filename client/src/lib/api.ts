// API utility for making HTTP requests
const API_BASE_URL = '';

interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

interface ApiError {
  message: string;
  status: number;
  response?: any;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const fullUrl = `${this.baseURL}${url}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      headers: { ...defaultHeaders, ...options.headers },
      credentials: 'include', // Include cookies for authentication
      ...options,
    };

    try {
      const response = await fetch(fullUrl, config);
      const data = await response.json();

      if (!response.ok) {
        const error: ApiError = {
          message: data.message || data.error || 'An error occurred',
          status: response.status,
          response: data,
        };
        throw error;
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        throw error; // Re-throw API errors
      }
      
      // Network or other errors
      throw {
        message: 'Network error or server unavailable',
        status: 0,
        response: null,
      };
    }
  }

  async get<T = any>(url: string, config?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: RequestInit
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: RequestInit
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: RequestInit
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(url: string, config?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }
}

// Create and export the default API instance
export const api = new ApiClient();

// Export the ApiClient class for custom instances if needed
export { ApiClient };
export type { ApiResponse, ApiError };
