import { BaseBulkOperation } from './base';
import { BulkOperationConfig, BulkResult, ValidationResult } from '../types/bulk';
import { TidalApiClient } from '../api/client';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface Server {
  id: number;
  host_name: string;
  created_at?: string;
  updated_at?: string;
  description?: string;
  custom_fields?: any;
  fqdn?: string;
  environment_id?: number;
  assigned_id?: string;
  zone?: string;
  ram_allocated_gb?: number;
  storage_allocated_gb?: number;
  storage_used_gb?: number;
  cluster_id?: number;
  role?: string;
  cpu_count?: number;
  ram_used_gb?: number;
  virtual?: boolean;
  cpu_name?: string;
  operating_system?: string;
  operating_system_version?: string;
  dba_architecture?: string;
  dba_iops?: number;
  dba_max_active_sessions?: number;
  dba_max_sessions?: number;
  dba_mbps?: number;
  dba_sga_size_gb?: number;
  operating_system_id?: number;
  migrated?: boolean;
  cpu_utilization_statistics?: any;
  cloud_instance_target_id?: number;
  is_hyperthreaded?: boolean;
  cloud_region?: string;
  task_integration_enabled?: boolean;
  recommendation_project?: any;
  notes?: any[];
  ip_addresses?: IpAddress[];
  database_instances?: any[];
  tags?: any[];
  servers?: any[];
  softwares?: any[];
  apps?: any[];
  move_groups?: any[];
  task_cards?: any[];
  dependent_apps?: any[];
  user_tags?: any[];
}

export interface IpAddress {
  id: number;
  address_inet: string;
  server_id?: number;
  created_at?: string;
  updated_at?: string;
  address_hex?: string;
  address: string;
  org_id?: number;
  cloud_id?: number;
  ptr_record?: string;
  ports?: any[];
}

export interface ServerFilter {
  name?: string;
  search?: string;
  environment_id?: number;
  zone?: string;
  operating_system?: string;
  operating_system_id?: number;
  virtual?: boolean;
  role?: string;
  cloud_region?: string;
  is_hyperthreaded?: boolean;
  task_integration_enabled?: boolean;
  page?: number;
  limit?: number;
}

export interface ServerUpdates {
  host_name?: string;
  description?: string;
  custom_fields?: any;
  fqdn?: string;
  environment_id?: number;
  assigned_id?: string;
  zone?: string;
  ram_allocated_gb?: number;
  storage_allocated_gb?: number;
  storage_used_gb?: number;
  cluster_id?: number;
  role?: string;
  cpu_count?: number;
  ram_used_gb?: number;
  virtual?: boolean;
  cpu_name?: string;
  operating_system?: string;
  operating_system_version?: string;
  operating_system_id?: number;
  cloud_instance_target_id?: number;
  is_hyperthreaded?: boolean;
  cloud_region?: string;
  task_integration_enabled?: boolean;
  move_group_ids?: number[];
}

export interface ServerBackup {
  timestamp: string;
  workspace: string;
  total_servers: number;
  servers: Server[];
  metadata: {
    backup_version: string;
    created_by: string;
    backup_type: 'full' | 'filtered';
    filter_applied?: ServerFilter;
  };
}

export class ServerBulkOperations extends BaseBulkOperation<Server> {
  constructor(client: TidalApiClient) {
    super(client);
  }

  /**
   * Get the resource type name
   */
  getResourceType(): string {
    return 'servers';
  }

  /**
   * Get resources based on filter criteria (required by base class)
   */
  async getResources(filter: any): Promise<Server[]> {
    return this.getServers(filter as ServerFilter);
  }

  /**
   * Update a single resource (required by base class)
   */
  async updateResource(id: string, updates: Partial<Server>): Promise<Server> {
    return this.updateServer(parseInt(id), updates as ServerUpdates);
  }

  /**
   * Validate filter criteria (required by base class)
   */
  validateFilter(filter: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!filter || typeof filter !== 'object') {
      errors.push('Filter must be an object');
      return { isValid: false, errors, warnings };
    }

    const validKeys = ['name', 'search', 'environment_id', 'zone', 'operating_system', 'virtual', 'role', 'page', 'limit'];
    const filterKeys = Object.keys(filter);
    
    const invalidKeys = filterKeys.filter(key => !validKeys.includes(key));
    if (invalidKeys.length > 0) {
      errors.push(`Invalid filter keys: ${invalidKeys.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate update data (required by base class)
   */
  validateUpdates(updates: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!updates || typeof updates !== 'object') {
      errors.push('Updates must be an object');
      return { isValid: false, errors, warnings };
    }

    const validKeys = [
      'host_name', 'description', 'fqdn', 'environment_id', 'assigned_id', 
      'zone', 'storage_used_gb', 'cluster_id', 'ram_allocated_gb', 
      'storage_allocated_gb', 'role', 'cpu_count', 'ram_used_gb', 
      'move_group_ids', 'virtual', 'cpu_name', 'operating_system', 
      'operating_system_version', 'custom_fields'
    ];
    
    const updateKeys = Object.keys(updates);
    
    if (updateKeys.length === 0) {
      errors.push('At least one update field must be provided');
    }

    const invalidKeys = updateKeys.filter(key => !validKeys.includes(key));
    if (invalidKeys.length > 0) {
      errors.push(`Invalid update keys: ${invalidKeys.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Get all servers with optional filtering
   */
  async getServers(filter?: ServerFilter): Promise<Server[]> {
    try {
      logger.info('Fetching servers', { filter });
      
      const params = new URLSearchParams();
      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, value.toString());
          }
        });
      }

      const queryString = params.toString();
      const endpoint = queryString ? `/servers?${queryString}` : '/servers';
      
      const response = await this.client.get(endpoint);
      logger.info(`Retrieved ${response.data.length} servers`);
      
      return response.data as Server[];
    } catch (error) {
      logger.error('Failed to fetch servers', { error, filter });
      throw error;
    }
  }

  /**
   * Get detailed information for a specific server
   */
  async getServerDetails(id: number): Promise<Server> {
    try {
      logger.debug(`Fetching details for server ${id}`);
      const response = await this.client.get(`/servers/${id}`);
      return response.data as Server;
    } catch (error) {
      logger.error(`Failed to fetch server details for ID ${id}`, { error });
      throw error;
    }
  }

  /**
   * Update a single server
   */
  async updateServer(id: number, updates: ServerUpdates): Promise<Server> {
    try {
      logger.info(`Updating server ${id}`, { updates });
      
      if (!this.validateServerUpdates(updates)) {
        throw new Error('Invalid server updates provided');
      }

      const response = await this.client.put(`/servers/${id}`, updates);
      logger.info(`Successfully updated server ${id}`);
      
      return response.data as Server;
    } catch (error) {
      logger.error(`Failed to update server ${id}`, { error, updates });
      throw error;
    }
  }

  /**
   * Bulk update servers based on filter
   */
  async bulkUpdateServers(
    filter: ServerFilter, 
    updates: ServerUpdates, 
    config?: Partial<BulkOperationConfig>
  ): Promise<BulkResult> {
    try {
      logger.info('Starting bulk server update', { filter, updates, config });

      if (!this.validateServerFilter(filter)) {
        throw new Error('Invalid server filter provided');
      }

      if (!this.validateServerUpdates(updates)) {
        throw new Error('Invalid server updates provided');
      }

      // Get servers matching the filter
      const servers = await this.getServers(filter);
      
      if (servers.length === 0) {
        logger.warn('No servers found matching filter', { filter });
        return {
          operationId: 'no-servers-found',
          successful: 0,
          failed: 0,
          total: 0,
          errors: [],
          duration: 0
        };
      }

      // Perform bulk update using the base class method
      const results = await this.bulkUpdate(filter, updates, config);

      logger.info('Bulk server update completed', { 
        successful: results.successful,
        failed: results.failed,
        total: results.total
      });

      return results;
    } catch (error) {
      logger.error('Bulk server update failed', { error, filter, updates });
      throw error;
    }
  }

  /**
   * Create a comprehensive backup of all servers including detailed information
   * This demonstrates bulk operations by fetching all servers and their details
   */
  async createServerBackup(
    filter?: ServerFilter,
    outputPath?: string
  ): Promise<ServerBackup> {
    try {
      logger.info('Starting server backup operation', { filter, outputPath });
      
      // Get all servers (or filtered servers)
      const servers = await this.getServers(filter);
      logger.info(`Found ${servers.length} servers to backup`);

      if (servers.length === 0) {
        logger.warn('No servers found for backup', { filter });
      }

      // Fetch detailed information for each server in parallel (bulk operation)
      logger.info('Fetching detailed information for all servers...');
      const detailedServers: Server[] = [];
      const errors: string[] = [];

      // Process servers in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < servers.length; i += batchSize) {
        const batch = servers.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (server) => {
          try {
            const details = await this.getServerDetails(server.id);
            return details;
          } catch (error) {
            const errorMsg = `Failed to fetch details for server ${server.id}: ${error}`;
            logger.error(errorMsg);
            errors.push(errorMsg);
            return server; // Return basic info if detailed fetch fails
          }
        });

        const batchResults = await Promise.all(batchPromises);
        detailedServers.push(...batchResults);
        
        logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(servers.length / batchSize)}`);
      }

      // Create backup object
      const backup: ServerBackup = {
        timestamp: new Date().toISOString(),
        workspace: this.client.getWorkspace(),
        total_servers: detailedServers.length,
        servers: detailedServers,
        metadata: {
          backup_version: '1.0.0',
          created_by: 'Tidal Bulk Operations Client',
          backup_type: filter ? 'filtered' : 'full',
          filter_applied: filter
        }
      };

      // Save backup to file if path provided
      if (outputPath) {
        await this.saveBackupToFile(backup, outputPath);
      }

      logger.info('Server backup completed successfully', {
        total_servers: backup.total_servers,
        errors_count: errors.length,
        output_path: outputPath
      });

      if (errors.length > 0) {
        logger.warn('Some servers had errors during backup', { errors });
      }

      return backup;
    } catch (error) {
      logger.error('Server backup operation failed', { error, filter, outputPath });
      throw error;
    }
  }

  /**
   * Save backup to file
   */
  private async saveBackupToFile(backup: ServerBackup, outputPath: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write backup to file
      const backupJson = JSON.stringify(backup, null, 2);
      fs.writeFileSync(outputPath, backupJson, 'utf8');
      
      logger.info(`Backup saved to ${outputPath}`, { 
        file_size: `${(backupJson.length / 1024).toFixed(2)} KB`,
        servers_count: backup.total_servers
      });
    } catch (error) {
      logger.error('Failed to save backup to file', { error, outputPath });
      throw error;
    }
  }

  /**
   * Load backup from file
   */
  async loadBackupFromFile(filePath: string): Promise<ServerBackup> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Backup file not found: ${filePath}`);
      }

      const backupJson = fs.readFileSync(filePath, 'utf8');
      const backup = JSON.parse(backupJson) as ServerBackup;
      
      logger.info(`Loaded backup from ${filePath}`, {
        timestamp: backup.timestamp,
        servers_count: backup.total_servers,
        workspace: backup.workspace
      });

      return backup;
    } catch (error) {
      logger.error('Failed to load backup from file', { error, filePath });
      throw error;
    }
  }

  /**
   * Bulk change environment for servers
   */
  async bulkChangeEnvironment(filter: ServerFilter, newEnvironmentId: number): Promise<BulkResult> {
    return this.bulkUpdateServers(filter, { environment_id: newEnvironmentId });
  }

  /**
   * Bulk update server role
   */
  async bulkUpdateRole(filter: ServerFilter, newRole: string): Promise<BulkResult> {
    return this.bulkUpdateServers(filter, { role: newRole });
  }

  /**
   * Bulk update server zone
   */
  async bulkUpdateZone(filter: ServerFilter, newZone: string): Promise<BulkResult> {
    return this.bulkUpdateServers(filter, { zone: newZone });
  }

  /**
   * Validate server filter
   */
  validateServerFilter(filter: ServerFilter): boolean {
    if (!filter || typeof filter !== 'object') {
      return false;
    }

    // Check for valid filter properties
    const validKeys = [
      'name', 'search', 'environment_id', 'zone', 'operating_system', 
      'operating_system_id', 'virtual', 'role', 'cloud_region', 
      'is_hyperthreaded', 'task_integration_enabled', 'page', 'limit'
    ];
    const filterKeys = Object.keys(filter);
    
    return filterKeys.every(key => validKeys.includes(key));
  }

  /**
   * Validate server updates
   */
  validateServerUpdates(updates: ServerUpdates): boolean {
    if (!updates || typeof updates !== 'object') {
      return false;
    }

    // Check for at least one valid update field
    const validKeys = [
      'host_name', 'description', 'custom_fields', 'fqdn', 'environment_id', 
      'assigned_id', 'zone', 'ram_allocated_gb', 'storage_allocated_gb', 
      'storage_used_gb', 'cluster_id', 'role', 'cpu_count', 'ram_used_gb', 
      'virtual', 'cpu_name', 'operating_system', 'operating_system_version', 
      'operating_system_id', 'cloud_instance_target_id', 'is_hyperthreaded', 
      'cloud_region', 'task_integration_enabled', 'move_group_ids'
    ];
    
    const updateKeys = Object.keys(updates);
    
    if (updateKeys.length === 0) {
      return false;
    }

    return updateKeys.every(key => validKeys.includes(key));
  }

  /**
   * Validate environment ID
   */
  validateEnvironmentId(environmentId: number): boolean {
    return typeof environmentId === 'number' && environmentId > 0;
  }

  /**
   * Validate server role
   */
  validateRole(role: string): boolean {
    if (typeof role !== 'string' || role.trim().length === 0) {
      return false;
    }
    
    // Common server roles - can be extended based on your organization's needs
    const validRoles = [
      'web', 'database', 'application', 'cache', 'load-balancer',
      'file-server', 'mail-server', 'dns-server', 'proxy', 'backup',
      'monitoring', 'development', 'staging', 'production'
    ];
    
    return validRoles.includes(role.toLowerCase()) || role.length <= 50;
  }

  /**
   * Validate resource limits
   */
  validateResourceLimits(cpu?: number, memory?: number, storage?: number): boolean {
    if (cpu !== undefined && (typeof cpu !== 'number' || cpu <= 0)) {
      return false;
    }
    
    if (memory !== undefined && (typeof memory !== 'number' || memory <= 0)) {
      return false;
    }
    
    if (storage !== undefined && (typeof storage !== 'number' || storage <= 0)) {
      return false;
    }
    
    return true;
  }

  /**
   * Find a server by its hostname
   * Returns the first server that exactly matches the hostname (case-insensitive)
   */
  async findServerByHostname(hostname: string): Promise<Server | null> {
    try {
      logger.debug('Fetching servers', { filter: { search: hostname, limit: 10 } });
      const servers = await this.getServers({ 
        search: hostname,
        limit: 10 
      });

      // Look for exact hostname match
      const matchingServer = servers.find(server => 
        server.host_name?.toLowerCase() === hostname.toLowerCase()
      );

      return matchingServer || null;
    } catch (error) {
      logger.error('Failed to find server by hostname', { error, hostname });
      throw error;
    }
  }
} 