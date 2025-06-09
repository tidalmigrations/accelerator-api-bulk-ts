import { TidalApiClient } from '../src/api/client';
import { ServerBulkOperations } from '../src/operations/servers';
import { logger } from '../src/utils/logger';
import { loadConfig, getAuthCredentials } from '../src/config/environment';

/**
 * Hostname to FQDN Overwrite Demo
 * 
 * This example demonstrates:
 * 1. Fetching all servers from the API
 * 2. Overwriting fqdn field with host_name values for all servers with host_name
 * 3. Generating a report of successful overwrites
 */
async function hostnameToFqdnDemo() {
  try {
    logger.info('=== Hostname to FQDN Overwrite Demo ===');
    
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

    // 2. Fetch all servers from the API
    logger.info('\n--- Fetching Servers from API ---');
    logger.info('Retrieving all servers for hostname to fqdn overwrite...');
    
    const servers = await serverOps.getServers();
    logger.info(`Retrieved ${servers.length} servers from the API`);

    // 3. Find servers for fqdn overwrite
    logger.info('\n--- Identifying Servers for FQDN Overwrite ---');
    
    const serversForFqdnOverwrite = servers.filter(server => 
      server.host_name && 
      server.host_name.trim() !== ''
    );
    
    logger.info(`Found ${serversForFqdnOverwrite.length} servers with host_name values`);
    logger.info(`These will have their fqdn field overwritten with host_name value`);
    
    if (serversForFqdnOverwrite.length > 0) {
      logger.info(`Overwriting fqdn values for ${serversForFqdnOverwrite.length} servers`);
      
      const assignmentResults = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
        successfulAssignments: [] as Array<{ id: string | number, hostname: string, environment: string | number }>
      };

      for (const server of serversForFqdnOverwrite) {
        try {
          logger.info(`Overwriting fqdn for ${server.id}: "${server.host_name}"`);
          
          // Perform the actual API call to update the server
          await serverOps.updateServer(server.id, { fqdn: server.host_name });
          
          logger.info(`✅ ${server.id}: fqdn overwritten with "${server.host_name}"`);
          assignmentResults.successful++;
          assignmentResults.successfulAssignments.push({
            id: server.id,
            hostname: server.host_name,
            environment: server.environment_id || 'Unknown'
          });
          
        } catch (error) {
          const errorMessage = `Failed to update ${server.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMessage);
          assignmentResults.failed++;
          assignmentResults.errors.push(errorMessage);
        }
      }

      logger.info('\n--- Overwrite Results ---');
      logger.info(`Total servers processed: ${serversForFqdnOverwrite.length}`);
      logger.info(`Successful overwrites: ${assignmentResults.successful}`);
      logger.info(`Failed overwrites: ${assignmentResults.failed}`);
      
      // Report of successful overwrites
      if (assignmentResults.successfulAssignments.length > 0) {
        logger.info('\n--- Successfully Overwritten FQDN Values ---');
        logger.info('┌─────────────┬─────────────────────────────────┬─────────────────┐');
        logger.info('│ Server ID   │ Hostname → FQDN                 │ Environment     │');
        logger.info('├─────────────┼─────────────────────────────────┼─────────────────┤');
        
        assignmentResults.successfulAssignments.forEach(assignment => {
          const serverId = assignment.id.toString().padEnd(11);
          const hostnameAssignment = assignment.hostname.padEnd(31);
          const environment = assignment.environment.toString().padEnd(15);
          logger.info(`│ ${serverId} │ ${hostnameAssignment} │ ${environment} │`);
        });
        
        logger.info('└─────────────┴─────────────────────────────────┴─────────────────┘');
      }
      
      if (assignmentResults.errors.length > 0) {
        logger.info('\nErrors encountered:');
        assignmentResults.errors.forEach((error, index) => {
          logger.error(`${index + 1}. ${error}`);
        });
      }
    } else {
      logger.info('No servers found with host_name values to overwrite');
    }

    // 4. Summary
    logger.info('\n--- Summary ---');
    logger.info(`Total servers: ${servers.length}`);
    logger.info(`Servers processed for overwrite: ${serversForFqdnOverwrite.length}`);
    logger.info(`Servers without host_name: ${servers.length - serversForFqdnOverwrite.length}`);

    logger.info('\n=== Hostname to FQDN Overwrite Completed Successfully ===');

  } catch (error) {
    logger.error('Demo failed:', error);
    throw error;
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  hostnameToFqdnDemo()
    .then(() => {
      logger.info('Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Demo failed:', error);
      process.exit(1);
    });
}

export { hostnameToFqdnDemo }; 