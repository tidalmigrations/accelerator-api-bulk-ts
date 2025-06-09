import { ValidationResult, BulkOperationConfig } from '../types/bulk';

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class InputValidator {
  /**
   * Validate bulk operation configuration
   */
  static validateBulkConfig(config: Partial<BulkOperationConfig>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate batch size
    if (config.batchSize !== undefined) {
      if (config.batchSize <= 0) {
        errors.push('Batch size must be greater than 0');
      } else if (config.batchSize > 1000) {
        warnings.push('Large batch size may cause performance issues');
      }
    }

    // Validate concurrent batches
    if (config.concurrentBatches !== undefined) {
      if (config.concurrentBatches <= 0) {
        errors.push('Concurrent batches must be greater than 0');
      } else if (config.concurrentBatches > 10) {
        warnings.push('High concurrency may overwhelm the API');
      }
    }

    // Validate retry attempts
    if (config.retryAttempts !== undefined) {
      if (config.retryAttempts < 0) {
        errors.push('Retry attempts cannot be negative');
      } else if (config.retryAttempts > 10) {
        warnings.push('High retry attempts may cause long delays');
      }
    }

    // Validate retry delay
    if (config.retryDelay !== undefined) {
      if (config.retryDelay < 0) {
        errors.push('Retry delay cannot be negative');
      } else if (config.retryDelay > 30000) {
        warnings.push('Long retry delay may cause timeouts');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate filter object for resource queries
   */
  static validateFilter(filter: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!filter || typeof filter !== 'object') {
      errors.push('Filter must be a valid object');
      return { isValid: false, errors, warnings };
    }

    // Check for empty filter
    if (Object.keys(filter).length === 0) {
      warnings.push('Empty filter will match all resources');
    }

    // Validate common filter fields
    if (filter.id !== undefined && (typeof filter.id !== 'string' || filter.id.trim() === '')) {
      errors.push('ID filter must be a non-empty string');
    }

    if (filter.name !== undefined && (typeof filter.name !== 'string' || filter.name.trim() === '')) {
      errors.push('Name filter must be a non-empty string');
    }

    if (filter.status !== undefined && (typeof filter.status !== 'string' || filter.status.trim() === '')) {
      errors.push('Status filter must be a non-empty string');
    }

    if (filter.environment !== undefined && (typeof filter.environment !== 'string' || filter.environment.trim() === '')) {
      errors.push('Environment filter must be a non-empty string');
    }

    if (filter.tags !== undefined) {
      if (!Array.isArray(filter.tags)) {
        errors.push('Tags filter must be an array');
      } else if (filter.tags.some((tag: any) => typeof tag !== 'string' || tag.trim() === '')) {
        errors.push('All tags must be non-empty strings');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate updates object for resource modifications
   */
  static validateUpdates(updates: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!updates || typeof updates !== 'object') {
      errors.push('Updates must be a valid object');
      return { isValid: false, errors, warnings };
    }

    // Check for empty updates
    if (Object.keys(updates).length === 0) {
      errors.push('Updates object cannot be empty');
    }

    // Validate that we're not trying to update read-only fields
    const readOnlyFields = ['id', 'created_at', 'updated_at', 'created_by'];
    const readOnlyUpdates = Object.keys(updates).filter(key => readOnlyFields.includes(key));
    
    if (readOnlyUpdates.length > 0) {
      errors.push(`Cannot update read-only fields: ${readOnlyUpdates.join(', ')}`);
    }

    // Validate common update fields
    if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim() === '')) {
      errors.push('Name must be a non-empty string');
    }

    if (updates.status !== undefined && (typeof updates.status !== 'string' || updates.status.trim() === '')) {
      errors.push('Status must be a non-empty string');
    }

    if (updates.environment !== undefined && (typeof updates.environment !== 'string' || updates.environment.trim() === '')) {
      errors.push('Environment must be a non-empty string');
    }

    if (updates.tags !== undefined) {
      if (!Array.isArray(updates.tags)) {
        errors.push('Tags must be an array');
      } else if (updates.tags.some((tag: any) => typeof tag !== 'string' || tag.trim() === '')) {
        errors.push('All tags must be non-empty strings');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate workspace name
   */
  static validateWorkspace(workspace: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!workspace || typeof workspace !== 'string') {
      errors.push('Workspace must be a non-empty string');
    } else {
      if (workspace.trim() === '') {
        errors.push('Workspace cannot be empty');
      }
      
      if (!/^[a-zA-Z0-9-_]+$/.test(workspace)) {
        errors.push('Workspace can only contain letters, numbers, hyphens, and underscores');
      }
      
      if (workspace.length > 50) {
        errors.push('Workspace name cannot exceed 50 characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate resource type
   */
  static validateResourceType(resourceType: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!resourceType || typeof resourceType !== 'string') {
      errors.push('Resource type must be a non-empty string');
    } else {
      const validResourceTypes = ['servers', 'applications', 'databases', 'networks', 'storage'];
      
      if (!validResourceTypes.includes(resourceType)) {
        warnings.push(`Unknown resource type: ${resourceType}. Known types: ${validResourceTypes.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
} 