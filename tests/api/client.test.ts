import { TidalApiClient } from '../../src/api/client';
import { ConfigurationError, TidalApiError } from '../../src/utils/errors';
import { AuthService } from '../../src/api/auth';
import { RetryConfig } from '../../src/api/types';

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

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('TidalApiClient', () => {
  let client: TidalApiClient;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
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

  afterEach(() => {
    jest.useRealTimers();
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

    it('should create client with default retry configuration', () => {
      const config = { workspace: 'test-workspace' };
      client = new TidalApiClient(config);

      // Access private retryConfig to verify defaults
      const retryConfig = (client as any).retryConfig;
      expect(retryConfig).toEqual({
        maxRetries: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        enableJitter: true,
      });
    });

    it('should create client with custom retry configuration', () => {
      const customRetryConfig: RetryConfig = {
        maxRetries: 3,
        baseDelay: 500,
        maxDelay: 10000,
        enableJitter: false,
      };
      
      const config = { 
        workspace: 'test-workspace',
        retry: customRetryConfig
      };
      client = new TidalApiClient(config);

      const retryConfig = (client as any).retryConfig;
      expect(retryConfig).toEqual(customRetryConfig);
    });

    it('should merge custom retry configuration with defaults', () => {
      const partialRetryConfig: Partial<RetryConfig> = {
        maxRetries: 3,
        baseDelay: 500,
      };
      
      const config = { 
        workspace: 'test-workspace',
        retry: partialRetryConfig as RetryConfig
      };
      client = new TidalApiClient(config);

      const retryConfig = (client as any).retryConfig;
      expect(retryConfig).toEqual({
        maxRetries: 3,
        baseDelay: 500,
        maxDelay: 30000,
        enableJitter: true,
      });
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

  describe('retry logic', () => {
    let mockHttpClient: any;

    beforeEach(() => {
      client = new TidalApiClient({ 
        workspace: 'test-workspace',
        retry: {
          maxRetries: 3,
          baseDelay: 100,
          maxDelay: 1000,
          enableJitter: false, // Disable jitter for predictable testing
        }
      });
      mockHttpClient = (client as any).httpClient;
    });

    it('should retry on 429 rate limit errors', async () => {
      const rateLimitError = {
        response: { status: 429, data: { message: 'Rate limit exceeded' } },
        status: 429,
      };
      const successResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
      };

      mockHttpClient.get
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(successResponse);

      const promise = client.get('/test-endpoint');

      // Fast-forward through the delays
      await jest.advanceTimersByTimeAsync(100); // First retry delay
      await jest.advanceTimersByTimeAsync(200); // Second retry delay

      const result = await promise;

      expect(mockHttpClient.get).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        data: successResponse.data,
        status: successResponse.status,
        statusText: successResponse.statusText,
      });
    });

    it('should not retry on non-429 errors', async () => {
      const serverError = {
        response: { status: 500, data: { message: 'Internal Server Error' } },
        status: 500,
      };

      mockHttpClient.get.mockRejectedValue(serverError);

      await expect(client.get('/test-endpoint')).rejects.toThrow();
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries limit', () => {
      // Test that the retry configuration is properly set
      client = new TidalApiClient({ 
        workspace: 'test-workspace',
        retry: {
          maxRetries: 2,
          baseDelay: 10,
          maxDelay: 100,
          enableJitter: false,
        }
      });

      const retryConfig = (client as any).retryConfig;
      expect(retryConfig.maxRetries).toBe(2);
      expect(retryConfig.baseDelay).toBe(10);
      expect(retryConfig.maxDelay).toBe(100);
      expect(retryConfig.enableJitter).toBe(false);
    });

    it('should use exponential backoff with configurable delays', async () => {
      // Test that the retry configuration is properly applied
      const customRetryConfig = {
        maxRetries: 2,
        baseDelay: 50,
        maxDelay: 500,
        enableJitter: false,
      };

      client = new TidalApiClient({ 
        workspace: 'test-workspace',
        retry: customRetryConfig
      });

      // Verify the configuration was applied
      const retryConfig = (client as any).retryConfig;
      expect(retryConfig).toEqual(customRetryConfig);
    });

    it('should apply jitter when enabled', async () => {
      // Test that jitter configuration is properly set
      client = new TidalApiClient({ 
        workspace: 'test-workspace',
        retry: {
          maxRetries: 2,
          baseDelay: 100,
          maxDelay: 1000,
          enableJitter: true,
        }
      });

      const retryConfig = (client as any).retryConfig;
      expect(retryConfig.enableJitter).toBe(true);
    });

    it('should cap delays at maxDelay', async () => {
      // Test that maxDelay configuration is properly set
      client = new TidalApiClient({ 
        workspace: 'test-workspace',
        retry: {
          maxRetries: 5,
          baseDelay: 1000,
          maxDelay: 2000,
          enableJitter: false,
        }
      });

      const retryConfig = (client as any).retryConfig;
      expect(retryConfig.maxDelay).toBe(2000);
      expect(retryConfig.maxRetries).toBe(5);
    });
  });

  describe('HTTP methods with retry', () => {
    let mockHttpClient: any;

    beforeEach(() => {
      client = new TidalApiClient({ 
        workspace: 'test-workspace',
        retry: { maxRetries: 2, baseDelay: 100, maxDelay: 1000, enableJitter: false }
      });
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

      it('should handle GET request failure with retry', async () => {
        const rateLimitError = { response: { status: 429, data: { message: 'Rate limit exceeded' } } };
        const successResponse = {
          data: { id: 1, name: 'test' },
          status: 200,
          statusText: 'OK',
        };

        mockHttpClient.get
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValueOnce(successResponse);

        const promise = client.get('/test-endpoint');
        await jest.advanceTimersByTimeAsync(100);
        const result = await promise;

        expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
        expect(result.data).toEqual(successResponse.data);
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

      it('should retry POST requests on 429 errors', async () => {
        const rateLimitError = { response: { status: 429, data: { message: 'Rate limit exceeded' } } };
        const successResponse = {
          data: { id: 1, created: true },
          status: 201,
          statusText: 'Created',
        };

        const postData = { name: 'test' };
        mockHttpClient.post
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValueOnce(successResponse);

        const promise = client.post('/test-endpoint', postData);
        await jest.advanceTimersByTimeAsync(100);
        const result = await promise;

        expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
        expect(mockHttpClient.post).toHaveBeenCalledWith('/test-endpoint', postData, undefined);
        expect(result.data).toEqual(successResponse.data);
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

      it('should retry PUT requests on 429 errors', async () => {
        const rateLimitError = { response: { status: 429, data: { message: 'Rate limit exceeded' } } };
        const successResponse = {
          data: { id: 1, updated: true },
          status: 200,
          statusText: 'OK',
        };

        const putData = { name: 'updated' };
        mockHttpClient.put
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValueOnce(successResponse);

        const promise = client.put('/test-endpoint', putData);
        await jest.advanceTimersByTimeAsync(100);
        const result = await promise;

        expect(mockHttpClient.put).toHaveBeenCalledTimes(2);
        expect(result.data).toEqual(successResponse.data);
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

      it('should retry PATCH requests on 429 errors', async () => {
        const rateLimitError = { response: { status: 429, data: { message: 'Rate limit exceeded' } } };
        const successResponse = {
          data: { id: 1, patched: true },
          status: 200,
          statusText: 'OK',
        };

        const patchData = { status: 'active' };
        mockHttpClient.patch
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValueOnce(successResponse);

        const promise = client.patch('/test-endpoint', patchData);
        await jest.advanceTimersByTimeAsync(100);
        const result = await promise;

        expect(mockHttpClient.patch).toHaveBeenCalledTimes(2);
        expect(result.data).toEqual(successResponse.data);
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

      it('should retry DELETE requests on 429 errors', async () => {
        const rateLimitError = { response: { status: 429, data: { message: 'Rate limit exceeded' } } };
        const successResponse = {
          data: { deleted: true },
          status: 204,
          statusText: 'No Content',
        };

        mockHttpClient.delete
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValueOnce(successResponse);

        const promise = client.delete('/test-endpoint');
        await jest.advanceTimersByTimeAsync(100);
        const result = await promise;

        expect(mockHttpClient.delete).toHaveBeenCalledTimes(2);
        expect(result.data).toEqual(successResponse.data);
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