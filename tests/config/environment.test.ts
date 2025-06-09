import { loadConfig, getAuthCredentials } from '../../src/config/environment';
import { ConfigurationError } from '../../src/utils/errors';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load configuration from environment variables', () => {
      process.env.TIDAL_WORKSPACE = 'test-workspace';
      process.env.TIDAL_BASE_URL = 'https://custom.api.com';
      process.env.LOG_LEVEL = 'debug';

      const config = loadConfig();

      expect(config).toEqual({
        workspace: 'test-workspace',
        baseUrl: 'https://custom.api.com',
        logLevel: 'debug',
        bulk: {
          batchSize: 50,
          concurrentBatches: 3,
          retryAttempts: 3,
          retryDelay: 1000,
        },
      });
    });

    it('should use default values when optional env vars are missing', () => {
      process.env.TIDAL_WORKSPACE = 'test-workspace';
      delete process.env.TIDAL_BASE_URL;
      delete process.env.LOG_LEVEL;

      const config = loadConfig();

      expect(config).toEqual({
        workspace: 'test-workspace',
        baseUrl: 'https://test-workspace.tidal.cloud/api/v1',
        logLevel: 'info',
        bulk: {
          batchSize: 50,
          concurrentBatches: 3,
          retryAttempts: 3,
          retryDelay: 1000,
        },
      });
    });

    it('should throw ConfigurationError when workspace is missing', () => {
      delete process.env.TIDAL_WORKSPACE;

      expect(() => loadConfig()).toThrow(ConfigurationError);
      expect(() => loadConfig()).toThrow('TIDAL_WORKSPACE environment variable is required');
    });
  });

  describe('getAuthCredentials', () => {
    it('should return credentials from environment variables', () => {
      process.env.TIDAL_USERNAME = 'testuser';
      process.env.TIDAL_PASSWORD = 'testpass';

      const credentials = getAuthCredentials();

      expect(credentials).toEqual({
        username: 'testuser',
        password: 'testpass',
      });
    });

    it('should throw ConfigurationError when username is missing', () => {
      delete process.env.TIDAL_USERNAME;
      process.env.TIDAL_PASSWORD = 'testpass';

      expect(() => getAuthCredentials()).toThrow(ConfigurationError);
      expect(() => getAuthCredentials()).toThrow('TIDAL_USERNAME and TIDAL_PASSWORD environment variables are required');
    });

    it('should throw ConfigurationError when password is missing', () => {
      process.env.TIDAL_USERNAME = 'testuser';
      delete process.env.TIDAL_PASSWORD;

      expect(() => getAuthCredentials()).toThrow(ConfigurationError);
      expect(() => getAuthCredentials()).toThrow('TIDAL_USERNAME and TIDAL_PASSWORD environment variables are required');
    });

    it('should throw ConfigurationError when both credentials are missing', () => {
      delete process.env.TIDAL_USERNAME;
      delete process.env.TIDAL_PASSWORD;

      expect(() => getAuthCredentials()).toThrow(ConfigurationError);
      expect(() => getAuthCredentials()).toThrow('TIDAL_USERNAME and TIDAL_PASSWORD environment variables are required');
    });
  });
}); 