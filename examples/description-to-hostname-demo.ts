import { TidalApiClient } from '../src/api/client';
import { ServerBulkOperations } from '../src/operations/servers';
import { logger } from '../src/utils/logger';
import { loadConfig, getAuthCredentials } from '../src/config/environment';

/**
 * Description to Hostname Assignment Demo
 * 
 * This example demonstrates:
 * 1. Fetching all servers from the API
 * 2. Assigning description field values to hostname for all servers with description
 * 3. Generating a report of successful assignments
 */
async function descriptionToHostnameDemo() {
  try {
    logger.info('=== Description to Hostname Assignment Demo ===');
    
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
    logger.info('Retrieving all servers for description to hostname assignment...');
    
    const servers = await serverOps.getServers();
    logger.info(`Retrieved ${servers.length} servers from the API`);

    // 3. Find servers for hostname assignment
    logger.info('\n--- Identifying Servers for Hostname Assignment ---');
    
    const serversForHostnameAssignment = servers.filter(server => 
      server.description && 
      server.description.trim() !== ''
    );
    
    logger.info(`Found ${serversForHostnameAssignment.length} servers with description values`);
    logger.info(`These will have their hostname field assigned with description value`);
    
    if (serversForHostnameAssignment.length > 0) {
      logger.info(`Assigning hostname values for ${serversForHostnameAssignment.length} servers`);
      
      const assignmentResults = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
        successfulAssignments: [] as Array<{ id: string | number, description: string, environment: string | number }>
      };

      for (const server of serversForHostnameAssignment) {
        try {
          logger.info(`Assigning hostname for ${server.id}: "${server.description}"`);
          
          // Perform the actual API call to update the server
          await serverOps.updateServer(server.id, { host_name: server.description });
          
          logger.info(`✅ ${server.id}: hostname assigned with "${server.description}"`);
          assignmentResults.successful++;
          assignmentResults.successfulAssignments.push({
            id: server.id,
            description: server.description!,
            environment: server.environment_id || 'Unknown'
          });
          
        } catch (error) {
          const errorMessage = `Failed to update ${server.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMessage);
          assignmentResults.failed++;
          assignmentResults.errors.push(errorMessage);
        }
      }

      logger.info('\n--- Assignment Results ---');
      logger.info(`Total servers processed: ${serversForHostnameAssignment.length}`);
      logger.info(`Successful assignments: ${assignmentResults.successful}`);
      logger.info(`Failed assignments: ${assignmentResults.failed}`);
      
      // Report of successful assignments
      if (assignmentResults.successfulAssignments.length > 0) {
        logger.info('\n--- Successfully Assigned Hostname Values ---');
        logger.info('┌─────────────┬─────────────────────────────────┬─────────────────┐');
        logger.info('│ Server ID   │ Description → Hostname          │ Environment     │');
        logger.info('├─────────────┼─────────────────────────────────┼─────────────────┤');
        
        assignmentResults.successfulAssignments.forEach(assignment => {
          const serverId = assignment.id.toString().padEnd(11);
          const descriptionAssignment = assignment.description.padEnd(31);
          const environment = assignment.environment.toString().padEnd(15);
          logger.info(`│ ${serverId} │ ${descriptionAssignment} │ ${environment} │`);
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
      logger.info('No servers found with description values to assign');
    }

    // 4. Summary
    logger.info('\n--- Summary ---');
    logger.info(`Total servers: ${servers.length}`);
    logger.info(`Servers processed for assignment: ${serversForHostnameAssignment.length}`);
    logger.info(`Servers without description: ${servers.length - serversForHostnameAssignment.length}`);

    logger.info('\n=== Description to Hostname Assignment Completed Successfully ===');

  } catch (error) {
    logger.error('Demo failed:', error);
    throw error;
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  descriptionToHostnameDemo()
    .then(() => {
      logger.info('Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Demo failed:', error);
      process.exit(1);
    });
}

export { descriptionToHostnameDemo }; 