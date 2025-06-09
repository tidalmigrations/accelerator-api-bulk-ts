import { InputValidator, ValidationError } from '../../src/utils/validation';
import { BulkOperationConfig } from '../../src/types/bulk';

describe('InputValidator', () => {
  describe('validateBulkConfig', () => {
    it('should validate valid configuration', () => {
      const config: Partial<BulkOperationConfig> = {
        batchSize: 50,
        concurrentBatches: 3,
        retryAttempts: 3,
        retryDelay: 1000
      };

      const result = InputValidator.validateBulkConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject invalid batch size', () => {
      const config: Partial<BulkOperationConfig> = {
        batchSize: -1
      };

      const result = InputValidator.validateBulkConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch size must be greater than 0');
    });

    it('should warn about large batch size', () => {
      const config: Partial<BulkOperationConfig> = {
        batchSize: 1500
      };

      const result = InputValidator.validateBulkConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Large batch size may cause performance issues');
    });

    it('should reject invalid concurrent batches', () => {
      const config: Partial<BulkOperationConfig> = {
        concurrentBatches: 0
      };

      const result = InputValidator.validateBulkConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Concurrent batches must be greater than 0');
    });

    it('should warn about high concurrency', () => {
      const config: Partial<BulkOperationConfig> = {
        concurrentBatches: 15
      };

      const result = InputValidator.validateBulkConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('High concurrency may overwhelm the API');
    });

    it('should reject negative retry attempts', () => {
      const config: Partial<BulkOperationConfig> = {
        retryAttempts: -1
      };

      const result = InputValidator.validateBulkConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Retry attempts cannot be negative');
    });

    it('should warn about high retry attempts', () => {
      const config: Partial<BulkOperationConfig> = {
        retryAttempts: 15
      };

      const result = InputValidator.validateBulkConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('High retry attempts may cause long delays');
    });

    it('should reject negative retry delay', () => {
      const config: Partial<BulkOperationConfig> = {
        retryDelay: -100
      };

      const result = InputValidator.validateBulkConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Retry delay cannot be negative');
    });

    it('should warn about long retry delay', () => {
      const config: Partial<BulkOperationConfig> = {
        retryDelay: 35000
      };

      const result = InputValidator.validateBulkConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Long retry delay may cause timeouts');
    });
  });

  describe('validateFilter', () => {
    it('should validate valid filter', () => {
      const filter = {
        environment: 'production',
        status: 'active',
        tags: ['web', 'api']
      };

      const result = InputValidator.validateFilter(filter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object filter', () => {
      const result = InputValidator.validateFilter('invalid');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Filter must be a valid object');
    });

    it('should reject null filter', () => {
      const result = InputValidator.validateFilter(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Filter must be a valid object');
    });

    it('should warn about empty filter', () => {
      const result = InputValidator.validateFilter({});

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Empty filter will match all resources');
    });

    it('should reject invalid ID filter', () => {
      const filter = { id: '' };

      const result = InputValidator.validateFilter(filter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID filter must be a non-empty string');
    });

    it('should reject invalid name filter', () => {
      const filter = { name: 123 };

      const result = InputValidator.validateFilter(filter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name filter must be a non-empty string');
    });

    it('should reject invalid status filter', () => {
      const filter = { status: '' };

      const result = InputValidator.validateFilter(filter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Status filter must be a non-empty string');
    });

    it('should reject invalid environment filter', () => {
      const filter = { environment: null };

      const result = InputValidator.validateFilter(filter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Environment filter must be a non-empty string');
    });

    it('should reject non-array tags filter', () => {
      const filter = { tags: 'not-an-array' };

      const result = InputValidator.validateFilter(filter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tags filter must be an array');
    });

    it('should reject invalid tags in array', () => {
      const filter = { tags: ['valid', '', 'also-valid'] };

      const result = InputValidator.validateFilter(filter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('All tags must be non-empty strings');
    });
  });

  describe('validateUpdates', () => {
    it('should validate valid updates', () => {
      const updates = {
        environment: 'production',
        status: 'active',
        tags: ['web', 'api']
      };

      const result = InputValidator.validateUpdates(updates);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object updates', () => {
      const result = InputValidator.validateUpdates('invalid');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Updates must be a valid object');
    });

    it('should reject null updates', () => {
      const result = InputValidator.validateUpdates(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Updates must be a valid object');
    });

    it('should reject empty updates', () => {
      const result = InputValidator.validateUpdates({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Updates object cannot be empty');
    });

    it('should reject read-only field updates', () => {
      const updates = {
        id: 'new-id',
        created_at: new Date(),
        environment: 'production'
      };

      const result = InputValidator.validateUpdates(updates);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot update read-only fields: id, created_at');
    });

    it('should reject invalid name update', () => {
      const updates = { name: '' };

      const result = InputValidator.validateUpdates(updates);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be a non-empty string');
    });

    it('should reject invalid status update', () => {
      const updates = { status: 123 };

      const result = InputValidator.validateUpdates(updates);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Status must be a non-empty string');
    });

    it('should reject invalid environment update', () => {
      const updates = { environment: '' };

      const result = InputValidator.validateUpdates(updates);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Environment must be a non-empty string');
    });

    it('should reject non-array tags update', () => {
      const updates = { tags: 'not-an-array' };

      const result = InputValidator.validateUpdates(updates);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tags must be an array');
    });

    it('should reject invalid tags in update array', () => {
      const updates = { tags: ['valid', '', 'also-valid'] };

      const result = InputValidator.validateUpdates(updates);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('All tags must be non-empty strings');
    });
  });

  describe('validateWorkspace', () => {
    it('should validate valid workspace', () => {
      const result = InputValidator.validateWorkspace('my-workspace');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-string workspace', () => {
      const result = InputValidator.validateWorkspace(123 as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Workspace must be a non-empty string');
    });

    it('should reject empty workspace', () => {
      const result = InputValidator.validateWorkspace('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Workspace must be a non-empty string');
    });

    it('should reject workspace with invalid characters', () => {
      const result = InputValidator.validateWorkspace('my workspace!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Workspace can only contain letters, numbers, hyphens, and underscores');
    });

    it('should reject workspace that is too long', () => {
      const longWorkspace = 'a'.repeat(51);
      const result = InputValidator.validateWorkspace(longWorkspace);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Workspace name cannot exceed 50 characters');
    });

    it('should accept workspace with valid characters', () => {
      const validWorkspaces = ['workspace', 'work-space', 'work_space', 'workspace123'];

      for (const workspace of validWorkspaces) {
        const result = InputValidator.validateWorkspace(workspace);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('validateResourceType', () => {
    it('should validate known resource types', () => {
      const knownTypes = ['servers', 'applications', 'databases', 'networks', 'storage'];

      for (const type of knownTypes) {
        const result = InputValidator.validateResourceType(type);
        expect(result.isValid).toBe(true);
        expect(result.warnings).toHaveLength(0);
      }
    });

    it('should warn about unknown resource types', () => {
      const result = InputValidator.validateResourceType('unknown-type');

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Unknown resource type: unknown-type. Known types: servers, applications, databases, networks, storage');
    });

    it('should reject non-string resource type', () => {
      const result = InputValidator.validateResourceType(123 as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Resource type must be a non-empty string');
    });

    it('should reject empty resource type', () => {
      const result = InputValidator.validateResourceType('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Resource type must be a non-empty string');
    });
  });
});

describe('ValidationError', () => {
  it('should create validation error with field and value', () => {
    const error = new ValidationError('Invalid value', 'testField', 'testValue');

    expect(error.message).toBe('Invalid value');
    expect(error.field).toBe('testField');
    expect(error.value).toBe('testValue');
    expect(error.name).toBe('ValidationError');
    expect(error instanceof Error).toBe(true);
  });
}); 