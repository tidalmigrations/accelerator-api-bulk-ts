#!/usr/bin/env ts-node

/**
 * Memory and Storage Utilization Update Demo
 * 
 * This example demonstrates how to:
 * 1. Read memory and storage utilization data from a CSV file
 * 2. Search for servers by hostname in Tidal
 * 3. Preview changes with dry run mode (--dry-run flag)
 * 4. Update custom fields 'memory-util-pct' and 'storage-util-pct'
 * 5. Update default fields 'ram_used_gb' and 'storage_used_gb' based on utilization percentages
 * 6. Handle batch processing and error reporting
 * 
 * Prerequisites:
 * - Create a .env file based on .env.example
 * - Set TIDAL_WORKSPACE, TIDAL_USERNAME, TIDAL_PASSWORD
 * - Set UTILIZATION_CSV_PATH to point to your CSV file
 * - Ensure the CSV file exists and has the required format
 */

import { createAuthenticatedClient } from '../src/index';
import { ServerBulkOperations } from '../src/operations/servers';
import { AuthenticationError, TidalApiError } from '../src/utils/errors';
import { logger } from '../src/utils/logger';
import { loadConfig } from '../src/config/environment';
import * as fs from 'fs';
import * as path from 'path';

interface UtilizationRecord {
  name: string;
  memoryUtilizationPct: string;
  storageUtilizationPct: string;
}

interface UpdateResult {
  hostname: string;
  serverId?: number;
  memoryUtilization: string;
  storageUtilization: string;
  currentMemoryUtil?: string;
  currentStorageUtil?: string;
  currentRamUsed?: number;
  currentStorageUsed?: number;
  success: boolean;
  error?: string;
  dryRun?: boolean;
  payload?: any;
}

interface DryRunResult {
  hostname: string;
  serverId: number;
  currentMemoryUtil: string;
  newMemoryUtil: string;
  currentStorageUtil: string;
  newStorageUtil: string;
  currentRamUsed: number;
  newRamUsed: number;
  currentStorageUsed: number;
  newStorageUsed: number;
  ramAllocated: number;
  storageAllocated: number;
  changeRequired: boolean;
  payload?: any;
}

async function memoryStorageUtilizationUpdateDemo() {
  console.log('🚀 Memory and Storage Utilization Update Demo\n');
  
  // Check for dry run mode
  const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No actual changes will be made\n');
  }

  try {
    // Create authenticated client
    console.log('🔐 Authenticating with Tidal API...');
    const client = await createAuthenticatedClient();
    console.log('✅ Authentication successful!');
    console.log(`📍 Workspace: ${client.getWorkspace()}`);
    console.log(`🌐 Base URL: ${client.getBaseUrl()}\n`);

    // Initialize server operations
    const serverOps = new ServerBulkOperations(client);

    // Read and parse CSV data
    console.log('📊 Reading utilization data from CSV...');
    const config = loadConfig();
    const csvPath = path.resolve(config.utilizationCsvPath);
    console.log(`📁 Using CSV file: ${path.basename(csvPath)}`);
    const utilizationData = await readUtilizationCsv(csvPath);
    console.log(`✅ Loaded ${utilizationData.length} records from CSV\n`);

    // Show example payload structure
    console.log('📋 Example PUT payload structure:');
    console.log(JSON.stringify({
      custom_fields: {
        'memory-util-pct': '50',
        'storage-util-pct': '75'
      },
      ram_used_gb: 16,
      storage_used_gb: 750
    }, null, 2));
    console.log();

    // Process updates in batches
    if (isDryRun) {
      console.log('🔍 Performing dry run analysis...');
      const dryRunResults = await performDryRun(utilizationData, serverOps, config);
      displayDryRunResults(dryRunResults);
      return;
    }
    
    console.log('🔄 Processing memory and storage utilization updates...');
    const batchSize = config.bulk.batchSize;
    const results: UpdateResult[] = [];
    
    console.log(`⚙️  Using batch size: ${batchSize}, retry attempts: ${config.bulk.retryAttempts}, retry delay: ${config.bulk.retryDelay}ms`);
    
    for (let i = 0; i < utilizationData.length; i += batchSize) {
      const batch = utilizationData.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(utilizationData.length / batchSize);
      
      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      const batchResults = await processBatch(batch, serverOps, false, config);
      results.push(...batchResults);
      
      // Show batch summary with payloads
      const batchSuccessful = batchResults.filter(r => r.success);
      const batchFailed = batchResults.filter(r => !r.success);
      console.log(`   ✅ Successful: ${batchSuccessful.length}, ❌ Failed: ${batchFailed.length}`);
      
      // Show successful updates with payloads
      if (batchSuccessful.length > 0) {
        console.log('\n   📡 Successful Updates in this batch:');
        batchSuccessful.forEach(result => {
          console.log(`   • ${result.hostname} (ID: ${result.serverId})`);
          console.log(`     Memory: ${result.memoryUtilization}%, Storage: ${result.storageUtilization}%`);
          if (result.payload) {
            console.log('     Payload:', JSON.stringify(result.payload, null, 2));
          }
        });
      }

      // Show failed updates with reasons
      if (batchFailed.length > 0) {
        console.log('\n   ❌ Failed Updates in this batch:');
        batchFailed.forEach(result => {
          console.log(`   • ${result.hostname} → ${result.error}`);
          if (result.payload) {
            console.log('     Attempted Payload:', JSON.stringify(result.payload, null, 2));
          }
        });
      }
      
      // Delay between batches based on configuration
      if (i + batchSize < utilizationData.length) {
        const delayMs = config.bulk.retryDelay * 1.5; // Use 1.5x retry delay for batch spacing
        console.log(`\n⏳ Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Generate summary report
    console.log('\n📋 Update Summary Report');
    console.log('========================');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`📊 Total Records: ${results.length}`);
    console.log(`✅ Successful Updates: ${successful.length}`);
    console.log(`❌ Failed Updates: ${failed.length}`);
    console.log(`📈 Success Rate: ${((successful.length / results.length) * 100).toFixed(1)}%\n`);

    // Show successful updates
    if (successful.length > 0) {
      console.log('✅ Successful Updates:');
      successful.forEach(result => {
        console.log(`   • ${result.hostname} (ID: ${result.serverId})`);
        console.log(`     Memory: ${result.memoryUtilization}%, Storage: ${result.storageUtilization}%`);
      });
      console.log();
    }

    // Show failed updates with reasons
    if (failed.length > 0) {
      console.log('❌ Failed Updates:');
      failed.forEach(result => {
        console.log(`   • ${result.hostname} → ${result.error}`);
      });
      console.log();
    }

    // Save detailed report to file
    const reportPath = path.join(process.cwd(), 'reports', `memory-storage-utilization-update-${Date.now()}.json`);
    await saveReport(results, reportPath);
    console.log(`📄 Detailed report saved to: ${reportPath}`);

    console.log('\n🎉 Memory and Storage Utilization Update Demo completed!');

  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('❌ Authentication failed:', error.message);
      console.error('   Please check your credentials in .env file');
    } else if (error instanceof TidalApiError) {
      console.error('❌ API Error:', error.message);
      console.error(`   Status: ${error.status}, Code: ${error.code}`);
    } else if (error instanceof Error && error.name === 'ValidationError') {
      console.error('❌ Validation Error:', error.message);
    } else {
      console.error('❌ Unexpected error:', error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

/**
 * Read and parse utilization data from CSV file
 */
async function readUtilizationCsv(csvPath: string): Promise<UtilizationRecord[]> {
  try {
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header and one data row');
    }

    // Parse header to verify structure
    const header = lines[0].split(',');
    const expectedColumns = ['Name', 'Memory Utilization %', 'Disk Utilization % (Peak)'];
    
    if (header.length < expectedColumns.length) {
      throw new Error(`CSV header must contain columns: ${expectedColumns.join(', ')}`);
    }

    // Parse data rows
    const records: UtilizationRecord[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',');
      
      if (columns.length >= 4) {
        const name = columns[0].trim();
        const memoryUtil = columns[2].trim();
        const storageUtil = columns[3].trim();
        
        // Skip rows with missing or invalid data
        if (name && memoryUtil && storageUtil && memoryUtil !== '-' && storageUtil !== '-') {
          records.push({
            name,
            memoryUtilizationPct: memoryUtil,
            storageUtilizationPct: storageUtil
          });
        }
      }
    }

    return records;
  } catch (error) {
    logger.error('Failed to read CSV file', { error, csvPath });
    throw error;
  }
}

/**
 * Process a batch of utilization records
 */
async function processBatch(
  batch: UtilizationRecord[],
  serverOps: ServerBulkOperations,
  dryRun: boolean = false,
  config?: any
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];

  // Process each record in the batch sequentially to avoid rate limiting
  for (let j = 0; j < batch.length; j++) {
    const record = batch[j];
    console.log(`     Processing ${j + 1}/${batch.length}: ${record.name}`);
    
    const result = await processRecord(record, serverOps, dryRun);
    results.push(result);
    
    // Small delay between individual API calls based on configuration
    if (j < batch.length - 1) {
      const delayMs = config ? Math.max(500, config.bulk.retryDelay / 4) : 500; // Use 1/4 of retry delay, minimum 500ms
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Process a single utilization record
 */
async function processRecord(
  record: UtilizationRecord,
  serverOps: ServerBulkOperations,
  dryRun: boolean = false
): Promise<UpdateResult> {
  try {
    // Search for server by hostname
    logger.debug(`Searching for server with hostname: ${record.name}`);
    const server = await serverOps.findServerByHostname(record.name);
    
    if (!server) {
      return {
        hostname: record.name,
        memoryUtilization: record.memoryUtilizationPct,
        storageUtilization: record.storageUtilizationPct,
        success: false,
        error: 'Server not found'
      };
    }

    // Get current values
    const currentMemoryUtil = server.custom_fields?.['memory-util-pct'] || '';
    const currentStorageUtil = server.custom_fields?.['storage-util-pct'] || '';
    const currentRamUsed = server.ram_used_gb || 0;
    const currentStorageUsed = server.storage_used_gb || 0;

    // Check if RAM and storage allocation values exist
    if (!server.ram_allocated_gb || !server.storage_allocated_gb) {
      return {
        hostname: record.name,
        memoryUtilization: record.memoryUtilizationPct,
        storageUtilization: record.storageUtilizationPct,
        success: false,
        error: `Missing allocation values: RAM=${server.ram_allocated_gb}, Storage=${server.storage_allocated_gb}`
      };
    }

    // Calculate new values
    const memoryUtilDecimal = parseFloat(record.memoryUtilizationPct) / 100;
    const storageUtilDecimal = parseFloat(record.storageUtilizationPct) / 100;
    
    const newRamUsed = server.ram_allocated_gb * memoryUtilDecimal;
    const newStorageUsed = server.storage_allocated_gb * storageUtilDecimal;

    // Prepare update payload
    const payload = {
      custom_fields: {
        'memory-util-pct': record.memoryUtilizationPct,
        'storage-util-pct': record.storageUtilizationPct
      },
      ram_used_gb: parseFloat(newRamUsed.toFixed(2)),
      storage_used_gb: parseFloat(newStorageUsed.toFixed(2))
    };

    // If dry run, return without making changes
    if (dryRun) {
      return {
        hostname: record.name,
        serverId: server.id,
        memoryUtilization: record.memoryUtilizationPct,
        storageUtilization: record.storageUtilizationPct,
        currentMemoryUtil,
        currentStorageUtil,
        currentRamUsed,
        currentStorageUsed,
        success: true,
        dryRun: true,
        payload
      };
    }

    // Update the server
    await serverOps.updateServer(server.id, payload);

    return {
      hostname: record.name,
      serverId: server.id,
      memoryUtilization: record.memoryUtilizationPct,
      storageUtilization: record.storageUtilizationPct,
      currentMemoryUtil,
      currentStorageUtil,
      currentRamUsed,
      currentStorageUsed,
      success: true,
      payload
    };

  } catch (error) {
    return {
      hostname: record.name,
      memoryUtilization: record.memoryUtilizationPct,
      storageUtilization: record.storageUtilizationPct,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Save detailed report to file
 */
async function saveReport(results: UpdateResult[], reportPath: string): Promise<void> {
  try {
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        successRate: `${((results.filter(r => r.success).length / results.length) * 100).toFixed(1)}%`
      },
      results
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to save report', { error, reportPath });
    throw error;
  }
}

/**
 * Perform dry run analysis of utilization updates
 */
async function performDryRun(
  utilizationData: UtilizationRecord[],
  serverOps: ServerBulkOperations,
  config: any
): Promise<DryRunResult[]> {
  console.log('🔍 Analyzing servers and potential changes...\n');

  console.log('💡 Example of PUT payload structure that will be used:');
  console.log('   =======================================');
  console.log('   PUT /servers/{id}');
  console.log('   Payload:');
  console.log('     {');
  console.log('       "custom_fields": {');
  console.log('         "memory-util-pct": "{memory_utilization_value}",');
  console.log('         "storage-util-pct": "{storage_utilization_value}"');
  console.log('       },');
  console.log('       "ram_used_gb": "{calculated_ram_used}",');
  console.log('       "storage_used_gb": "{calculated_storage_used}"');
  console.log('     }\n');

  const batchSize = config.bulk.batchSize;
  const results: DryRunResult[] = [];
  
  console.log(`📊 Analyzing ${utilizationData.length} servers in batches of ${batchSize}...\n`);
  
  for (let i = 0; i < utilizationData.length; i += batchSize) {
    const batch = utilizationData.slice(i, i + batchSize);
    const progress = Math.floor((i / utilizationData.length) * 100);
    console.log(`📊 Progress: ${progress}% (${i}/${utilizationData.length} servers analyzed)`);
    
    for (const record of batch) {
      console.log(`     Processing: ${record.name}`);
      const server = await serverOps.findServerByHostname(record.name);
      
      if (server) {
        // Check if RAM and storage allocation values exist
        if (!server.ram_allocated_gb || !server.storage_allocated_gb) {
          console.log(`     ⚠️  Missing allocation values for ${record.name}`);
          console.log(`     RAM Allocated: ${server.ram_allocated_gb}`);
          console.log(`     Storage Allocated: ${server.storage_allocated_gb}\n`);
          continue;
        }

        const currentMemoryUtil = server.custom_fields?.['memory-util-pct'] || '';
        const currentStorageUtil = server.custom_fields?.['storage-util-pct'] || '';
        const currentRamUsed = server.ram_used_gb || 0;
        const currentStorageUsed = server.storage_used_gb || 0;

        // Calculate new values
        const memoryUtilDecimal = parseFloat(record.memoryUtilizationPct) / 100;
        const storageUtilDecimal = parseFloat(record.storageUtilizationPct) / 100;
        
        const newRamUsed = parseFloat((server.ram_allocated_gb * memoryUtilDecimal).toFixed(2));
        const newStorageUsed = parseFloat((server.storage_allocated_gb * storageUtilDecimal).toFixed(2));

        const payload = {
          custom_fields: {
            'memory-util-pct': record.memoryUtilizationPct,
            'storage-util-pct': record.storageUtilizationPct
          },
          ram_used_gb: newRamUsed,
          storage_used_gb: newStorageUsed
        };
        
        console.log(`     Found server ID: ${server.id}`);
        console.log(`     RAM Allocated: ${server.ram_allocated_gb}GB`);
        console.log(`     Storage Allocated: ${server.storage_allocated_gb}GB`);
        console.log(`     Current Memory util: ${currentMemoryUtil || 'Not set'}`);
        console.log(`     New Memory util: ${record.memoryUtilizationPct}%`);
        console.log(`     Current Storage util: ${currentStorageUtil || 'Not set'}`);
        console.log(`     New Storage util: ${record.storageUtilizationPct}%`);
        console.log('     Payload:', JSON.stringify(payload, null, 2));
        console.log();
        
        results.push({
          hostname: record.name,
          serverId: server.id,
          currentMemoryUtil,
          newMemoryUtil: record.memoryUtilizationPct,
          currentStorageUtil,
          newStorageUtil: record.storageUtilizationPct,
          currentRamUsed,
          newRamUsed,
          currentStorageUsed,
          newStorageUsed,
          ramAllocated: server.ram_allocated_gb,
          storageAllocated: server.storage_allocated_gb,
          changeRequired: currentMemoryUtil !== record.memoryUtilizationPct || 
                         currentStorageUtil !== record.storageUtilizationPct ||
                         currentRamUsed !== newRamUsed ||
                         currentStorageUsed !== newStorageUsed,
          payload
        });
      } else {
        console.log(`     ⚠️  Server not found\n`);
      }
    }
  }

  return results;
}

/**
 * Display dry run results in a formatted way
 */
function displayDryRunResults(dryRunResults: DryRunResult[]): void {
  console.log('\n🔍 DRY RUN ANALYSIS RESULTS');
  console.log('===========================\n');
  
  const changesRequired = dryRunResults.filter(r => r.changeRequired);
  const noChangesRequired = dryRunResults.filter(r => !r.changeRequired);
  
  console.log(`📊 Total Servers Found: ${dryRunResults.length}`);
  console.log(`🔄 Changes Required: ${changesRequired.length}`);
  console.log(`✅ No Changes Required: ${noChangesRequired.length}\n`);
  
  if (changesRequired.length > 0) {
    console.log('\n🔄 SERVERS THAT WOULD BE UPDATED:');
    console.log('==================================');
    changesRequired.forEach(result => {
      console.log(`\n📍 ${result.hostname} (ID: ${result.serverId})`);
      console.log(`   Current Memory Utilization: ${result.currentMemoryUtil || 'Not set'}`);
      console.log(`   New Memory Utilization:     ${result.newMemoryUtil}%`);
      console.log(`   Current Storage Utilization: ${result.currentStorageUtil || 'Not set'}`);
      console.log(`   New Storage Utilization:     ${result.newStorageUtil}%`);
      console.log(`   Current RAM Used: ${result.currentRamUsed.toFixed(2)} GB`);
      console.log(`   New RAM Used:     ${result.newRamUsed.toFixed(2)} GB`);
      console.log(`   Current Storage Used: ${result.currentStorageUsed.toFixed(2)} GB`);
      console.log(`   New Storage Used:     ${result.newStorageUsed.toFixed(2)} GB`);
      
      if (result.payload) {
        console.log('\n   PUT Request that would be sent:');
        console.log(`   ${  '='.repeat(30)}`);
        console.log(`   PUT /servers/${  result.serverId}`);
        console.log('   Payload:');
        console.log(JSON.stringify(result.payload, null, 2).split('\n').map(line => `     ${  line}`).join('\n'));
      }
      console.log('');
    });
  }
  
  if (noChangesRequired.length > 0) {
    console.log('✅ SERVERS WITH NO CHANGES REQUIRED:');
    console.log('====================================');
    noChangesRequired.forEach(result => {
      console.log(`📍 ${result.hostname} (ID: ${result.serverId})`);
      console.log(`   Memory: ${result.currentMemoryUtil}%, Storage: ${result.currentStorageUtil}%`);
      console.log(`   RAM Used: ${result.currentRamUsed.toFixed(2)} GB`);
      console.log(`   Storage Used: ${result.currentStorageUsed.toFixed(2)} GB`);
    });
    console.log('');
  }
  
  console.log('💡 To perform the actual updates, run without --dry-run flag');
  console.log('   Example: npm run demo:memory-storage-utilization');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  memoryStorageUtilizationUpdateDemo().catch(console.error);
}

export { memoryStorageUtilizationUpdateDemo }; 