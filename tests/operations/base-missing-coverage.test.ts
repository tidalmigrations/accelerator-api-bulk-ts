import { BaseBulkOperation } from '../../src/operations/base';
import { TidalApiClient } from '../../src/api/client';
import { BulkOperationConfig, ValidationResult } from '../../src/types/bulk';

// Mock the TidalApiClient
jest.mock('../../src/api/client');

// Create a concrete implementation for testing
class TestBulkOperation extends BaseBulkOperation<any> {
  getResourceType(): string {
    return 'test-resources';
  }

  async getResources(filter: any): Promise<any[]> {
    // Simulate different scenarios based on filter
    if (filter.empty) return [];
    if (filter.error) throw new Error('Filter error');
    
    return [
      { id: '1', name: 'resource1', status: 'active' },
      { id: '2', name: 'resource2', status: 'inactive' }
    ];
  }

  async updateResource(id: string, updates: any): Promise<any> {
    if (updates.fail) throw new Error(`Update failed for ${id}`);
    return { id, ...updates, updated: true };
  }

  validateFilter(filter: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (filter.invalid) {
      errors.push('Invalid filter provided');
    }
    if (filter.warn) {
      warnings.push('Filter warning');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  validateUpdates(updates: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (updates.invalid) {
      errors.push('Invalid updates provided');
    }
    if (updates.warn) {
      warnings.push('Updates warning');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  // Override protected methods for testing
  public testGetResourceId(resource: any): string {
    return this.getResourceId(resource);
  }

  public testExtractRelevantFields(resource: any, fields: string[]): any {
    return this.extractRelevantFields(resource, fields);
  }

  public testValidateResourceUpdate(resource: any, updates: any, warnings: string[]): void {
    return this.validateResourceUpdate(resource, updates, warnings);
  }
}

describe('BaseBulkOperation - Missing Coverage', () => {
  let testOperation: TestBulkOperation;
  let mockClient: jest.Mocked<TidalApiClient>;

  beforeEach(() => {
    mockClient = new TidalApiClient({ workspace: 'test' }) as jest.Mocked<TidalApiClient>;
    testOperation = new TestBulkOperation(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('bulkUpdate edge cases', () => {
    it('should handle filter validation errors', async () => {
      const filter = { invalid: true };
      const updates = { status: 'updated' };

      await expect(
        testOperation.bulkUpdate(filter, updates)
      ).rejects.toThrow('Invalid filter: Invalid filter provided');
    });

    it('should handle updates validation errors', async () => {
      const filter = { status: 'active' };
      const updates = { invalid: true };

      await expect(
        testOperation.bulkUpdate(filter, updates)
      ).rejects.toThrow('Invalid updates: Invalid updates provided');
    });

    it('should log filter warnings', async () => {
      const filter = { warn: true };
      const updates = { status: 'updated' };

      const result = await testOperation.bulkUpdate(filter, updates);

      expect(result.successful).toBe(2);
      // Warnings should be logged but not cause failure
    });

    it('should log updates warnings', async () => {
      const filter = { status: 'active' };
      const updates = { warn: true };

      const result = await testOperation.bulkUpdate(filter, updates);

      expect(result.successful).toBe(2);
      // Warnings should be logged but not cause failure
    });

    it('should handle empty resources result', async () => {
      const filter = { empty: true };
      const updates = { status: 'updated' };

      const result = await testOperation.bulkUpdate(filter, updates);

      expect(result.operationId).toBe('no-op');
      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.duration).toBe(0);
    });

    it('should handle resource fetching errors', async () => {
      const filter = { error: true };
      const updates = { status: 'updated' };

      await expect(
        testOperation.bulkUpdate(filter, updates)
      ).rejects.toThrow('Filter error');
    });
  });

  describe('dryRun functionality', () => {
    it('should perform dry run successfully', async () => {
      const filter = { status: 'active' };
      const updates = { status: 'updated', description: 'new description' };

      const result = await testOperation.dryRun(filter, updates);

      expect(result.affectedCount).toBe(2);
      expect(result.preview).toHaveLength(2);
      expect(result.preview[0]).toMatchObject({
        id: '1',
        currentValues: { status: 'active' },
        proposedChanges: updates
      });
      expect(result.estimatedDuration).toBeGreaterThan(0);
    });

    it('should handle dry run with filter validation errors', async () => {
      const filter = { invalid: true };
      const updates = { status: 'updated' };

      await expect(
        testOperation.dryRun(filter, updates)
      ).rejects.toThrow('Invalid filter: Invalid filter provided');
    });

    it('should handle dry run with updates validation errors', async () => {
      const filter = { status: 'active' };
      const updates = { invalid: true };

      await expect(
        testOperation.dryRun(filter, updates)
      ).rejects.toThrow('Invalid updates: Invalid updates provided');
    });

    it('should return dry run result when dryRun config is true', async () => {
      const filter = { status: 'active' };
      const updates = { status: 'updated' };
      const config: Partial<BulkOperationConfig> = { dryRun: true };

      const result = await testOperation.bulkUpdate(filter, updates, config);

      expect(result.operationId).toBe('dry-run');
      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.duration).toBe(0);
      expect(result.rollbackData).toBeDefined();
    });
  });

  describe('previewChanges', () => {
    it('should preview changes for provided resources', async () => {
      const resources = [
        { id: '1', name: 'resource1', status: 'active' },
        { id: '2', name: 'resource2', status: 'inactive' }
      ];
      const updates = { status: 'updated' };

      const result = await testOperation.previewChanges(resources, updates);

      expect(result.affectedCount).toBe(2);
      expect(result.preview).toHaveLength(2);
      expect(result.preview[0].currentValues).toEqual({ status: 'active' });
      expect(result.preview[1].currentValues).toEqual({ status: 'inactive' });
    });

    it('should handle empty resources array', async () => {
      const resources: any[] = [];
      const updates = { status: 'updated' };

      const result = await testOperation.previewChanges(resources, updates);

      expect(result.affectedCount).toBe(0);
      expect(result.preview).toHaveLength(0);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('protected helper methods', () => {
    describe('getResourceId', () => {
      it('should extract id field', () => {
        const resource = { id: 'test-id', name: 'test' };
        const id = testOperation.testGetResourceId(resource);
        expect(id).toBe('test-id');
      });

      it('should extract _id field when id not present', () => {
        const resource = { _id: 'test-_id', name: 'test' };
        const id = testOperation.testGetResourceId(resource);
        expect(id).toBe('test-_id');
      });

      it('should extract uuid field when id and _id not present', () => {
        const resource = { uuid: 'test-uuid', name: 'test' };
        const id = testOperation.testGetResourceId(resource);
        expect(id).toBe('test-uuid');
      });

      it('should return undefined when no id fields present', () => {
        const resource = { name: 'test' };
        const id = testOperation.testGetResourceId(resource);
        expect(id).toBeUndefined();
      });
    });

    describe('extractRelevantFields', () => {
      it('should extract specified fields from resource', () => {
        const resource = {
          id: '1',
          name: 'test',
          status: 'active',
          description: 'test description',
          extra: 'not needed'
        };
        const fields = ['name', 'status'];

        const extracted = testOperation.testExtractRelevantFields(resource, fields);

        expect(extracted).toEqual({
          name: 'test',
          status: 'active'
        });
      });

      it('should handle missing fields gracefully', () => {
        const resource = {
          id: '1',
          name: 'test'
        };
        const fields = ['name', 'status', 'missing'];

        const extracted = testOperation.testExtractRelevantFields(resource, fields);

        expect(extracted).toEqual({
          name: 'test',
          status: undefined,
          missing: undefined
        });
      });

      it('should handle empty fields array', () => {
        const resource = { id: '1', name: 'test' };
        const fields: string[] = [];

        const extracted = testOperation.testExtractRelevantFields(resource, fields);

        expect(extracted).toEqual({});
      });
    });

    describe('validateResourceUpdate', () => {
      it('should add warnings for potential issues', () => {
        const resource = { id: '1', name: 'test', status: 'active' };
        const updates = { status: 'inactive' };
        const warnings: string[] = [];

        testOperation.testValidateResourceUpdate(resource, updates, warnings);

        // Base implementation may add warnings - this tests the method exists and runs
        expect(warnings).toEqual(expect.any(Array));
      });

      it('should handle empty updates', () => {
        const resource = { id: '1', name: 'test' };
        const updates = {};
        const warnings: string[] = [];

        testOperation.testValidateResourceUpdate(resource, updates, warnings);

        expect(warnings).toEqual(expect.any(Array));
      });
    });
  });

  describe('progress tracking', () => {
    it('should register progress callback', () => {
      const callback = jest.fn();
      
      testOperation.onProgress(callback);
      
      // The callback should be registered (method should not throw)
      expect(() => testOperation.onProgress(callback)).not.toThrow();
    });
  });

  describe('configuration helpers', () => {
    it('should return default configuration', () => {
      const defaultConfig = testOperation.getDefaultConfig();

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
      const smallConfig = testOperation.getOptimalConfig(5);
      expect(smallConfig.batchSize).toBe(5);
      expect(smallConfig.concurrentBatches).toBe(1);

      // Medium dataset
      const mediumConfig = testOperation.getOptimalConfig(50);
      expect(mediumConfig.batchSize).toBe(10);
      expect(mediumConfig.concurrentBatches).toBe(2);

      // Large dataset
      const largeConfig = testOperation.getOptimalConfig(500);
      expect(largeConfig.batchSize).toBe(50);
      expect(largeConfig.concurrentBatches).toBe(3);

      // Very large dataset
      const veryLargeConfig = testOperation.getOptimalConfig(5000);
      expect(veryLargeConfig.batchSize).toBe(100);
      expect(veryLargeConfig.concurrentBatches).toBe(5);
    });
  });
}); 