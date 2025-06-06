import {
  TidalApiError,
  AuthenticationError,
  ConfigurationError,
  NetworkError,
  isApiError,
  handleApiError,
} from '../../src/utils/errors';

describe('Error Utilities', () => {
  describe('TidalApiError', () => {
    it('should create error with all properties', () => {
      const error = new TidalApiError('Test error', 500, 'TEST_ERROR', { detail: 'test' });

      expect(error.message).toBe('Test error');
      expect(error.status).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('TidalApiError');
    });

    it('should create error from ApiError object', () => {
      const apiError = {
        message: 'API Error',
        status: 400,
        code: 'BAD_REQUEST',
        details: { field: 'invalid' },
      };

      const error = TidalApiError.fromApiError(apiError);

      expect(error.message).toBe('API Error');
      expect(error.status).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details).toEqual({ field: 'invalid' });
    });
  });

  describe('AuthenticationError', () => {
    it('should create with default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication failed');
      expect(error.status).toBe(401);
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.name).toBe('AuthenticationError');
    });

    it('should create with custom message', () => {
      const error = new AuthenticationError('Custom auth error');

      expect(error.message).toBe('Custom auth error');
      expect(error.status).toBe(401);
      expect(error.code).toBe('AUTH_ERROR');
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Config missing');

      expect(error.message).toBe('Config missing');
      expect(error.name).toBe('ConfigurationError');
    });
  });

  describe('NetworkError', () => {
    it('should create network error', () => {
      const originalError = new Error('Connection failed');
      const error = new NetworkError('Network issue', originalError);

      expect(error.message).toBe('Network issue');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.details).toBe(originalError);
      expect(error.name).toBe('NetworkError');
    });

    it('should create network error without original error', () => {
      const error = new NetworkError('Network issue');

      expect(error.message).toBe('Network issue');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.details).toBeUndefined();
    });
  });

  describe('isApiError', () => {
    it('should return true for TidalApiError instances', () => {
      const error = new TidalApiError('Test');
      expect(isApiError(error)).toBe(true);
    });

    it('should return true for AuthenticationError instances', () => {
      const error = new AuthenticationError();
      expect(isApiError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Regular error');
      expect(isApiError(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(isApiError({})).toBe(false);
      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
    });
  });

  describe('handleApiError', () => {
    it('should return TidalApiError as-is', () => {
      const originalError = new TidalApiError('Original error');
      const result = handleApiError(originalError);

      expect(result).toBe(originalError);
    });

    it('should handle axios error with response', () => {
      const axiosError = {
        response: {
          status: 404,
          data: { message: 'Not found', code: 'NOT_FOUND' },
        },
        message: 'Request failed',
      };

      const result = handleApiError(axiosError);

      expect(result).toBeInstanceOf(TidalApiError);
      expect(result.message).toBe('Not found');
      expect(result.status).toBe(404);
      expect(result.code).toBe('API_ERROR');
      expect(result.details).toEqual(axiosError.response.data);
    });

    it('should handle axios error with response but no message in data', () => {
      const axiosError = {
        response: {
          status: 500,
          data: {},
        },
        message: 'Internal server error',
      };

      const result = handleApiError(axiosError);

      expect(result).toBeInstanceOf(TidalApiError);
      expect(result.message).toBe('Internal server error');
      expect(result.status).toBe(500);
    });

    it('should handle axios network error', () => {
      const axiosError = {
        request: {},
        message: 'Network Error',
      };

      const result = handleApiError(axiosError);

      expect(result).toBeInstanceOf(NetworkError);
      expect(result.message).toBe('Network request failed');
      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('should handle generic error', () => {
      const genericError = new Error('Something went wrong');

      const result = handleApiError(genericError);

      expect(result).toBeInstanceOf(TidalApiError);
      expect(result.message).toBe('Something went wrong');
    });

    it('should handle error without message', () => {
      const errorWithoutMessage = {};

      const result = handleApiError(errorWithoutMessage);

      expect(result).toBeInstanceOf(TidalApiError);
      expect(result.message).toBe('Unknown error occurred');
    });
  });
}); 