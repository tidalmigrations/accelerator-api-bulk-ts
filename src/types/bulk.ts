export interface BulkOperationConfig {
  batchSize: number;
  concurrentBatches: number;
  retryAttempts: number;
  retryDelay: number;
  continueOnError: boolean;
  dryRun: boolean;
  enableRollback?: boolean;
  onProgress?: (progress: BulkProgress) => void;
}

export interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining?: number;
  startTime: Date;
  successRate: number;
}

export interface BulkResult {
  operationId: string;
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    item: any;
    error: string;
    timestamp: Date;
  }>;
  duration: number;
  rollbackData?: any[];
}

export interface DryRunResult {
  affectedCount: number;
  preview: Array<{
    id: string;
    currentValues: any;
    proposedChanges: any;
    warnings?: string[];
  }>;
  warnings: string[];
  estimatedDuration: number;
}

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{
    item: T;
    error: string;
  }>;
  batchNumber: number;
  duration: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} 