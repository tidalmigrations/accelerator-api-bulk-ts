import { BatchResult } from '../types/bulk';
import { Logger, LogLevel } from './logger';

export class BatchProcessor<T> {
  private logger: Logger;

  constructor(
    private batchSize: number,
    private concurrency: number
  ) {
    this.logger = new Logger(LogLevel.INFO);
  }

  /**
   * Process items in batches with the specified operation
   */
  async process(
    items: T[],
    operation: (item: T) => Promise<any>
  ): Promise<BatchResult<T>> {
    const startTime = Date.now();
    const successful: T[] = [];
    const failed: Array<{ item: T; error: string }> = [];

    this.logger.info(`Processing ${items.length} items in batches of ${this.batchSize}`);

    // Split items into batches
    const batches = this.createBatches(items);
    
    // Process batches with concurrency control
    for (let i = 0; i < batches.length; i += this.concurrency) {
      const concurrentBatches = batches.slice(i, i + this.concurrency);
      
      const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
        const actualBatchNumber = i + batchIndex + 1;
        return this.processBatch(batch, operation, actualBatchNumber);
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Aggregate results
      for (const result of batchResults) {
        successful.push(...result.successful);
        failed.push(...result.failed);
      }
    }

    const duration = Date.now() - startTime;
    
    this.logger.info(`Batch processing completed: ${successful.length} successful, ${failed.length} failed`);

    return {
      successful,
      failed,
      batchNumber: batches.length,
      duration
    };
  }

  /**
   * Process items with retry logic
   */
  async processWithRetry(
    items: T[],
    operation: (item: T) => Promise<any>,
    retries: number,
    retryDelay: number = 1000
  ): Promise<BatchResult<T>> {
    let attempt = 0;
    let remainingItems = [...items];
    let allSuccessful: T[] = [];
    let allFailed: Array<{ item: T; error: string }> = [];

    while (attempt <= retries) {
      try {
        const result = await this.process(remainingItems, operation);
        
        // Accumulate successful items
        allSuccessful.push(...result.successful);
        
        // If no failures or we've reached max retries, we're done
        if (result.failed.length === 0 || attempt === retries) {
          // Add any remaining failures to the final result
          allFailed.push(...result.failed);
          break;
        }

        // Prepare for retry with only failed items
        remainingItems = result.failed.map(f => f.item);
        this.logger.warn(`Attempt ${attempt + 1} failed for ${remainingItems.length} items, retrying...`);
        
        if (attempt < retries) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
        
        attempt++;
      } catch (error) {
        this.logger.error(`Batch processing attempt ${attempt + 1} failed:`, error);
        
        if (attempt === retries) {
          // If we have no successful items and all attempts failed, throw the error
          if (allSuccessful.length === 0) {
            throw error;
          }
          // Otherwise, return what we have
          break;
        }
        
        await this.delay(retryDelay * Math.pow(2, attempt));
        attempt++;
      }
    }

    // If ALL items failed after all retries, throw an error (complete failure scenario)
    if (allSuccessful.length === 0 && allFailed.length === items.length && items.length > 0) {
      const lastError = allFailed[allFailed.length - 1]?.error || 'All items failed';
      throw new Error(lastError);
    }

    // Return results regardless of success/failure - let the calling service decide how to handle
    return {
      successful: allSuccessful,
      failed: allFailed,
      batchNumber: Math.ceil(items.length / this.batchSize),
      duration: 0 // This will be calculated by the calling method
    };
  }

  /**
   * Process a single batch
   */
  private async processBatch(
    batch: T[],
    operation: (item: T) => Promise<any>,
    batchNumber: number
  ): Promise<BatchResult<T>> {
    const startTime = Date.now();
    const successful: T[] = [];
    const failed: Array<{ item: T; error: string }> = [];

    this.logger.debug(`Processing batch ${batchNumber} with ${batch.length} items`);

    const promises = batch.map(async (item) => {
      try {
        await operation(item);
        successful.push(item);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push({ item, error: errorMessage });
        this.logger.warn(`Item failed in batch ${batchNumber}:`, errorMessage);
      }
    });

    await Promise.all(promises);

    const duration = Date.now() - startTime;
    
    this.logger.debug(`Batch ${batchNumber} completed: ${successful.length} successful, ${failed.length} failed`);

    return {
      successful,
      failed,
      batchNumber,
      duration
    };
  }

  /**
   * Split items into batches
   */
  private createBatches(items: T[]): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize));
    }
    
    return batches;
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get optimal batch size based on item count and concurrency
   */
  static getOptimalBatchSize(itemCount: number, concurrency: number): number {
    if (itemCount <= 10) return itemCount;
    if (itemCount <= 100) return Math.ceil(itemCount / concurrency);
    if (itemCount <= 1000) return 50;
    return 100;
  }
} 