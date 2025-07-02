import * as dotenv from 'dotenv';
import { ConfigurationError } from '../utils/errors';

// Load environment variables
dotenv.config();

export interface BulkConfig {
  batchSize: number;
  concurrentBatches: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface Config {
  workspace: string;
  baseUrl: string;
  logLevel: string;
  bulk: BulkConfig;
  cpuUtilizationCsvPath: string;
}

export function loadConfig(): Config {
  const workspace = process.env.TIDAL_WORKSPACE;
  const logLevel = process.env.LOG_LEVEL || 'info';

  if (!workspace) {
    throw new ConfigurationError('TIDAL_WORKSPACE environment variable is required');
  }

  // Auto-generate base URL from workspace
  const baseUrl = process.env.TIDAL_BASE_URL || `https://${workspace}.tidal.cloud/api/v1`;

  // Load bulk configuration
  const bulk: BulkConfig = {
    batchSize: parseInt(process.env.BULK_BATCH_SIZE || '50', 10),
    concurrentBatches: parseInt(process.env.BULK_CONCURRENT_BATCHES || '3', 10),
    retryAttempts: parseInt(process.env.BULK_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.BULK_RETRY_DELAY || '1000', 10),
  };

  return {
    workspace,
    baseUrl,
    logLevel,
    bulk,
    cpuUtilizationCsvPath: process.env.CPU_UTILIZATION_CSV_PATH || 'data-examples/server-utilization.csv',
  };
}

export function getAuthCredentials(): { username: string; password: string } {
  const username = process.env.TIDAL_USERNAME;
  const password = process.env.TIDAL_PASSWORD;

  if (!username || !password) {
    throw new ConfigurationError('TIDAL_USERNAME and TIDAL_PASSWORD environment variables are required');
  }

  return { username, password };
} 