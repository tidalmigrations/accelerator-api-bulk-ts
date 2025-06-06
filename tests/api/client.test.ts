import { TidalApiClient } from '../../src/api/client';
import { ConfigurationError, TidalApiError } from '../../src/utils/errors';
import { AuthService } from '../../src/api/auth';

// Mock the AuthService
jest.mock('../../src/api/auth');
const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
}));

describe('TidalApiClient', () => {
  let client: TidalApiClient;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock auth service
    mockAuthService = {
      authenticate: jest.fn(),
      getAccessToken: jest.fn(),
      isTokenValid: jest.fn(),
      clearTokens: jest.fn(),
      refreshAccessToken: jest.fn(),
      ensureValidToken: jest.fn(),
    } as any;

    MockedAuthService.mockImplementation(() => mockAuthService);
  });

  describe('constructor', () => {
    it('should create client with valid configuration', () => {
      const config = { workspace: 'test-workspace' };
      client = new TidalApiClient(config);

      expect(client).toBeInstanceOf(TidalApiClient);
      expect(client.getWorkspace()).toBe('test-workspace');
      expect(client.getBaseUrl()).toBe('https://test-workspace.tidal.cloud/api/v1');
    });

    it('should create client with custom base URL', () => {
      const config = { 
        workspace: 'test-workspace',
        baseUrl: 'https://custom.api.com'
      };
      client = new TidalApiClient(config);

      expect(client.getBaseUrl()).toBe('https://custom.api.com');
    });

    it('should throw ConfigurationError when workspace is missing', () => {
      expect(() => {
        new TidalApiClient({ workspace: '' });
      }).toThrow(ConfigurationError);
    });
  });

  describe('authenticate', () => {
    beforeEach(() => {
      client = new TidalApiClient({ workspace: 'test-workspace' });
    });

    it('should authenticate successfully', async () => {
      const mockAuthResponse = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      mockAuthService.authenticate.mockResolvedValue(mockAuthResponse);

      const result = await client.authenticate('username', 'password');

      expect(mockAuthService.authenticate).toHaveBeenCalledWith({
        username: 'username',
        password: 'password',
      });
      expect(result).toEqual(mockAuthResponse);
    });

    it('should handle authentication failure', async () => {
      mockAuthService.authenticate.mockRejectedValue(new Error('Auth failed'));

      await expect(client.authenticate('invalid', 'invalid')).rejects.toThrow();
    });
  });

  describe('HTTP methods', () => {
    let mockHttpClient: any;

    beforeEach(() => {
      client = new TidalApiClient({ workspace: 'test-workspace' });
      mockHttpClient = (client as any).httpClient;
    });

    describe('get', () => {
      it('should make GET request successfully', async () => {
        const mockResponse = {
          data: { id: 1, name: 'test' },
          status: 200,
          statusText: 'OK',
        };

        mockHttpClient.get.mockResolvedValue(mockResponse);

        const result = await client.get('/test-endpoint');

        expect(mockHttpClient.get).toHaveBeenCalledWith('/test-endpoint', undefined);
        expect(result).toEqual({
          data: mockResponse.data,
          status: mockResponse.status,
          statusText: mockResponse.statusText,
        });
      });

      it('should handle GET request failure', async () => {
        const error = new Error('Network error');
        mockHttpClient.get.mockRejectedValue(error);

        await expect(client.get('/test-endpoint')).rejects.toThrow();
      });
    });

    describe('post', () => {
      it('should make POST request successfully', async () => {
        const mockResponse = {
          data: { id: 1, created: true },
          status: 201,
          statusText: 'Created',
        };

        const postData = { name: 'test' };
        mockHttpClient.post.mockResolvedValue(mockResponse);

        const result = await client.post('/test-endpoint', postData);

        expect(mockHttpClient.post).toHaveBeenCalledWith('/test-endpoint', postData, undefined);
        expect(result).toEqual({
          data: mockResponse.data,
          status: mockResponse.status,
          statusText: mockResponse.statusText,
        });
      });
    });

    describe('put', () => {
      it('should make PUT request successfully', async () => {
        const mockResponse = {
          data: { id: 1, updated: true },
          status: 200,
          statusText: 'OK',
        };

        const putData = { name: 'updated' };
        mockHttpClient.put.mockResolvedValue(mockResponse);

        const result = await client.put('/test-endpoint', putData);

        expect(mockHttpClient.put).toHaveBeenCalledWith('/test-endpoint', putData, undefined);
        expect(result).toEqual({
          data: mockResponse.data,
          status: mockResponse.status,
          statusText: mockResponse.statusText,
        });
      });
    });

    describe('patch', () => {
      it('should make PATCH request successfully', async () => {
        const mockResponse = {
          data: { id: 1, patched: true },
          status: 200,
          statusText: 'OK',
        };

        const patchData = { status: 'active' };
        mockHttpClient.patch.mockResolvedValue(mockResponse);

        const result = await client.patch('/test-endpoint', patchData);

        expect(mockHttpClient.patch).toHaveBeenCalledWith('/test-endpoint', patchData, undefined);
        expect(result).toEqual({
          data: mockResponse.data,
          status: mockResponse.status,
          statusText: mockResponse.statusText,
        });
      });
    });

    describe('delete', () => {
      it('should make DELETE request successfully', async () => {
        const mockResponse = {
          data: { deleted: true },
          status: 204,
          statusText: 'No Content',
        };

        mockHttpClient.delete.mockResolvedValue(mockResponse);

        const result = await client.delete('/test-endpoint');

        expect(mockHttpClient.delete).toHaveBeenCalledWith('/test-endpoint', undefined);
        expect(result).toEqual({
          data: mockResponse.data,
          status: mockResponse.status,
          statusText: mockResponse.statusText,
        });
      });
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      client = new TidalApiClient({ 
        workspace: 'test-workspace',
        baseUrl: 'https://custom.api.com'
      });
    });

    it('should return workspace', () => {
      expect(client.getWorkspace()).toBe('test-workspace');
    });

    it('should return base URL', () => {
      expect(client.getBaseUrl()).toBe('https://custom.api.com');
    });

    it('should check authentication status', () => {
      mockAuthService.isTokenValid.mockReturnValue(true);
      expect(client.isAuthenticated()).toBe(true);

      mockAuthService.isTokenValid.mockReturnValue(false);
      expect(client.isAuthenticated()).toBe(false);
    });
  });
}); 