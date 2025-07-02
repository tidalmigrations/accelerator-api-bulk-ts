import { BulkOperationsService } from '../../src/api/bulk';
import { TidalApiClient } from '../../src/api/client';
import { BulkOperationConfig, BulkProgress } from '../../src/types/bulk';

// Mock the TidalApiClient
jest.mock('../../src/api/client');

describe('BulkOperationsService', () => {
  let mockClient: jest.Mocked<TidalApiClient>;
  let bulkService: BulkOperationsService;

  beforeEach(() => {
    mockClient = new TidalApiClient({ workspace: 'test' }) as jest.Mocked<TidalApiClient>;
    bulkService = new BulkOperationsService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    bulkService.clearProgressCallbacks();
  });

  describe('processBatch', () => {
    it('should process items successfully', async () => {
      const items = [1, 2, 3, 4, 5];
      const operation = jest.fn().mockResolvedValue('success');

      const result = await bulkService.processBatch(items, operation);

      expect(result.total).toBe(5);
      expect(result.successful).toBe(5);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(operation).toHaveBeenCalledTimes(5);
      expect(result.operationId).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle partial failures when continueOnError is true', async () => {
      const items = [1, 2, 3, 4, 5];
      const operation = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Failed item 2'))
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Failed item 4'))
        .mockResolvedValueOnce('success');

      const config: Partial<BulkOperationConfig> = {
        continueOnError: true,
        retryAttempts: 0 // Disable retries for this test
      };

      const result = await bulkService.processBatch(items, operation, config);

      expect(result.total).toBe(5);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].error).toContain('Failed item 2');
      expect(result.errors[1].error).toContain('Failed item 4');
    });

    it('should use custom batch configuration', async () => {
      const items = Array.from({ length: 100 }, (_, i) => i + 1);
      const operation = jest.fn().mockResolvedValue('success');

      const config: Partial<BulkOperationConfig> = {
        batchSize: 10,
        concurrentBatches: 2,
        retryAttempts: 1,
        retryDelay: 100
      };

      const result = await bulkService.processBatch(items, operation, config);

      expect(result.total).toBe(100);
      expect(result.successful).toBe(100);
      expect(operation).toHaveBeenCalledTimes(100);
    });

    it('should validate configuration and throw error for invalid config', async () => {
      const items = [1, 2, 3];
      const operation = jest.fn().mockResolvedValue('success');

      const invalidConfig: Partial<BulkOperationConfig> = {
        batchSize: -1, // Invalid
        concurrentBatches: 0 // Invalid
      };

      await expect(
        bulkService.processBatch(items, operation, invalidConfig)
      ).rejects.toThrow('Invalid configuration');
    });

    it('should handle empty items array', async () => {
      const items: number[] = [];
      const operation = jest.fn().mockResolvedValue('success');

      const result = await bulkService.processBatch(items, operation);

      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('progress tracking', () => {
    it('should track progress and call callbacks', async () => {
      const items = [1, 2, 3, 4, 5];
      const operation = jest.fn().mockResolvedValue('success');
      const progressCallback = jest.fn();

      bulkService.trackProgress(progressCallback);

      await bulkService.processBatch(items, operation);

      expect(progressCallback).toHaveBeenCalled();
      
      // Check that progress was called with valid progress objects
      const calls = progressCallback.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      const lastCall = calls[calls.length - 1][0] as BulkProgress;
      expect(lastCall.total).toBe(5);
      expect(lastCall.completed).toBe(5);
      expect(lastCall.percentage).toBe(100);
      expect(lastCall.successRate).toBe(100);
    });

    it('should handle multiple progress callbacks', async () => {
      const items = [1, 2, 3];
      const operation = jest.fn().mockResolvedValue('success');
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      bulkService.trackProgress(callback1);
      bulkService.trackProgress(callback2);

      await bulkService.processBatch(items, operation);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should remove progress callbacks', async () => {
      const items = [1, 2, 3];
      const operation = jest.fn().mockResolvedValue('success');
      const callback = jest.fn();

      bulkService.trackProgress(callback);
      bulkService.removeProgressCallback(callback);

      await bulkService.processBatch(items, operation);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear all progress callbacks', async () => {
      const items = [1, 2, 3];
      const operation = jest.fn().mockResolvedValue('success');
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      bulkService.trackProgress(callback1);
      bulkService.trackProgress(callback2);
      bulkService.clearProgressCallbacks();

      await bulkService.processBatch(items, operation);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const items = [1, 2, 3];
      const operation = jest.fn().mockResolvedValue('success');
      const faultyCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      bulkService.trackProgress(faultyCallback);

      // Should not throw despite callback error
      await expect(
        bulkService.processBatch(items, operation)
      ).resolves.toBeDefined();

      expect(faultyCallback).toHaveBeenCalled();
    });
  });

  describe('configuration helpers', () => {
    it('should return default configuration', () => {
      const defaultConfig = BulkOperationsService.getDefaultConfig();

      expect(defaultConfig).toEqual({
        batchSize: 50,
        concurrentBatches: 3,
        retryAttempts: 3,
        retryDelay: 1000,
        continueOnError: true,
        dryRun: false
      });
    });

    it('should return optimal configuration for different item counts', () => {
      // Small dataset
      const smallConfig = BulkOperationsService.getOptimalConfig(5);
      expect(smallConfig.batchSize).toBe(5);
      expect(smallConfig.concurrentBatches).toBe(1);

      // Medium dataset
      const mediumConfig = BulkOperationsService.getOptimalConfig(50);
      expect(mediumConfig.batchSize).toBe(10);
      expect(mediumConfig.concurrentBatches).toBe(2);

      // Large dataset
      const largeConfig = BulkOperationsService.getOptimalConfig(500);
      expect(largeConfig.batchSize).toBe(50);
      expect(largeConfig.concurrentBatches).toBe(3);

      // Very large dataset
      const veryLargeConfig = BulkOperationsService.getOptimalConfig(5000);
      expect(veryLargeConfig.batchSize).toBe(100);
      expect(veryLargeConfig.concurrentBatches).toBe(5);
    });
  });

  describe('retry logic', () => {
    it('should retry failed operations', async () => {
      const items = [1, 2, 3];
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success');

      const config: Partial<BulkOperationConfig> = {
        retryAttempts: 2,
        retryDelay: 10 // Short delay for testing
      };

      const result = await bulkService.processBatch(items, operation, config);

      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(operation).toHaveBeenCalledTimes(4); // 1 initial + 3 retry
    });

    it('should respect retry limits', async () => {
      const items = [1];
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      const config: Partial<BulkOperationConfig> = {
        retryAttempts: 2,
        retryDelay: 10
      };

      const result = await bulkService.processBatch(items, operation, config);

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      // Should be called 3 times total (1 initial + 2 retries)
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('progress estimation', () => {
    it('should calculate estimated time remaining', async () => {
      const items = [1, 2, 3, 4, 5];
      const progressUpdates: BulkProgress[] = [];
      
      const operation = jest.fn().mockImplementation(async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      bulkService.trackProgress((progress) => {
        progressUpdates.push({ ...progress });
      });

      await bulkService.processBatch(items, operation);

      // Should have progress updates with time estimates
      const updatesWithEstimates = progressUpdates.filter(p => p.estimatedTimeRemaining !== undefined);
      expect(updatesWithEstimates.length).toBeGreaterThan(0);
    });
  });
}); 