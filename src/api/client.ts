import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ClientConfig, AuthResponse, ApiResponse } from './types';
import { AuthService } from './auth';
import { handleApiError, ConfigurationError } from '../utils/errors';
import { logger } from '../utils/logger';

export class TidalApiClient {
  private httpClient: AxiosInstance;
  private authService: AuthService;
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    if (!config.workspace) {
      throw new ConfigurationError('Workspace is required');
    }

    this.config = {
      baseUrl: `https://${config.workspace}.tidal.cloud/api/v1`,
      ...config,
    };

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.authService = new AuthService(this.config.baseUrl!);
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.httpClient.interceptors.request.use(
      async (config) => {
        const token = this.authService.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          logger.warn('Received 401, token may be expired');
          // Token might be expired, clear it
          this.authService.clearTokens();
        }
        return Promise.reject(handleApiError(error));
      }
    );
  }

  async authenticate(username: string, password: string): Promise<AuthResponse> {
    logger.info('Authenticating with Tidal API', { username, workspace: this.config.workspace });
    return await this.authService.authenticate({ username, password });
  }

  async get<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      logger.debug(`GET ${endpoint}`);
      const response = await this.httpClient.get(endpoint, config);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      logger.error(`GET ${endpoint} failed`, { error });
      throw handleApiError(error);
    }
  }

  async post<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      logger.debug(`POST ${endpoint}`);
      const response = await this.httpClient.post(endpoint, data, config);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      logger.error(`POST ${endpoint} failed`, { error });
      throw handleApiError(error);
    }
  }

  async put<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      logger.debug(`PUT ${endpoint}`);
      const response = await this.httpClient.put(endpoint, data, config);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      logger.error(`PUT ${endpoint} failed`, { error });
      throw handleApiError(error);
    }
  }

  async patch<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      logger.debug(`PATCH ${endpoint}`);
      const response = await this.httpClient.patch(endpoint, data, config);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      logger.error(`PATCH ${endpoint} failed`, { error });
      throw handleApiError(error);
    }
  }

  async delete<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      logger.debug(`DELETE ${endpoint}`);
      const response = await this.httpClient.delete(endpoint, config);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      logger.error(`DELETE ${endpoint} failed`, { error });
      throw handleApiError(error);
    }
  }

  getWorkspace(): string {
    return this.config.workspace;
  }

  getBaseUrl(): string {
    return this.config.baseUrl!;
  }

  isAuthenticated(): boolean {
    return this.authService.isTokenValid();
  }
} 