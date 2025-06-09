import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ClientConfig, AuthResponse, ApiResponse, RetryConfig } from './types';
import { AuthService } from './auth';
import { handleApiError, ConfigurationError } from '../utils/errors';
import { logger } from '../utils/logger';

export class TidalApiClient {
  private httpClient: AxiosInstance;
  private authService: AuthService;
  private config: ClientConfig;
  private retryConfig: RetryConfig;

  constructor(config: ClientConfig) {
    if (!config.workspace) {
      throw new ConfigurationError('Workspace is required');
    }

    this.config = {
      baseUrl: `https://${config.workspace}.tidal.cloud/api/v1`,
      ...config,
    };

    // Set default retry configuration
    this.retryConfig = {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      enableJitter: true,
      ...config.retry,
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

  /**
   * Retry function with exponential backoff for handling rate limits
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string = 'API call'
  ): Promise<T> {
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isRateLimit = error?.response?.status === 429 || error?.status === 429;
        const isLastAttempt = attempt === this.retryConfig.maxRetries;
        
        if (!isRateLimit || isLastAttempt) {
          throw error;
        }
        
        let delay = this.retryConfig.baseDelay * Math.pow(2, attempt - 1);
        
        // Apply jitter if enabled
        if (this.retryConfig.enableJitter) {
          delay += Math.random() * 1000;
        }
        
        // Cap at max delay
        delay = Math.min(delay, this.retryConfig.maxDelay);
        
        logger.warn(`${operationName} failed with 429 (rate limit). Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${this.retryConfig.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`Max retries (${this.retryConfig.maxRetries}) exceeded for ${operationName}`);
  }

  async authenticate(username: string, password: string): Promise<AuthResponse> {
    logger.info('Authenticating with Tidal API', { username, workspace: this.config.workspace });
    return await this.authService.authenticate({ username, password });
  }

  async get<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return await this.retryWithBackoff(async () => {
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
    }, `GET ${endpoint}`);
  }

  async post<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return await this.retryWithBackoff(async () => {
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
    }, `POST ${endpoint}`);
  }

  async put<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return await this.retryWithBackoff(async () => {
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
    }, `PUT ${endpoint}`);
  }

  async patch<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return await this.retryWithBackoff(async () => {
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
    }, `PATCH ${endpoint}`);
  }

  async delete<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return await this.retryWithBackoff(async () => {
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
    }, `DELETE ${endpoint}`);
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