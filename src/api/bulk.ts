import { TidalApiClient } from './client';
import { BulkOperationConfig, BulkProgress, BulkResult } from '../types/bulk';
import { BatchProcessor } from '../utils/batch';
import { Logger, LogLevel } from '../utils/logger';
import { InputValidator } from '../utils/validation';
import { v4 as uuidv4 } from 'uuid';

export class BulkOperationsService {
  private logger: Logger;
  private progressCallbacks: Array<(progress: BulkProgress) => void> = [];

  constructor(private client: TidalApiClient) {
    this.logger = new Logger(LogLevel.INFO);
  }

  /**
   * Process a batch of items with the specified operation
   */
  async processBatch<T>(
    items: T[],
    operation: (item: T) => Promise<any>,
    config: Partial<BulkOperationConfig> = {}
  ): Promise<BulkResult> {
    const operationId = uuidv4();
    const startTime = Date.now();

    // Apply default configuration
    const fullConfig: BulkOperationConfig = {
      batchSize: 50,
      concurrentBatches: 3,
      retryAttempts: 3,
      retryDelay: 1000,
      continueOnError: true,
      dryRun: false,
      ...config
    };

    // Validate configuration
    const configValidation = InputValidator.validateBulkConfig(fullConfig);
    if (!configValidation.isValid) {
      throw new Error(`Invalid configuration: ${configValidation.errors.join(', ')}`);
    }

    if (configValidation.warnings.length > 0) {
      this.logger.warn('Configuration warnings:', configValidation.warnings);
    }

    this.logger.info(`Starting bulk operation ${operationId} for ${items.length} items`);

    // Initialize progress tracking
    const progress: BulkProgress = {
      total: items.length,
      completed: 0,
      failed: 0,
      percentage: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(items.length / fullConfig.batchSize),
      startTime: new Date(startTime),
      successRate: 0
    };

    // Notify initial progress
    this.notifyProgress(progress);

    // Create batch processor
    const batchProcessor = new BatchProcessor<T>(
      fullConfig.batchSize,
      fullConfig.concurrentBatches
    );

    let batchResult;
    const errors: Array<{ item: any; error: string; timestamp: Date }> = [];

    try {
      // Process with or without retry based on configuration
      if (fullConfig.retryAttempts > 0) {
        batchResult = await batchProcessor.processWithRetry(
          items,
          operation,
          fullConfig.retryAttempts,
          fullConfig.retryDelay
        );
      } else {
        batchResult = await batchProcessor.process(
          items,
          operation
        );
      }

      // Update progress based on final results
      progress.completed = batchResult.successful.length;
      progress.failed = batchResult.failed.length;
      progress.percentage = Math.round((progress.completed / progress.total) * 100);
      progress.successRate = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

      // Convert batch errors to bulk result format
      for (const failedItem of batchResult.failed) {
        errors.push({
          item: failedItem.item,
          error: failedItem.error,
          timestamp: new Date()
        });
      }

    } catch (error) {
      this.logger.error(`Bulk operation ${operationId} failed:`, error);
      
      // If continueOnError is true, return a result with all items as failed
      if (fullConfig.continueOnError) {
        const duration = Date.now() - startTime;
        
        // Create a result with all items as failed
        const allFailedErrors = items.map(item => ({
          item,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        }));

        progress.failed = items.length;
        progress.completed = 0;
        progress.percentage = 100;
        progress.successRate = 0;
        this.notifyProgress(progress);

        return {
          operationId,
          total: items.length,
          successful: 0,
          failed: items.length,
          errors: allFailedErrors,
          duration
        };
      }
      
      // If continueOnError is false, re-throw the error
      throw error;
    }

    const duration = Date.now() - startTime;
    
    // Final progress update
    this.notifyProgress(progress);

    const result: BulkResult = {
      operationId,
      total: items.length,
      successful: batchResult.successful.length,
      failed: batchResult.failed.length,
      errors,
      duration
    };

    // Check if we should throw an error based on configuration
    if (!fullConfig.continueOnError && batchResult.failed.length > 0) {
      throw new Error(`Bulk operation failed: ${batchResult.failed.length} items failed`);
    }

    this.logger.info(`Bulk operation ${operationId} completed: ${result.successful} successful, ${result.failed} failed in ${duration}ms`);

    return result;
  }

  /**
   * Register a progress callback
   */
  trackProgress(callback: (progress: BulkProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Remove a progress callback
   */
  removeProgressCallback(callback: (progress: BulkProgress) => void): void {
    const index = this.progressCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressCallbacks.splice(index, 1);
    }
  }

  /**
   * Clear all progress callbacks
   */
  clearProgressCallbacks(): void {
    this.progressCallbacks = [];
  }

  /**
   * Notify all registered progress callbacks
   */
  private notifyProgress(progress: BulkProgress): void {
    // Add estimated time remaining
    if (progress.completed > 0) {
      const elapsed = Date.now() - progress.startTime.getTime();
      const avgTimePerItem = elapsed / progress.completed;
      const remaining = progress.total - progress.completed;
      progress.estimatedTimeRemaining = Math.round(avgTimePerItem * remaining);
    }

    // Notify callbacks
    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch (error) {
        this.logger.warn('Progress callback error:', error);
      }
    }

    // Also call the config callback if provided
    if (progress.currentBatch === 0) {
      // This is handled in the operation itself
    }
  }

  /**
   * Get default bulk operation configuration
   */
  static getDefaultConfig(): BulkOperationConfig {
    return {
      batchSize: 50,
      concurrentBatches: 3,
      retryAttempts: 3,
      retryDelay: 1000,
      continueOnError: true,
      dryRun: false
    };
  }

  /**
   * Get optimal configuration based on item count
   */
  static getOptimalConfig(itemCount: number): BulkOperationConfig {
    const defaultConfig = this.getDefaultConfig();

    if (itemCount <= 10) {
      return {
        ...defaultConfig,
        batchSize: itemCount,
        concurrentBatches: 1
      };
    }

    if (itemCount <= 100) {
      return {
        ...defaultConfig,
        batchSize: 10,
        concurrentBatches: 2
      };
    }

    if (itemCount <= 1000) {
      return {
        ...defaultConfig,
        batchSize: 50,
        concurrentBatches: 3
      };
    }

    return {
      ...defaultConfig,
      batchSize: 100,
      concurrentBatches: 5
    };
  }
} 