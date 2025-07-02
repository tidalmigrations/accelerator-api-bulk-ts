#!/usr/bin/env ts-node

/**
 * CPU Utilization Update Demo
 * 
 * This example demonstrates how to:
 * 1. Read CPU utilization data from a CSV file
 * 2. Search for servers by hostname in Tidal
 * 3. Preview changes with dry run mode (--dry-run flag)
 * 4. Update the custom field 'cpu-util-manual-pct' with CPU utilization data
 * 5. Handle batch processing and error reporting
 * 
 * Prerequisites:
 * - Create a .env file based on .env.example
 * - Set TIDAL_WORKSPACE, TIDAL_USERNAME, TIDAL_PASSWORD
 * - Set CPU_UTILIZATION_CSV_PATH to point to your CSV file
 * - Ensure the CSV file exists and has the required format
 */

import { createAuthenticatedClient } from '../src/index';
import { ServerBulkOperations } from '../src/operations/servers';
import { AuthenticationError, TidalApiError } from '../src/utils/errors';
import { logger } from '../src/utils/logger';
import { loadConfig } from '../src/config/environment';
import * as fs from 'fs';
import * as path from 'path';

interface CpuUtilizationRecord {
  name: string;
  cpuUtilizationPct: string;
  memoryUtilizationPct: string;
  diskUtilizationPct: string;
}

interface UpdateResult {
  hostname: string;
  serverId?: number;
  cpuUtilization: string;
  currentValue?: string;
  success: boolean;
  error?: string;
  dryRun?: boolean;
  payload?: any; // The payload that would be sent to the API
}

interface DryRunResult {
  hostname: string;
  serverId: number;
  currentCpuUtil: string;
  newCpuUtil: string;
  changeRequired: boolean;
  payload?: any; // The payload that would be sent to the API
}

async function cpuUtilizationUpdateDemo() {
  console.log('🚀 CPU Utilization Update Demo\n');
  
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
    console.log('📊 Reading CPU utilization data from CSV...');
    const config = loadConfig();
    const csvPath = path.resolve(config.cpuUtilizationCsvPath);
    console.log(`📁 Using CSV file: ${path.basename(csvPath)}`);
    const utilizationData = await readCpuUtilizationCsv(csvPath);
    console.log(`✅ Loaded ${utilizationData.length} records from CSV\n`);

    // Show example payload structure
    console.log('📋 Example PUT payload structure:');
    console.log(JSON.stringify({
      custom_fields: {
        'cpu-util-manual-pct': '50' // Example CPU utilization value
      }
    }, null, 2));
    console.log();

    // Process updates in batches
    if (isDryRun) {
      console.log('🔍 Performing dry run analysis...');
      const dryRunResults = await performDryRun(utilizationData, serverOps, config);
      displayDryRunResults(dryRunResults);
      return;
    }
    
    console.log('🔄 Processing CPU utilization updates...');
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
          console.log(`   • ${result.hostname} (ID: ${result.serverId}) → CPU: ${result.cpuUtilization}%`);
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
        console.log(`   • ${result.hostname} (ID: ${result.serverId}) → CPU: ${result.cpuUtilization}%`);
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
    const reportPath = path.join(process.cwd(), 'reports', `cpu-utilization-update-${Date.now()}.json`);
    await saveReport(results, reportPath);
    console.log(`📄 Detailed report saved to: ${reportPath}`);

    console.log('\n🎉 CPU Utilization Update Demo completed!');

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
 * Read and parse CPU utilization data from CSV file
 */
async function readCpuUtilizationCsv(csvPath: string): Promise<CpuUtilizationRecord[]> {
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
    const expectedColumns = ['Name', 'CPU Utilization %', 'Memory Utilization %', 'Disk Utilization % (Peak)'];
    
    if (header.length < expectedColumns.length) {
      throw new Error(`CSV header must contain columns: ${expectedColumns.join(', ')}`);
    }

    // Parse data rows
    const records: CpuUtilizationRecord[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',');
      
      if (columns.length >= 4) {
        const name = columns[0].trim();
        const cpuUtil = columns[1].trim();
        
        // Skip rows with missing or invalid data
        if (name && cpuUtil && cpuUtil !== '-') {
          records.push({
            name,
            cpuUtilizationPct: cpuUtil,
            memoryUtilizationPct: columns[2].trim(),
            diskUtilizationPct: columns[3].trim()
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
 * Process a batch of CPU utilization records
 */
async function processBatch(
  batch: CpuUtilizationRecord[],
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
    
    // Show payload for this record
    if (result.serverId) {
      console.log('     Payload:', JSON.stringify({
        custom_fields: {
          'cpu-util-manual-pct': record.cpuUtilizationPct
        }
      }, null, 2));
    }
    
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
 * Process a single CPU utilization record
 */
async function processRecord(
  record: CpuUtilizationRecord,
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
        cpuUtilization: record.cpuUtilizationPct,
        success: false,
        error: 'Server not found'
      };
    }

    // Get current value of cpu-util-manual-pct
    const currentValue = server.custom_fields?.['cpu-util-manual-pct'] || '';

    // Prepare update payload
    const payload = {
      custom_fields: {
        'cpu-util-manual-pct': record.cpuUtilizationPct
      }
    };

    // If dry run, return without making changes
    if (dryRun) {
      return {
        hostname: record.name,
        serverId: server.id,
        cpuUtilization: record.cpuUtilizationPct,
        currentValue,
        success: true,
        dryRun: true,
        payload
      };
    }

    // Update the server's CPU utilization
    await serverOps.updateServer(server.id, payload);

    return {
      hostname: record.name,
      serverId: server.id,
      cpuUtilization: record.cpuUtilizationPct,
      currentValue,
      success: true,
      payload
    };

  } catch (error) {
    return {
      hostname: record.name,
      cpuUtilization: record.cpuUtilizationPct,
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
 * Perform dry run analysis of CPU utilization updates
 */
async function performDryRun(
  utilizationData: CpuUtilizationRecord[],
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
  console.log('         "cpu-util-manual-pct": "{utilization_value}"');
  console.log('       }');
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
        const currentValue = server.custom_fields?.['cpu-util-manual-pct'] || '';
        const payload = {
          custom_fields: {
            'cpu-util-manual-pct': record.cpuUtilizationPct
          }
        };
        
        console.log(`     Found server ID: ${server.id}`);
        console.log(`     Current CPU util: ${currentValue || 'Not set'}`);
        console.log(`     New CPU util: ${record.cpuUtilizationPct}`);
        console.log('     Payload:', JSON.stringify(payload, null, 2));
        console.log();
        
        results.push({
          hostname: record.name,
          serverId: server.id,
          currentCpuUtil: currentValue,
          newCpuUtil: record.cpuUtilizationPct,
          changeRequired: currentValue !== record.cpuUtilizationPct,
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
      console.log(`   Current CPU Utilization: ${result.currentCpuUtil}`);
      console.log(`   New CPU Utilization:     ${result.newCpuUtil}%`);
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
      console.log(`📍 ${result.hostname} (ID: ${result.serverId}) - Already set to ${result.currentCpuUtil}%`);
    });
    console.log('');
  }
  
  console.log('💡 To perform the actual updates, run without --dry-run flag');
  console.log('   Example: npm run demo:cpu-utilization');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  cpuUtilizationUpdateDemo().catch(console.error);
}

export { cpuUtilizationUpdateDemo }; 