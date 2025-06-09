import { ServerBulkOperations, Server, ServerFilter, ServerUpdates, ServerBackup } from '../../src/operations/servers';
import { TidalApiClient } from '../../src/api/client';
import { ValidationResult } from '../../src/types/bulk';
import * as fs from 'fs';
import * as path from 'path';

// Mock the dependencies
jest.mock('../../src/api/client');
jest.mock('../../src/utils/logger');
jest.mock('fs');

describe('ServerBulkOperations', () => {
  let serverOps: ServerBulkOperations;
  let mockClient: jest.Mocked<TidalApiClient>;

  const mockServers: Server[] = [
    {
      id: 1,
      host_name: 'web-server-01',
      description: 'Primary web server',
      environment_id: 1,
      zone: 'us-east-1',
      operating_system: 'Ubuntu 20.04',
      cpu_count: 4,
      ram_allocated_gb: 16,
      storage_allocated_gb: 100,
      virtual: true,
      role: 'web'
    },
    {
      id: 2,
      host_name: 'db-server-01',
      description: 'Primary database server',
      environment_id: 1,
      zone: 'us-east-1',
      operating_system: 'CentOS 8',
      cpu_count: 8,
      ram_allocated_gb: 32,
      storage_allocated_gb: 500,
      virtual: false,
      role: 'database'
    }
  ];

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      put: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      getWorkspace: jest.fn().mockReturnValue('test-workspace'),
      authenticate: jest.fn(),
      getBaseUrl: jest.fn(),
      isAuthenticated: jest.fn()
    } as any;

    serverOps = new ServerBulkOperations(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getResourceType', () => {
    it('should return "servers"', () => {
      expect(serverOps.getResourceType()).toBe('servers');
    });
  });

  describe('getServers', () => {
    it('should fetch all servers without filter', async () => {
      mockClient.get.mockResolvedValue({
        data: mockServers,
        status: 200,
        statusText: 'OK'
      });

      const result = await serverOps.getServers();

      expect(mockClient.get).toHaveBeenCalledWith('/servers');
      expect(result).toEqual(mockServers);
    });

    it('should fetch servers with filter', async () => {
      const filter: ServerFilter = {
        environment_id: 1,
        zone: 'us-east-1',
        limit: 10
      };

      mockClient.get.mockResolvedValue({
        data: mockServers,
        status: 200,
        statusText: 'OK'
      });

      const result = await serverOps.getServers(filter);

      expect(mockClient.get).toHaveBeenCalledWith('/servers?environment_id=1&zone=us-east-1&limit=10');
      expect(result).toEqual(mockServers);
    });

    it('should handle empty results', async () => {
      mockClient.get.mockResolvedValue({
        data: [],
        status: 200,
        statusText: 'OK'
      });

      const result = await serverOps.getServers();

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockClient.get.mockRejectedValue(error);

      await expect(serverOps.getServers()).rejects.toThrow('API Error');
    });
  });

  describe('getServerDetails', () => {
    it('should fetch detailed server information', async () => {
      const serverId = 1;
      const serverDetails = mockServers[0];

      mockClient.get.mockResolvedValue({
        data: serverDetails,
        status: 200,
        statusText: 'OK'
      });

      const result = await serverOps.getServerDetails(serverId);

      expect(mockClient.get).toHaveBeenCalledWith('/servers/1');
      expect(result).toEqual(serverDetails);
    });

    it('should handle server not found', async () => {
      const error = new Error('Server not found');
      mockClient.get.mockRejectedValue(error);

      await expect(serverOps.getServerDetails(999)).rejects.toThrow('Server not found');
    });
  });

  describe('updateServer', () => {
    it('should update a server successfully', async () => {
      const serverId = 1;
      const updates: ServerUpdates = {
        description: 'Updated description',
        cpu_count: 8
      };
      const updatedServer = { ...mockServers[0], ...updates };

      mockClient.put.mockResolvedValue({
        data: updatedServer,
        status: 200,
        statusText: 'OK'
      });

      const result = await serverOps.updateServer(serverId, updates);

      expect(mockClient.put).toHaveBeenCalledWith('/servers/1', updates);
      expect(result).toEqual(updatedServer);
    });

    it('should validate updates before sending', async () => {
      const serverId = 1;
      const invalidUpdates = {}; // Empty updates should be invalid

      await expect(serverOps.updateServer(serverId, invalidUpdates)).rejects.toThrow('Invalid server updates provided');
    });
  });

  describe('createServerBackup', () => {
    beforeEach(() => {
      // Mock fs methods
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation();
      (fs.writeFileSync as jest.Mock).mockImplementation();
    });

    it('should create a full backup of all servers', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: mockServers,
        status: 200,
        statusText: 'OK'
      });

      // Mock detailed server calls
      mockClient.get.mockResolvedValueOnce({
        data: mockServers[0],
        status: 200,
        statusText: 'OK'
      });
      mockClient.get.mockResolvedValueOnce({
        data: mockServers[1],
        status: 200,
        statusText: 'OK'
      });

      const backupPath = '/test/backup.json';
      const result = await serverOps.createServerBackup(undefined, backupPath);

      expect(result.total_servers).toBe(2);
      expect(result.workspace).toBe('test-workspace');
      expect(result.metadata.backup_type).toBe('full');
      expect(result.servers).toEqual(mockServers);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        backupPath,
        expect.stringContaining('"total_servers": 2'),
        'utf8'
      );
    });

    it('should create a filtered backup', async () => {
      const filter: ServerFilter = { environment_id: 1 };
      const filteredServers = [mockServers[0]];

      mockClient.get.mockResolvedValueOnce({
        data: filteredServers,
        status: 200,
        statusText: 'OK'
      });

      mockClient.get.mockResolvedValueOnce({
        data: filteredServers[0],
        status: 200,
        statusText: 'OK'
      });

      const result = await serverOps.createServerBackup(filter);

      expect(result.total_servers).toBe(1);
      expect(result.metadata.backup_type).toBe('filtered');
      expect(result.metadata.filter_applied).toEqual(filter);
    });

    it('should handle empty server list', async () => {
      mockClient.get.mockResolvedValue({
        data: [],
        status: 200,
        statusText: 'OK'
      });

      const result = await serverOps.createServerBackup();

      expect(result.total_servers).toBe(0);
      expect(result.servers).toEqual([]);
    });

    it('should handle errors during detailed server fetch', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: mockServers,
        status: 200,
        statusText: 'OK'
      });

      // First server succeeds, second fails
      mockClient.get.mockResolvedValueOnce({
        data: mockServers[0],
        status: 200,
        statusText: 'OK'
      });
      mockClient.get.mockRejectedValueOnce(new Error('Server details fetch failed'));

      const result = await serverOps.createServerBackup();

      expect(result.total_servers).toBe(2);
      expect(result.servers).toHaveLength(2);
      // Should include basic info for failed server
      expect(result.servers[1]).toEqual(mockServers[1]);
    });
  });

  describe('loadBackupFromFile', () => {
    it('should load backup from file successfully', async () => {
      const mockBackup: ServerBackup = {
        timestamp: '2024-01-01T00:00:00.000Z',
        workspace: 'test-workspace',
        total_servers: 1,
        servers: [mockServers[0]],
        metadata: {
          backup_version: '1.0.0',
          created_by: 'Test',
          backup_type: 'full'
        }
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockBackup));

      const result = await serverOps.loadBackupFromFile('/test/backup.json');

      expect(result).toEqual(mockBackup);
      expect(fs.readFileSync).toHaveBeenCalledWith('/test/backup.json', 'utf8');
    });

    it('should throw error if file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(serverOps.loadBackupFromFile('/nonexistent.json'))
        .rejects.toThrow('Backup file not found: /nonexistent.json');
    });

    it('should handle invalid JSON', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

      await expect(serverOps.loadBackupFromFile('/test/backup.json'))
        .rejects.toThrow();
    });
  });

  describe('validateFilter', () => {
    it('should validate correct filter', () => {
      const filter: ServerFilter = {
        environment_id: 1,
        zone: 'us-east-1',
        operating_system: 'Ubuntu',
        limit: 10
      };

      const result = serverOps.validateFilter(filter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid filter keys', () => {
      const filter = {
        invalid_key: 'value',
        environment_id: 1
      };

      const result = serverOps.validateFilter(filter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid filter keys: invalid_key');
    });

    it('should reject non-object filter', () => {
      const result = serverOps.validateFilter('invalid');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Filter must be an object');
    });
  });

  describe('validateUpdates', () => {
    it('should validate correct updates', () => {
      const updates: ServerUpdates = {
        description: 'New description',
        cpu_count: 8,
        ram_allocated_gb: 32
      };

      const result = serverOps.validateUpdates(updates);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty updates', () => {
      const result = serverOps.validateUpdates({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one update field must be provided');
    });

    it('should reject invalid update keys', () => {
      const updates = {
        invalid_field: 'value',
        description: 'Valid description'
      };

      const result = serverOps.validateUpdates(updates);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid update keys: invalid_field');
    });

    it('should reject non-object updates', () => {
      const result = serverOps.validateUpdates('invalid');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Updates must be an object');
    });
  });

  describe('bulk operations', () => {
    it('should perform bulk environment change', async () => {
      const filter: ServerFilter = { zone: 'us-east-1' };
      const newEnvironmentId = 2;

      // Mock the bulkUpdateServers method instead of bulkUpdate
      const mockBulkUpdateServers = jest.spyOn(serverOps, 'bulkUpdateServers').mockResolvedValue({
        operationId: 'test-op',
        total: 2,
        successful: 2,
        failed: 0,
        errors: [],
        duration: 1000
      });

      const result = await serverOps.bulkChangeEnvironment(filter, newEnvironmentId);

      expect(mockBulkUpdateServers).toHaveBeenCalledWith(filter, { environment_id: newEnvironmentId });
      expect(result.successful).toBe(2);
    });

    it('should perform bulk role update', async () => {
      const filter: ServerFilter = { environment_id: 1 };
      const newRole = 'application';

      const mockBulkUpdateServers = jest.spyOn(serverOps, 'bulkUpdateServers').mockResolvedValue({
        operationId: 'test-op',
        total: 1,
        successful: 1,
        failed: 0,
        errors: [],
        duration: 500
      });

      const result = await serverOps.bulkUpdateRole(filter, newRole);

      expect(mockBulkUpdateServers).toHaveBeenCalledWith(filter, { role: newRole });
      expect(result.successful).toBe(1);
    });

    it('should perform bulk zone update', async () => {
      const filter: ServerFilter = { operating_system: 'Ubuntu' };
      const newZone = 'us-west-2';

      const mockBulkUpdateServers = jest.spyOn(serverOps, 'bulkUpdateServers').mockResolvedValue({
        operationId: 'test-op',
        total: 1,
        successful: 1,
        failed: 0,
        errors: [],
        duration: 750
      });

      const result = await serverOps.bulkUpdateZone(filter, newZone);

      expect(mockBulkUpdateServers).toHaveBeenCalledWith(filter, { zone: newZone });
      expect(result.successful).toBe(1);
    });
  });

  describe('validation helpers', () => {
    describe('validateEnvironmentId', () => {
      it('should validate positive numbers', () => {
        expect(serverOps.validateEnvironmentId(1)).toBe(true);
        expect(serverOps.validateEnvironmentId(100)).toBe(true);
      });

      it('should reject invalid environment IDs', () => {
        expect(serverOps.validateEnvironmentId(0)).toBe(false);
        expect(serverOps.validateEnvironmentId(-1)).toBe(false);
        expect(serverOps.validateEnvironmentId(NaN)).toBe(false);
      });
    });

    describe('validateRole', () => {
      it('should validate common roles', () => {
        expect(serverOps.validateRole('web')).toBe(true);
        expect(serverOps.validateRole('database')).toBe(true);
        expect(serverOps.validateRole('application')).toBe(true);
        expect(serverOps.validateRole('custom-role')).toBe(true);
      });

      it('should reject invalid roles', () => {
        expect(serverOps.validateRole('')).toBe(false);
        expect(serverOps.validateRole('   ')).toBe(false);
        expect(serverOps.validateRole('a'.repeat(51))).toBe(false);
      });
    });

    describe('validateResourceLimits', () => {
      it('should validate positive resource limits', () => {
        expect(serverOps.validateResourceLimits(4, 16, 100)).toBe(true);
        expect(serverOps.validateResourceLimits(undefined, 32, undefined)).toBe(true);
      });

      it('should reject invalid resource limits', () => {
        expect(serverOps.validateResourceLimits(-1, 16, 100)).toBe(false);
        expect(serverOps.validateResourceLimits(4, 0, 100)).toBe(false);
        expect(serverOps.validateResourceLimits(4, 16, -50)).toBe(false);
      });
    });
  });
}); 