import { 
  AuthCredentials, 
  AuthResponse, 
  RetryConfig, 
  ClientConfig, 
  ApiResponse, 
  ApiError 
} from '../../src/api/types';

describe('API Types', () => {
  describe('AuthCredentials', () => {
    it('should have correct structure', () => {
      const credentials: AuthCredentials = {
        username: 'testuser',
        password: 'testpass',
      };

      expect(credentials).toHaveProperty('username');
      expect(credentials).toHaveProperty('password');
      expect(typeof credentials.username).toBe('string');
      expect(typeof credentials.password).toBe('string');
    });
  });

  describe('AuthResponse', () => {
    it('should have correct structure', () => {
      const authResponse: AuthResponse = {
        access_token: 'token123',
        refresh_token: 'refresh123',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      expect(authResponse).toHaveProperty('access_token');
      expect(authResponse).toHaveProperty('refresh_token');
      expect(authResponse).toHaveProperty('expires_in');
      expect(authResponse).toHaveProperty('token_type');
      expect(typeof authResponse.access_token).toBe('string');
      expect(typeof authResponse.refresh_token).toBe('string');
      expect(typeof authResponse.expires_in).toBe('number');
      expect(typeof authResponse.token_type).toBe('string');
    });
  });

  describe('RetryConfig', () => {
    it('should have correct structure with all required properties', () => {
      const retryConfig: RetryConfig = {
        maxRetries: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        enableJitter: true,
      };

      expect(retryConfig).toHaveProperty('maxRetries');
      expect(retryConfig).toHaveProperty('baseDelay');
      expect(retryConfig).toHaveProperty('maxDelay');
      expect(retryConfig).toHaveProperty('enableJitter');
      expect(typeof retryConfig.maxRetries).toBe('number');
      expect(typeof retryConfig.baseDelay).toBe('number');
      expect(typeof retryConfig.maxDelay).toBe('number');
      expect(typeof retryConfig.enableJitter).toBe('boolean');
    });

    it('should allow different retry configurations', () => {
      const aggressiveRetry: RetryConfig = {
        maxRetries: 10,
        baseDelay: 500,
        maxDelay: 60000,
        enableJitter: false,
      };

      const conservativeRetry: RetryConfig = {
        maxRetries: 2,
        baseDelay: 2000,
        maxDelay: 10000,
        enableJitter: true,
      };

      expect(aggressiveRetry.maxRetries).toBe(10);
      expect(conservativeRetry.maxRetries).toBe(2);
      expect(aggressiveRetry.enableJitter).toBe(false);
      expect(conservativeRetry.enableJitter).toBe(true);
    });
  });

  describe('ClientConfig', () => {
    it('should have correct structure with required workspace', () => {
      const config: ClientConfig = {
        workspace: 'test-workspace',
      };

      expect(config).toHaveProperty('workspace');
      expect(typeof config.workspace).toBe('string');
    });

    it('should allow optional baseUrl', () => {
      const config: ClientConfig = {
        workspace: 'test-workspace',
        baseUrl: 'https://custom.api.com',
      };

      expect(config).toHaveProperty('baseUrl');
      expect(typeof config.baseUrl).toBe('string');
    });

    it('should allow optional retry configuration', () => {
      const retryConfig: RetryConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        enableJitter: true,
      };

      const config: ClientConfig = {
        workspace: 'test-workspace',
        retry: retryConfig,
      };

      expect(config).toHaveProperty('retry');
      expect(config.retry).toEqual(retryConfig);
    });

    it('should allow all optional properties together', () => {
      const config: ClientConfig = {
        workspace: 'test-workspace',
        baseUrl: 'https://custom.api.com',
        retry: {
          maxRetries: 5,
          baseDelay: 2000,
          maxDelay: 20000,
          enableJitter: false,
        },
      };

      expect(config.workspace).toBe('test-workspace');
      expect(config.baseUrl).toBe('https://custom.api.com');
      expect(config.retry?.maxRetries).toBe(5);
      expect(config.retry?.enableJitter).toBe(false);
    });
  });

  describe('ApiResponse', () => {
    it('should have correct structure with generic data type', () => {
      const response: ApiResponse<{ id: number; name: string }> = {
        data: { id: 1, name: 'test' },
        status: 200,
        statusText: 'OK',
      };

      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('statusText');
      expect(typeof response.status).toBe('number');
      expect(typeof response.statusText).toBe('string');
      expect(response.data.id).toBe(1);
      expect(response.data.name).toBe('test');
    });

    it('should work with any data type', () => {
      const stringResponse: ApiResponse<string> = {
        data: 'success',
        status: 200,
        statusText: 'OK',
      };

      const arrayResponse: ApiResponse<number[]> = {
        data: [1, 2, 3],
        status: 200,
        statusText: 'OK',
      };

      expect(typeof stringResponse.data).toBe('string');
      expect(Array.isArray(arrayResponse.data)).toBe(true);
    });
  });

  describe('ApiError', () => {
    it('should have correct structure with required message', () => {
      const error: ApiError = {
        message: 'Something went wrong',
      };

      expect(error).toHaveProperty('message');
      expect(typeof error.message).toBe('string');
    });

    it('should allow optional properties', () => {
      const error: ApiError = {
        message: 'Rate limit exceeded',
        status: 429,
        code: 'RATE_LIMIT',
        details: { retryAfter: 60 },
      };

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.status).toBe(429);
      expect(error.code).toBe('RATE_LIMIT');
      expect(error.details).toEqual({ retryAfter: 60 });
    });

    it('should work with different detail types', () => {
      const errorWithStringDetails: ApiError = {
        message: 'Validation failed',
        details: 'Invalid email format',
      };

      const errorWithObjectDetails: ApiError = {
        message: 'Multiple validation errors',
        details: {
          email: 'Invalid format',
          password: 'Too short',
        },
      };

      expect(typeof errorWithStringDetails.details).toBe('string');
      expect(typeof errorWithObjectDetails.details).toBe('object');
    });
  });
}); 