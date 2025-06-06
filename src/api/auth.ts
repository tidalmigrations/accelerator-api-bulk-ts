import axios, { AxiosInstance } from 'axios';
import { AuthCredentials, AuthResponse } from './types';
import { AuthenticationError, handleApiError } from '../utils/errors';
import { logger } from '../utils/logger';

export class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private httpClient: AxiosInstance;

  constructor(private baseUrl: string) {
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResponse> {
    try {
      logger.info('Attempting authentication', { username: credentials.username });
      
      const response = await this.httpClient.post('/authenticate', {
        username: credentials.username,
        password: credentials.password,
      });

      const authResponse: AuthResponse = response.data;
      
      // Store tokens and expiry
      this.accessToken = authResponse.access_token;
      this.refreshToken = authResponse.refresh_token;
      this.tokenExpiry = new Date(Date.now() + authResponse.expires_in * 1000);

      logger.info('Authentication successful');
      return authResponse;
    } catch (error: any) {
      logger.error('Authentication failed', { error: error.message });
      throw new AuthenticationError('Failed to authenticate with provided credentials');
    }
  }

  isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiry) {
      return false;
    }

    // Check if token expires within the next 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return this.tokenExpiry > fiveMinutesFromNow;
  }

  getAccessToken(): string | null {
    return this.isTokenValid() ? this.accessToken : null;
  }

  async refreshAccessToken(): Promise<AuthResponse> {
    if (!this.refreshToken) {
      throw new AuthenticationError('No refresh token available');
    }

    try {
      logger.info('Refreshing access token');
      
      const response = await this.httpClient.post('/auth/refresh', {
        refresh_token: this.refreshToken,
      });

      const authResponse: AuthResponse = response.data;
      
      // Update tokens and expiry
      this.accessToken = authResponse.access_token;
      this.refreshToken = authResponse.refresh_token;
      this.tokenExpiry = new Date(Date.now() + authResponse.expires_in * 1000);

      logger.info('Token refresh successful');
      return authResponse;
    } catch (error: any) {
      logger.error('Token refresh failed', { error: error.message });
      this.clearTokens();
      throw handleApiError(error);
    }
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    logger.info('Tokens cleared');
  }

  async ensureValidToken(credentials?: AuthCredentials): Promise<string> {
    if (this.isTokenValid()) {
      return this.accessToken!;
    }

    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
        return this.accessToken!;
      } catch (error) {
        logger.warn('Token refresh failed, attempting re-authentication');
      }
    }

    if (credentials) {
      await this.authenticate(credentials);
      return this.accessToken!;
    }

    throw new AuthenticationError('No valid token and no credentials provided for re-authentication');
  }
} 