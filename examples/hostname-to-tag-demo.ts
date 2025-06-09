import { TidalApiClient } from '../src/api/client';
import { ServerBulkOperations } from '../src/operations/servers';
import { logger } from '../src/utils/logger';
import { loadConfig, getAuthCredentials } from '../src/config/environment';



/**
 * Hostname to Tag Assignment Demo
 * 
 * This example demonstrates:
 * 1. Fetching all servers from the API
 * 2. Creating tags based on hostname values for servers with hostnames
 * 3. Applying the created tags to their respective servers
 * 4. Generating a report of successful tag assignments
 */
async function hostnameToTagDemo() {
  try {
    logger.info('=== Hostname to Tag Assignment Demo ===');
    
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
    logger.info('Retrieving all servers for hostname to tag assignment...');
    
    const servers = await serverOps.getServers();
    logger.info(`Retrieved ${servers.length} servers from the API`);

    // 3. Find servers for tag assignment
    logger.info('\n--- Identifying Servers for Tag Assignment ---');
    
    const serversForTagAssignment = servers.filter(server => 
      server.host_name && 
      server.host_name.trim() !== ''
    );
    
    logger.info(`Found ${serversForTagAssignment.length} servers with hostname values`);
    logger.info(`These will have tags created and applied based on their hostname`);
    
    if (serversForTagAssignment.length > 0) {
      logger.info(`Processing tag creation and assignment for ${serversForTagAssignment.length} servers`);
      
      const assignmentResults = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
        successfulAssignments: [] as Array<{ 
          serverId: string | number, 
          hostname: string, 
          tagId: number,
          environment: string | number 
        }>
      };

      // Track created/found tags to avoid duplicates
      const tagMap = new Map<string, number>();

      for (const server of serversForTagAssignment) {
        try {
          const hostname = server.host_name!;
          logger.info(`Processing server ${server.id} with hostname: "${hostname}"`);
          
          let tagId: number;
          
          // Check if tag already exists in our cache
          if (tagMap.has(hostname)) {
            tagId = tagMap.get(hostname)!;
            logger.info(`Using cached tag "${hostname}" with ID: ${tagId}`);
          } else {
            // Search for existing tag first
            logger.info(`Searching for existing tag: "${hostname}"`);
            const searchResponse = await client.get(`/tags?search=${encodeURIComponent(hostname)}`);
            const existingTags = searchResponse.data as Array<{ id: number, name: string }>;
            
            const existingTag = existingTags.find(tag => tag.name === hostname);
            
            if (existingTag) {
              tagId = existingTag.id;
              tagMap.set(hostname, tagId);
              logger.info(`Found existing tag "${hostname}" with ID: ${tagId}`);
            } else {
              // Create new tag
              logger.info(`Creating new tag: "${hostname}"`);
              const createTagResponse = await client.post('/tags', { tag: { name: hostname } });
              const createdTag = createTagResponse.data as { id: number, name: string };
              
              if (createdTag && createdTag.id) {
                tagId = createdTag.id;
                tagMap.set(hostname, tagId);
                logger.info(`Created new tag "${hostname}" with ID: ${tagId}`);
              } else {
                throw new Error('Failed to create tag - no tag returned');
              }
            }
          }
          
          // Get current server to preserve existing tags
          logger.info(`Getting current server ${server.id} to preserve existing tags`);
          const serverResponse = await client.get(`/servers/${server.id}`);
          const currentServer = serverResponse.data as { tag_ids?: number[] };
          
          // Add new tag to existing tags
          const existingTagIds = currentServer.tag_ids || [];
          const updatedTagIds = [...new Set([...existingTagIds, tagId])]; // Remove duplicates
          
          // Apply tag to server
          logger.info(`Applying tag ${tagId} to server ${server.id} (total tags: ${updatedTagIds.length})`);
          await client.put(`/servers/${server.id}`, {
            server: {
              tag_ids: updatedTagIds,
              id: server.id
            }
          });
          
          logger.info(`✅ ${server.id}: tag "${hostname}" (ID: ${tagId}) applied successfully`);
          assignmentResults.successful++;
          assignmentResults.successfulAssignments.push({
            serverId: server.id,
            hostname: hostname,
            tagId: tagId,
            environment: server.environment_id || 'Unknown'
          });
          
        } catch (error) {
          const errorMessage = `Failed to process ${server.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMessage);
          assignmentResults.failed++;
          assignmentResults.errors.push(errorMessage);
        }
      }

      logger.info('\n--- Assignment Results ---');
      logger.info(`Total servers processed: ${serversForTagAssignment.length}`);
      logger.info(`Successful tag assignments: ${assignmentResults.successful}`);
      logger.info(`Failed tag assignments: ${assignmentResults.failed}`);
      
      // Report of successful assignments
      if (assignmentResults.successfulAssignments.length > 0) {
        logger.info('\n--- Successfully Applied Tags ---');
        logger.info('┌─────────────┬─────────────────────────────────┬─────────────┬─────────────────┐');
        logger.info('│ Server ID   │ Hostname → Tag                  │ Tag ID      │ Environment     │');
        logger.info('├─────────────┼─────────────────────────────────┼─────────────┼─────────────────┤');
        
        assignmentResults.successfulAssignments.forEach(assignment => {
          const serverId = assignment.serverId.toString().padEnd(11);
          const hostnameTag = assignment.hostname.padEnd(31);
          const tagId = assignment.tagId.toString().padEnd(11);
          const environment = assignment.environment.toString().padEnd(15);
          logger.info(`│ ${serverId} │ ${hostnameTag} │ ${tagId} │ ${environment} │`);
        });
        
        logger.info('└─────────────┴─────────────────────────────────┴─────────────┴─────────────────┘');
      }
      
      if (assignmentResults.errors.length > 0) {
        logger.info('\nErrors encountered:');
        assignmentResults.errors.forEach((error, index) => {
          logger.error(`${index + 1}. ${error}`);
        });
      }
    } else {
      logger.info('No servers found with hostname values to create tags for');
    }

    // 4. Summary
    logger.info('\n--- Summary ---');
    logger.info(`Total servers: ${servers.length}`);
    logger.info(`Servers processed for tag assignment: ${serversForTagAssignment.length}`);
    logger.info(`Servers without hostname: ${servers.length - serversForTagAssignment.length}`);

    logger.info('\n=== Hostname to Tag Assignment Completed Successfully ===');

  } catch (error) {
    logger.error('Demo failed:', error);
    throw error;
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  hostnameToTagDemo()
    .then(() => {
      logger.info('Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Demo failed:', error);
      process.exit(1);
    });
}

export { hostnameToTagDemo }; 