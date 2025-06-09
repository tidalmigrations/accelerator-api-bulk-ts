import { BaseBulkOperation } from './base';
import { TidalApiClient } from '../api/client';
import { BulkOperationConfig, BulkResult, ValidationResult } from '../types/bulk';
import { InputValidator } from '../utils/validation';

export class GenericBulkOperations extends BaseBulkOperation<any> {
  constructor(
    client: TidalApiClient,
    private resourceType: string
  ) {
    super(client);
  }

  /**
   * Get the resource type name
   */
  getResourceType(): string {
    return this.resourceType;
  }

  /**
   * Get resources based on filter criteria
   */
  async getResources(filter: any = {}): Promise<any[]> {
    try {
      this.logger.info(`Fetching ${this.resourceType} with filter:`, filter);
      
      // Build query parameters from filter
      const queryParams = this.buildQueryParams(filter);
      const endpoint = `/${this.resourceType}${queryParams}`;
      
      const response = await this.client.get(endpoint);
      
      // Handle different response formats - response.data contains the actual data
      let resources = response.data;
      
      // Check if data has nested structure
      if (resources && typeof resources === 'object') {
        if (resources.items) {
          resources = resources.items;
        } else if (resources[this.resourceType]) {
          resources = resources[this.resourceType];
        }
      }

      // Ensure we have an array
      if (!Array.isArray(resources)) {
        this.logger.warn(`Expected array but got ${typeof resources}, wrapping in array`);
        resources = [resources];
      }

      this.logger.info(`Found ${resources.length} ${this.resourceType}`);
      return resources;
    } catch (error) {
      this.logger.error(`Failed to fetch ${this.resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Update a single resource
   */
  async updateResource(id: string, updates: any): Promise<any> {
    try {
      this.logger.debug(`Updating ${this.resourceType} ${id} with:`, updates);
      
      const endpoint = `/${this.resourceType}/${id}`;
      const response = await this.client.patch(endpoint, updates);
      
      this.logger.debug(`Successfully updated ${this.resourceType} ${id}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to update ${this.resourceType} ${id}:`, error);
      throw error;
    }
  }

  /**
   * Validate filter criteria
   */
  validateFilter(filter: any): ValidationResult {
    // Use generic filter validation
    const baseValidation = InputValidator.validateFilter(filter);
    
    // Add resource-type specific validation if needed
    const resourceTypeValidation = InputValidator.validateResourceType(this.resourceType);
    
    return {
      isValid: baseValidation.isValid && resourceTypeValidation.isValid,
      errors: [...baseValidation.errors, ...resourceTypeValidation.errors],
      warnings: [...baseValidation.warnings, ...resourceTypeValidation.warnings]
    };
  }

  /**
   * Validate update data
   */
  validateUpdates(updates: any): ValidationResult {
    return InputValidator.validateUpdates(updates);
  }

  /**
   * Perform bulk update with resource type specification
   */
  async bulkUpdate(
    filter: any,
    updates: any,
    config?: Partial<BulkOperationConfig>
  ): Promise<BulkResult> {
    this.logger.info(`Starting bulk update for ${this.resourceType}`);
    return super.bulkUpdate(filter, updates, config);
  }

  /**
   * Bulk update with explicit resource type (for backward compatibility)
   */
  async bulkUpdateByType(
    resourceType: string,
    filter: any,
    updates: any,
    config?: Partial<BulkOperationConfig>
  ): Promise<BulkResult> {
    // Temporarily change resource type
    const originalType = this.resourceType;
    this.resourceType = resourceType;
    
    try {
      return await this.bulkUpdate(filter, updates, config);
    } finally {
      // Restore original resource type
      this.resourceType = originalType;
    }
  }

  /**
   * Build query parameters from filter object
   */
  private buildQueryParams(filter: any): string {
    if (!filter || Object.keys(filter).length === 0) {
      return '';
    }

    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Handle array values (e.g., tags)
          value.forEach(item => params.append(key, String(item)));
        } else {
          params.append(key, String(value));
        }
      }
    }

    return params.toString() ? `?${params.toString()}` : '';
  }

  /**
   * Get all resources of this type (no filter)
   */
  async getAllResources(): Promise<any[]> {
    return this.getResources({});
  }

  /**
   * Get resource by ID
   */
  async getResourceById(id: string): Promise<any> {
    try {
      const endpoint = `/${this.resourceType}/${id}`;
      const response = await this.client.get(endpoint);
      return response;
    } catch (error) {
      this.logger.error(`Failed to fetch ${this.resourceType} ${id}:`, error);
      throw error;
    }
  }

  /**
   * Check if a resource exists
   */
  async resourceExists(id: string): Promise<boolean> {
    try {
      await this.getResourceById(id);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Count resources matching filter
   */
  async countResources(filter: any = {}): Promise<number> {
    const resources = await this.getResources(filter);
    return resources.length;
  }

  /**
   * Bulk delete resources (if supported by API)
   */
  async bulkDelete(
    filter: any,
    config?: Partial<BulkOperationConfig>
  ): Promise<BulkResult> {
    this.logger.info(`Starting bulk delete for ${this.resourceType}`);

    // Validate filter
    const filterValidation = this.validateFilter(filter);
    if (!filterValidation.isValid) {
      throw new Error(`Invalid filter: ${filterValidation.errors.join(', ')}`);
    }

    // Get resources to delete
    const resources = await this.getResources(filter);
    this.logger.info(`Found ${resources.length} ${this.resourceType} to delete`);

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

    // Perform bulk delete
    return await this.bulkService.processBatch(
      resources,
      async (resource: any) => {
        const resourceId = this.getResourceId(resource);
        const endpoint = `/${this.resourceType}/${resourceId}`;
        return await this.client.delete(endpoint);
      },
      config
    );
  }
} 