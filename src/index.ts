// API exports
export { TidalApiClient } from './api/client';
export { AuthService } from './api/auth';
export { BulkOperationsService } from './api/bulk';
export * from './api/types';

// Configuration exports
export * from './config/environment';

// Operations exports
export { BaseBulkOperation } from './operations/base';
export { GenericBulkOperations } from './operations/generic';
export { ServerBulkOperations } from './operations/servers';
export * from './operations/servers';

// Type exports
export * from './types/bulk';

// Utility exports
export * from './utils/errors';
export { Logger, LogLevel, logger } from './utils/logger';
export { BatchProcessor } from './utils/batch';
export { InputValidator, ValidationError } from './utils/validation';

// Example usage
import { TidalApiClient } from './api/client';
import { loadConfig, getAuthCredentials } from './config/environment';
import { logger } from './utils/logger';

export async function createAuthenticatedClient(): Promise<TidalApiClient> {
  try {
    const config = loadConfig();
    const credentials = getAuthCredentials();
    
    const client = new TidalApiClient({
      workspace: config.workspace,
      baseUrl: config.baseUrl,
    });

    await client.authenticate(credentials.username, credentials.password);
    
    logger.info('Client authenticated successfully', { 
      workspace: config.workspace,
      baseUrl: config.baseUrl 
    });
    
    return client;
  } catch (error: any) {
    logger.error('Failed to create authenticated client', { error: error.message });
    throw error;
  }
} 