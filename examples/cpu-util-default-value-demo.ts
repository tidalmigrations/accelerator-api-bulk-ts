#!/usr/bin/env ts-node

/**
 * CPU Utilization Default Value Demo
 * 
 * This example demonstrates how to:
 * 1. Fetch all servers from the Tidal API
 * 2. Identify servers where the 'cpu-util-manual-pct' custom field is not set
 * 3. Preview changes with dry run mode (--dry-run flag)
 * 4. Set the 'cpu-util-manual-pct' custom field to 100 for servers without a value
 * 5. Handle batch processing and error reporting
 * 
 * Prerequisites:
 * - Create a .env file based on .env.example
 * - Set TIDAL_WORKSPACE, TIDAL_USERNAME, TIDAL_PASSWORD
 */

import { createAuthenticatedClient } from '../src/index';
import { ServerBulkOperations, Server } from '../src/operations/servers';
import { AuthenticationError, TidalApiError } from '../src/utils/errors';
import { logger } from '../src/utils/logger';
import { loadConfig } from '../src/config/environment';
import * as fs from 'fs';
import * as path from 'path';

interface UpdateResult {
  hostname: string;
  serverId: number;
  currentValue?: string;
  newValue: string;
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

async function cpuUtilDefaultValueDemo() {
  console.log('🚀 CPU Utilization Default Value Demo\n');
  
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

    // Fetch all servers from the API
    console.log('📊 Fetching all servers from Tidal API...');
    const allServers = await serverOps.getServers();
    console.log(`✅ Retrieved ${allServers.length} servers from API\n`);

    // Filter servers that need the default CPU utilization value
    console.log('🔍 Analyzing servers for missing CPU utilization values...');
    const serversNeedingUpdate = allServers.filter(server => {
      const currentValue = server.custom_fields?.['cpu-util-manual-pct'];
      return !currentValue || currentValue === '' || currentValue === null || currentValue === undefined;
    });

    console.log(`📋 Found ${serversNeedingUpdate.length} servers without CPU utilization values`);
    console.log(`📊 ${allServers.length - serversNeedingUpdate.length} servers already have CPU utilization values set\n`);

    if (serversNeedingUpdate.length === 0) {
      console.log('🎉 All servers already have CPU utilization values set!');
      return;
    }

    // Show example payload structure
    console.log('📋 Example PUT payload structure:');
    console.log(JSON.stringify({
      custom_fields: {
        'cpu-util-manual-pct': '100' // Default CPU utilization value
      }
    }, null, 2));
    console.log();

    // Load configuration
    const config = loadConfig();

    // Process updates in batches
    if (isDryRun) {
      console.log('🔍 Performing dry run analysis...');
      const dryRunResults = await performDryRun(serversNeedingUpdate, serverOps, config);
      displayDryRunResults(dryRunResults);
      return;
    }
    
    console.log('🔄 Processing CPU utilization default value updates...');
    const batchSize = config.bulk.batchSize;
    const results: UpdateResult[] = [];
    
    console.log(`⚙️  Using batch size: ${batchSize}, retry attempts: ${config.bulk.retryAttempts}, retry delay: ${config.bulk.retryDelay}ms`);
    
    for (let i = 0; i < serversNeedingUpdate.length; i += batchSize) {
      const batch = serversNeedingUpdate.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(serversNeedingUpdate.length / batchSize);
      
      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} servers)...`);
      
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
          console.log(`   • ${result.hostname} (ID: ${result.serverId}) → CPU: ${result.newValue}%`);
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
      if (i + batchSize < serversNeedingUpdate.length) {
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
    
    console.log(`📊 Total Servers Needing Update: ${results.length}`);
    console.log(`✅ Successful Updates: ${successful.length}`);
    console.log(`❌ Failed Updates: ${failed.length}`);
    console.log(`📈 Success Rate: ${((successful.length / results.length) * 100).toFixed(1)}%\n`);

    // Show successful updates
    if (successful.length > 0) {
      console.log('✅ Successful Updates:');
      successful.forEach(result => {
        console.log(`   • ${result.hostname} (ID: ${result.serverId}) → CPU: ${result.newValue}%`);
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
    const reportPath = path.join(process.cwd(), 'reports', `cpu-util-default-value-${Date.now()}.json`);
    await saveReport(results, reportPath);
    console.log(`📄 Detailed report saved to: ${reportPath}`);

    console.log('\n🎉 CPU Utilization Default Value Demo completed!');

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
 * Process a batch of servers that need CPU utilization default values
 */
async function processBatch(
  batch: Server[],
  serverOps: ServerBulkOperations,
  dryRun: boolean = false,
  config?: any
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];

  // Process each server in the batch sequentially to avoid rate limiting
  for (let j = 0; j < batch.length; j++) {
    const server = batch[j];
    console.log(`     Processing ${j + 1}/${batch.length}: ${server.host_name} (ID: ${server.id})`);
    
    const result = await processServer(server, serverOps, dryRun);
    
    // Show payload for this server
    if (result.payload) {
      console.log('     Payload:', JSON.stringify(result.payload, null, 2));
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
 * Process a single server to set default CPU utilization value
 */
async function processServer(
  server: Server,
  serverOps: ServerBulkOperations,
  dryRun: boolean = false
): Promise<UpdateResult> {
  try {
    // Get current value of cpu-util-manual-pct
    const currentValue = server.custom_fields?.['cpu-util-manual-pct'] || '';
    const newValue = '100'; // Default CPU utilization value

    // Prepare update payload
    const payload = {
      custom_fields: {
        'cpu-util-manual-pct': newValue
      }
    };

    // If dry run, return without making changes
    if (dryRun) {
      return {
        hostname: server.host_name || `Server-${server.id}`,
        serverId: server.id,
        currentValue,
        newValue,
        success: true,
        dryRun: true,
        payload
      };
    }

    // Update the server's CPU utilization
    await serverOps.updateServer(server.id, payload);

    return {
      hostname: server.host_name || `Server-${server.id}`,
      serverId: server.id,
      currentValue,
      newValue,
      success: true,
      payload
    };

  } catch (error) {
    return {
      hostname: server.host_name || `Server-${server.id}`,
      serverId: server.id,
      currentValue: server.custom_fields?.['cpu-util-manual-pct'] || '',
      newValue: '100',
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
 * Perform dry run analysis of CPU utilization default value updates
 */
async function performDryRun(
  serversNeedingUpdate: Server[],
  serverOps: ServerBulkOperations,
  config: any
): Promise<DryRunResult[]> {
  console.log('🔍 Analyzing servers that need default CPU utilization values...\n');

  console.log('💡 Example of PUT payload structure that will be used:');
  console.log('   =======================================');
  console.log('   PUT /servers/{id}');
  console.log('   Payload:');
  console.log('     {');
  console.log('       "custom_fields": {');
  console.log('         "cpu-util-manual-pct": "100"');
  console.log('       }');
  console.log('     }\n');

  const batchSize = config.bulk.batchSize;
  const results: DryRunResult[] = [];
  
  console.log(`📊 Analyzing ${serversNeedingUpdate.length} servers in batches of ${batchSize}...\n`);
  
  for (let i = 0; i < serversNeedingUpdate.length; i += batchSize) {
    const batch = serversNeedingUpdate.slice(i, i + batchSize);
    const progress = Math.floor((i / serversNeedingUpdate.length) * 100);
    console.log(`📊 Progress: ${progress}% (${i}/${serversNeedingUpdate.length} servers analyzed)`);
    
    for (const server of batch) {
      const hostname = server.host_name || `Server-${server.id}`;
      console.log(`     Processing: ${hostname} (ID: ${server.id})`);
      
      const currentValue = server.custom_fields?.['cpu-util-manual-pct'] || '';
      const newValue = '100';
      const payload = {
        custom_fields: {
          'cpu-util-manual-pct': newValue
        }
      };
      
      console.log(`     Current CPU util: ${currentValue || 'Not set'}`);
      console.log(`     New CPU util: ${newValue}`);
      console.log('     Payload:', JSON.stringify(payload, null, 2));
      console.log();
      
      results.push({
        hostname,
        serverId: server.id,
        currentCpuUtil: currentValue,
        newCpuUtil: newValue,
        changeRequired: true, // All servers in this list need the update
        payload
      });
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
  
  console.log(`📊 Total Servers That Would Be Updated: ${dryRunResults.length}`);
  console.log(`🔄 All servers will have CPU utilization set to: 100%\n`);
  
  if (dryRunResults.length > 0) {
    console.log('\n🔄 SERVERS THAT WOULD BE UPDATED:');
    console.log('==================================');
    dryRunResults.forEach(result => {
      console.log(`\n📍 ${result.hostname} (ID: ${result.serverId})`);
      console.log(`   Current CPU Utilization: ${result.currentCpuUtil || 'Not set'}`);
      console.log(`   New CPU Utilization:     ${result.newCpuUtil}%`);
      if (result.payload) {
        console.log('\n   PUT Request that would be sent:');
        console.log(`   ${'='.repeat(30)}`);
        console.log(`   PUT /servers/${result.serverId}`);
        console.log('   Payload:');
        console.log(JSON.stringify(result.payload, null, 2).split('\n').map(line => `     ${line}`).join('\n'));
      }
      console.log('');
    });
  }
  
  console.log('💡 To perform the actual updates, run without --dry-run flag');
  console.log('   Example: npm run demo:cpu-util-default');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  cpuUtilDefaultValueDemo().catch(console.error);
}

export { cpuUtilDefaultValueDemo }; 