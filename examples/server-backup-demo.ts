import { TidalApiClient } from '../src/api/client';
import { ServerBulkOperations } from '../src/operations/servers';
import { logger } from '../src/utils/logger';
import { loadConfig, getAuthCredentials } from '../src/config/environment';
import * as path from 'path';

/**
 * Server Backup Demo - Phase 3 Implementation
 * 
 * This example demonstrates the bulk operations feature by creating a comprehensive
 * backup of all servers including each server's detailed information.
 * 
 * Features demonstrated:
 * - Bulk fetching of all servers
 * - Detailed information retrieval for each server in parallel batches
 * - Comprehensive backup with metadata and analysis
 * - File-based backup storage
 * - Environment-driven configuration
 */

async function demonstrateServerBackup() {
  try {
    logger.info('=== Server Backup Demo ===');
    
    // Load configuration and credentials
    const config = loadConfig();
    const credentials = getAuthCredentials();
    
    // Initialize the client
    const client = new TidalApiClient({ workspace: config.workspace });
    
    logger.info('Authenticating with Tidal API...');
    await client.authenticate(credentials.username, credentials.password);
    logger.info('Authentication successful');
    
    // Initialize server operations
    const serverOps = new ServerBulkOperations(client);
    
    // Demo 1: Create a full backup of all servers
    logger.info('\n--- Full Server Backup ---');
    const backupPath = path.join(process.cwd(), 'backups', `servers-full-${Date.now()}.json`);
    
    const fullBackup = await serverOps.createServerBackup(undefined, backupPath);
    
    logger.info('Full backup completed:', {
      total_servers: fullBackup.total_servers,
      workspace: fullBackup.workspace,
      timestamp: fullBackup.timestamp,
      backup_file: backupPath
    });
    
    // Analyze the backup data
    const analysis = analyzeServerBackup(fullBackup);
    logger.info('Backup analysis:', analysis);
    
    logger.info('\n=== Server Backup Demo Completed Successfully ===');
    
  } catch (error) {
    logger.error('Demo failed:', error);
    throw error;
  }
}

/**
 * Analyze server backup data to provide insights
 */
function analyzeServerBackup(backup: any) {
  const servers = backup.servers || [];
  
  const analysis = {
    total_servers: servers.length,
    operating_systems: {} as Record<string, number>,
    virtual_vs_physical: { virtual: 0, physical: 0, unknown: 0 },
    total_cpu_cores: 0,
    total_ram_gb: 0,
    total_storage_gb: 0,
    environments: {} as Record<string, number>,
    zones: {} as Record<string, number>
  };
  
  servers.forEach((server: any) => {
    // Operating systems
    const os = server.operating_system || 'Unknown';
    analysis.operating_systems[os] = (analysis.operating_systems[os] || 0) + 1;
    
    // Virtual vs Physical
    if (server.virtual === 'true' || server.virtual === true) {
      analysis.virtual_vs_physical.virtual++;
    } else if (server.virtual === 'false' || server.virtual === false) {
      analysis.virtual_vs_physical.physical++;
    } else {
      analysis.virtual_vs_physical.unknown++;
    }
    
    // Resource totals
    analysis.total_cpu_cores += server.cpu_count || 0;
    analysis.total_ram_gb += server.ram_allocated_gb || 0;
    analysis.total_storage_gb += server.storage_allocated_gb || 0;
    
    // Environments
    const envId = server.environment_id || 'Unknown';
    analysis.environments[envId] = (analysis.environments[envId] || 0) + 1;
    
    // Zones
    const zone = server.zone || 'Unknown';
    analysis.zones[zone] = (analysis.zones[zone] || 0) + 1;
  });
  
  return analysis;
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateServerBackup()
    .then(() => {
      logger.info('Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Demo failed:', error);
      process.exit(1);
    });
}

export { demonstrateServerBackup, analyzeServerBackup }; 