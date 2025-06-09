import { BatchProcessor } from '../../src/utils/batch';

describe('BatchProcessor', () => {
  let batchProcessor: BatchProcessor<number>;

  beforeEach(() => {
    batchProcessor = new BatchProcessor<number>(3, 2); // batch size 3, concurrency 2
  });

  describe('process', () => {
    it('should process all items successfully', async () => {
      const items = [1, 2, 3, 4, 5, 6];
      const operation = jest.fn().mockResolvedValue('success');

      const result = await batchProcessor.process(items, operation);

      expect(result.successful).toEqual(items);
      expect(result.failed).toHaveLength(0);
      expect(result.batchNumber).toBe(2); // 6 items / 3 batch size = 2 batches
      expect(operation).toHaveBeenCalledTimes(6);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle partial failures', async () => {
      const items = [1, 2, 3, 4, 5];
      const operation = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Item 2 failed'))
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Item 4 failed'))
        .mockResolvedValueOnce('success');

      const result = await batchProcessor.process(items, operation);

      expect(result.successful).toEqual([1, 3, 5]);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0].item).toBe(2);
      expect(result.failed[0].error).toBe('Item 2 failed');
      expect(result.failed[1].item).toBe(4);
      expect(result.failed[1].error).toBe('Item 4 failed');
    });

    it('should handle empty items array', async () => {
      const items: number[] = [];
      const operation = jest.fn().mockResolvedValue('success');

      const result = await batchProcessor.process(items, operation);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.batchNumber).toBe(0);
      expect(operation).not.toHaveBeenCalled();
    });

    it('should respect batch size', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const operation = jest.fn().mockResolvedValue('success');

      const result = await batchProcessor.process(items, operation);

      expect(result.successful).toHaveLength(10);
      expect(result.batchNumber).toBe(4); // 10 items / 3 batch size = 4 batches (rounded up)
      expect(operation).toHaveBeenCalledTimes(10);
    });

    it('should handle single item', async () => {
      const items = [42];
      const operation = jest.fn().mockResolvedValue('success');

      const result = await batchProcessor.process(items, operation);

      expect(result.successful).toEqual([42]);
      expect(result.failed).toHaveLength(0);
      expect(result.batchNumber).toBe(1);
      expect(operation).toHaveBeenCalledWith(42);
    });
  });

  describe('processWithRetry', () => {
    it('should retry failed items and eventually succeed', async () => {
      const items = [1, 2, 3];
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success');

      const result = await batchProcessor.processWithRetry(items, operation, 2, 10);

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(operation).toHaveBeenCalledTimes(5); // 3 initial + 2 retries
    });

    it('should respect retry limits', async () => {
      const items = [1, 2];
      const operation = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValue(new Error('Always fails'));

      const result = await batchProcessor.processWithRetry(items, operation, 2, 10);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].item).toBe(2);
      // Should be called: 2 initial + 2 retries for item 2 = 4 times
      expect(operation).toHaveBeenCalledTimes(4);
    });

    it('should use exponential backoff for retries', async () => {
      const items = [1];
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt'))
        .mockRejectedValueOnce(new Error('Second attempt'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      const result = await batchProcessor.processWithRetry(items, operation, 2, 100);
      const endTime = Date.now();

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
      
      // Should take at least 100ms (first retry) + 200ms (second retry) = 300ms
      // Adding some tolerance for test execution time
      expect(endTime - startTime).toBeGreaterThan(250);
    });

    it('should handle no retries (retries = 0)', async () => {
      const items = [1, 2];
      const operation = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Failed'));

      const result = await batchProcessor.processWithRetry(items, operation, 0, 10);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(operation).toHaveBeenCalledTimes(2); // No retries
    });

    it('should throw error if all attempts fail for all items', async () => {
      const items = [1];
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        batchProcessor.processWithRetry(items, operation, 1, 10)
      ).rejects.toThrow('Always fails');
    });
  });

  describe('getOptimalBatchSize', () => {
    it('should return appropriate batch sizes for different item counts', () => {
      expect(BatchProcessor.getOptimalBatchSize(5, 2)).toBe(5);
      expect(BatchProcessor.getOptimalBatchSize(50, 3)).toBe(17); // 50/3 rounded up
      expect(BatchProcessor.getOptimalBatchSize(500, 5)).toBe(50);
      expect(BatchProcessor.getOptimalBatchSize(5000, 10)).toBe(100);
    });

    it('should handle edge cases', () => {
      expect(BatchProcessor.getOptimalBatchSize(0, 1)).toBe(0);
      expect(BatchProcessor.getOptimalBatchSize(1, 1)).toBe(1);
      expect(BatchProcessor.getOptimalBatchSize(10, 1)).toBe(10);
    });
  });

  describe('concurrency control', () => {
    it('should respect concurrency limits', async () => {
      const processor = new BatchProcessor<number>(2, 1); // batch size 2, concurrency 1
      const items = [1, 2, 3, 4, 5, 6];
      
      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;
      
      const operation = jest.fn().mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        concurrentCalls--;
        return 'success';
      });

      await processor.process(items, operation);

      // With concurrency 1 and batch size 2, max concurrent calls should be 2
      expect(maxConcurrentCalls).toBe(2);
      expect(operation).toHaveBeenCalledTimes(6);
    });

    it('should handle higher concurrency', async () => {
      const processor = new BatchProcessor<number>(2, 3); // batch size 2, concurrency 3
      const items = Array.from({ length: 12 }, (_, i) => i + 1);
      
      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;
      
      const operation = jest.fn().mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
        
        await new Promise(resolve => setTimeout(resolve, 20));
        
        concurrentCalls--;
        return 'success';
      });

      await processor.process(items, operation);

      // With 12 items, batch size 2, and concurrency 3, we should see up to 6 concurrent calls
      expect(maxConcurrentCalls).toBe(6);
      expect(operation).toHaveBeenCalledTimes(12);
    });
  });

  describe('error handling', () => {
    it('should handle non-Error exceptions', async () => {
      const items = [1, 2];
      const operation = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce('string error'); // Non-Error object

      const result = await batchProcessor.process(items, operation);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe('string error');
    });

    it('should handle undefined/null errors', async () => {
      const items = [1];
      const operation = jest.fn().mockRejectedValueOnce(null);

      const result = await batchProcessor.process(items, operation);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe('null');
    });
  });
}); 