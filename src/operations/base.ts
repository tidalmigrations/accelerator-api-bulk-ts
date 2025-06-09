import { TidalApiClient } from '../api/client';
import { BulkOperationConfig, BulkResult, DryRunResult, ValidationResult } from '../types/bulk';
import { BulkOperationsService } from '../api/bulk';
import { Logger, LogLevel } from '../utils/logger';

export abstract class BaseBulkOperation<T> {
  protected logger: Logger;
  protected bulkService: BulkOperationsService;

  constructor(protected client: TidalApiClient) {
    this.logger = new Logger(LogLevel.INFO);
    this.bulkService = new BulkOperationsService(client);
  }

  /**
   * Get resources based on filter criteria
   * Must be implemented by subclasses
   */
  abstract getResources(filter: any): Promise<T[]>;

  /**
   * Update a single resource
   * Must be implemented by subclasses
   */
  abstract updateResource(id: string, updates: Partial<T>): Promise<T>;

  /**
   * Validate filter criteria
   * Must be implemented by subclasses
   */
  abstract validateFilter(filter: any): ValidationResult;

  /**
   * Validate update data
   * Must be implemented by subclasses
   */
  abstract validateUpdates(updates: any): ValidationResult;

  /**
   * Get the resource type name (e.g., 'servers', 'applications')
   * Must be implemented by subclasses
   */
  abstract getResourceType(): string;

  /**
   * Perform bulk update operation
   */
  async bulkUpdate(
    filter: any,
    updates: any,
    config?: Partial<BulkOperationConfig>
  ): Promise<BulkResult> {
    this.logger.info(`Starting bulk update for ${this.getResourceType()}`);

    // Validate inputs
    const filterValidation = this.validateFilter(filter);
    if (!filterValidation.isValid) {
      throw new Error(`Invalid filter: ${filterValidation.errors.join(', ')}`);
    }

    const updatesValidation = this.validateUpdates(updates);
    if (!updatesValidation.isValid) {
      throw new Error(`Invalid updates: ${updatesValidation.errors.join(', ')}`);
    }

    // Log warnings
    if (filterValidation.warnings.length > 0) {
      this.logger.warn('Filter warnings:', filterValidation.warnings);
    }
    if (updatesValidation.warnings.length > 0) {
      this.logger.warn('Updates warnings:', updatesValidation.warnings);
    }

    // Get resources to update
    const resources = await this.getResources(filter);
    this.logger.info(`Found ${resources.length} ${this.getResourceType()} matching filter`);

    if (resources.length === 0) {
      return {
        operationId: 'no-op',
        total: 0,
        successful: 0,
        failed: 0,
        errors: [],
        duration: 0
      };
    }

    // Check for dry run
    if (config?.dryRun) {
      this.logger.info('Dry run mode - no actual updates will be performed');
      const dryRunResult = this.performDryRun(resources, updates);
      // Convert DryRunResult to BulkResult for consistency
      return {
        operationId: 'dry-run',
        total: dryRunResult.affectedCount,
        successful: dryRunResult.affectedCount,
        failed: 0,
        errors: [],
        duration: 0,
        rollbackData: dryRunResult.preview
      };
    }

    // Perform bulk update
    const result = await this.bulkService.processBatch(
      resources,
      async (resource: T) => {
        const resourceId = this.getResourceId(resource);
        return await this.updateResource(resourceId, updates);
      },
      config
    );

    this.logger.info(`Bulk update completed: ${result.successful} successful, ${result.failed} failed`);
    return result;
  }

  /**
   * Perform a dry run to preview changes
   */
  async dryRun(filter: any, updates: any): Promise<DryRunResult> {
    this.logger.info(`Performing dry run for ${this.getResourceType()}`);

    // Validate inputs
    const filterValidation = this.validateFilter(filter);
    if (!filterValidation.isValid) {
      throw new Error(`Invalid filter: ${filterValidation.errors.join(', ')}`);
    }

    const updatesValidation = this.validateUpdates(updates);
    if (!updatesValidation.isValid) {
      throw new Error(`Invalid updates: ${updatesValidation.errors.join(', ')}`);
    }

    // Get resources that would be affected
    const resources = await this.getResources(filter);
    
    return this.performDryRun(resources, updates);
  }

  /**
   * Preview changes for a set of resources
   */
  async previewChanges(resources: T[], updates: any): Promise<DryRunResult> {
    return this.performDryRun(resources, updates);
  }

  /**
   * Internal method to perform dry run logic
   */
  private performDryRun(resources: T[], updates: any): DryRunResult {
    const warnings: string[] = [];
    const preview: Array<{
      id: string;
      currentValues: any;
      proposedChanges: any;
      warnings?: string[];
    }> = [];

    for (const resource of resources) {
      const resourceId = this.getResourceId(resource);
      const currentValues = this.extractRelevantFields(resource, Object.keys(updates));
      const itemWarnings: string[] = [];

      // Check for potential issues
      this.validateResourceUpdate(resource, updates, itemWarnings);

      preview.push({
        id: resourceId,
        currentValues,
        proposedChanges: updates,
        warnings: itemWarnings.length > 0 ? itemWarnings : undefined
      });

      warnings.push(...itemWarnings);
    }

    // Estimate duration (rough calculation)
    const estimatedDuration = Math.ceil(resources.length / 50) * 1000; // Assume 50 items per second

    return {
      affectedCount: resources.length,
      preview,
      warnings,
      estimatedDuration
    };
  }

  /**
   * Extract resource ID from resource object
   * Can be overridden by subclasses if ID field is different
   */
  protected getResourceId(resource: T): string {
    const resourceAny = resource as any;
    return resourceAny.id || resourceAny._id || resourceAny.uuid;
  }

  /**
   * Extract relevant fields from resource for comparison
   */
  protected extractRelevantFields(resource: T, fields: string[]): any {
    const resourceAny = resource as any;
    const extracted: any = {};
    
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(resourceAny, field)) {
        extracted[field] = resourceAny[field];
      }
    }
    
    return extracted;
  }

  /**
   * Validate a specific resource update
   * Can be overridden by subclasses for resource-specific validation
   */
  protected validateResourceUpdate(resource: T, updates: any, warnings: string[]): void {
    // Default implementation - can be overridden
    const resourceAny = resource as any;
    
    // Check if trying to update to the same value
    for (const [key, value] of Object.entries(updates)) {
      if (resourceAny[key] === value) {
        warnings.push(`${key} is already set to '${value}'`);
      }
    }
  }

  /**
   * Register progress tracking callback
   */
  onProgress(callback: (progress: any) => void): void {
    this.bulkService.trackProgress(callback);
  }

  /**
   * Get default configuration for this resource type
   */
  getDefaultConfig(): BulkOperationConfig {
    return BulkOperationsService.getDefaultConfig();
  }

  /**
   * Get optimal configuration based on expected item count
   */
  getOptimalConfig(itemCount: number): BulkOperationConfig {
    return BulkOperationsService.getOptimalConfig(itemCount);
  }
} 