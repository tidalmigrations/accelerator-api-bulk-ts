import { AuthService } from '../../src/api/auth';
import { AuthenticationError } from '../../src/utils/errors';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthService', () => {
  let authService: AuthService;
  const baseUrl = 'https://test-workspace.tidal.cloud/api/v1';

  beforeEach(() => {
    authService = new AuthService(baseUrl);
    jest.clearAllMocks();
    
    // Mock axios.create
    mockedAxios.create.mockReturnValue({
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    } as any);
  });

  describe('authenticate', () => {
    it('should authenticate successfully with valid credentials', async () => {
      const mockResponse = {
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      };

      const mockHttpClient = {
        post: jest.fn().mockResolvedValue(mockResponse),
      };
      
      (authService as any).httpClient = mockHttpClient;

      const credentials = { username: 'testuser', password: 'testpass' };
      const result = await authService.authenticate(credentials);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/authenticate', credentials);
      expect(result).toEqual(mockResponse.data);
      expect(authService.getAccessToken()).toBe('mock-access-token');
      expect(authService.isTokenValid()).toBe(true);
    });

    it('should throw AuthenticationError on failed authentication', async () => {
      const mockHttpClient = {
        post: jest.fn().mockRejectedValue(new Error('Invalid credentials')),
      };
      
      (authService as any).httpClient = mockHttpClient;

      const credentials = { username: 'invalid', password: 'invalid' };

      await expect(authService.authenticate(credentials)).rejects.toThrow(AuthenticationError);
      expect(authService.getAccessToken()).toBeNull();
      expect(authService.isTokenValid()).toBe(false);
    });
  });

  describe('isTokenValid', () => {
    it('should return false when no token is set', () => {
      expect(authService.isTokenValid()).toBe(false);
    });

    it('should return false when token is expired', () => {
      // Set expired token
      (authService as any).accessToken = 'expired-token';
      (authService as any).tokenExpiry = new Date(Date.now() - 1000); // 1 second ago

      expect(authService.isTokenValid()).toBe(false);
    });

    it('should return true when token is valid and not expiring soon', () => {
      // Set valid token
      (authService as any).accessToken = 'valid-token';
      (authService as any).tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      expect(authService.isTokenValid()).toBe(true);
    });

    it('should return false when token expires within 5 minutes', () => {
      // Set token expiring soon
      (authService as any).accessToken = 'expiring-token';
      (authService as any).tokenExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

      expect(authService.isTokenValid()).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      };

      const mockHttpClient = {
        post: jest.fn().mockResolvedValue(mockResponse),
      };
      
      (authService as any).httpClient = mockHttpClient;
      (authService as any).refreshToken = 'existing-refresh-token';

      const result = await authService.refreshAccessToken();

      expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/refresh', {
        refresh_token: 'existing-refresh-token',
      });
      expect(result).toEqual(mockResponse.data);
      expect(authService.getAccessToken()).toBe('new-access-token');
    });

    it('should throw error when no refresh token is available', async () => {
      await expect(authService.refreshAccessToken()).rejects.toThrow(AuthenticationError);
    });

    it('should clear tokens on refresh failure', async () => {
      const mockHttpClient = {
        post: jest.fn().mockRejectedValue(new Error('Refresh failed')),
      };
      
      (authService as any).httpClient = mockHttpClient;
      (authService as any).refreshToken = 'invalid-refresh-token';
      (authService as any).accessToken = 'some-token';

      await expect(authService.refreshAccessToken()).rejects.toThrow();
      expect(authService.getAccessToken()).toBeNull();
    });
  });

  describe('ensureValidToken', () => {
    it('should return existing valid token', async () => {
      (authService as any).accessToken = 'valid-token';
      (authService as any).tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

      const token = await authService.ensureValidToken();
      expect(token).toBe('valid-token');
    });

    it('should refresh token when expired but refresh token available', async () => {
      const mockHttpClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            access_token: 'refreshed-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            token_type: 'Bearer',
          },
        }),
      };
      
      (authService as any).httpClient = mockHttpClient;
      (authService as any).refreshToken = 'valid-refresh-token';
      (authService as any).accessToken = 'expired-token';
      (authService as any).tokenExpiry = new Date(Date.now() - 1000);

      const token = await authService.ensureValidToken();
      expect(token).toBe('refreshed-token');
    });

    it('should authenticate with provided credentials when no valid token', async () => {
      const mockHttpClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            access_token: 'new-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            token_type: 'Bearer',
          },
        }),
      };
      
      (authService as any).httpClient = mockHttpClient;

      const credentials = { username: 'user', password: 'pass' };
      const token = await authService.ensureValidToken(credentials);
      
      expect(token).toBe('new-token');
      expect(mockHttpClient.post).toHaveBeenCalledWith('/authenticate', credentials);
    });

    it('should throw error when no valid token and no credentials provided', async () => {
      await expect(authService.ensureValidToken()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('clearTokens', () => {
    it('should clear all tokens', () => {
      (authService as any).accessToken = 'token';
      (authService as any).refreshToken = 'refresh';
      (authService as any).tokenExpiry = new Date();

      authService.clearTokens();

      expect(authService.getAccessToken()).toBeNull();
      expect((authService as any).refreshToken).toBeNull();
      expect((authService as any).tokenExpiry).toBeNull();
    });
  });
}); 