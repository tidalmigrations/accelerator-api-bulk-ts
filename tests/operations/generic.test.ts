import { GenericBulkOperations } from '../../src/operations/generic';
import { TidalApiClient } from '../../src/api/client';
import { BulkOperationConfig } from '../../src/types/bulk';

// Mock the TidalApiClient
jest.mock('../../src/api/client');

describe('GenericBulkOperations', () => {
  let mockClient: jest.Mocked<TidalApiClient>;
  let genericOps: GenericBulkOperations;

  beforeEach(() => {
    mockClient = new TidalApiClient({ workspace: 'test' }) as jest.Mocked<TidalApiClient>;
    genericOps = new GenericBulkOperations(mockClient, 'servers');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getResourceType', () => {
    it('should return the resource type', () => {
      expect(genericOps.getResourceType()).toBe('servers');
    });
  });

  describe('getResources', () => {
    it('should fetch resources with no filter', async () => {
      const mockServers = [
        { id: '1', name: 'server1', environment: 'prod' },
        { id: '2', name: 'server2', environment: 'staging' }
      ];

      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });

      const result = await genericOps.getResources();

      expect(mockClient.get).toHaveBeenCalledWith('/servers');
      expect(result).toEqual(mockServers);
    });

    it('should fetch resources with filter', async () => {
      const mockServers = [
        { id: '1', name: 'server1', environment: 'prod' }
      ];

      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });

      const filter = { environment: 'prod', status: 'active' };
      const result = await genericOps.getResources(filter);

      expect(mockClient.get).toHaveBeenCalledWith('/servers?environment=prod&status=active');
      expect(result).toEqual(mockServers);
    });

    it('should handle nested response data', async () => {
      const mockServers = [
        { id: '1', name: 'server1' }
      ];

      mockClient.get.mockResolvedValue({ 
        data: { items: mockServers }, 
        status: 200, 
        statusText: 'OK' 
      });

      const result = await genericOps.getResources();

      expect(result).toEqual(mockServers);
    });

    it('should handle resource-specific nested data', async () => {
      const mockServers = [
        { id: '1', name: 'server1' }
      ];

      mockClient.get.mockResolvedValue({ 
        data: { servers: mockServers }, 
        status: 200, 
        statusText: 'OK' 
      });

      const result = await genericOps.getResources();

      expect(result).toEqual(mockServers);
    });

    it('should wrap non-array response in array', async () => {
      const mockServer = { id: '1', name: 'server1' };

      mockClient.get.mockResolvedValue({ 
        data: mockServer, 
        status: 200, 
        statusText: 'OK' 
      });

      const result = await genericOps.getResources();

      expect(result).toEqual([mockServer]);
    });

    it('should handle array filters', async () => {
      const mockServers = [
        { id: '1', name: 'server1' }
      ];

      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });

      const filter = { tags: ['web', 'api'] };
      const result = await genericOps.getResources(filter);

      expect(mockClient.get).toHaveBeenCalledWith('/servers?tags=web&tags=api');
      expect(result).toEqual(mockServers);
    });

    it('should handle API errors', async () => {
      mockClient.get.mockRejectedValue(new Error('API Error'));

      await expect(genericOps.getResources()).rejects.toThrow('API Error');
    });
  });

  describe('updateResource', () => {
    it('should update a resource', async () => {
      const mockUpdatedServer = { id: '1', name: 'server1', environment: 'production' };
      const updates = { environment: 'production' };

      mockClient.patch.mockResolvedValue({ 
        data: mockUpdatedServer, 
        status: 200, 
        statusText: 'OK' 
      });

      const result = await genericOps.updateResource('1', updates);

      expect(mockClient.patch).toHaveBeenCalledWith('/servers/1', updates);
      expect(result).toEqual({ data: mockUpdatedServer, status: 200, statusText: 'OK' });
    });

    it('should handle update errors', async () => {
      mockClient.patch.mockRejectedValue(new Error('Update failed'));

      await expect(
        genericOps.updateResource('1', { environment: 'production' })
      ).rejects.toThrow('Update failed');
    });
  });

  describe('validateFilter', () => {
    it('should validate valid filter', () => {
      const filter = { environment: 'production', status: 'active' };
      const result = genericOps.validateFilter(filter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid filter', () => {
      const filter = { environment: '' };
      const result = genericOps.validateFilter(filter);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about unknown resource type', () => {
      const unknownOps = new GenericBulkOperations(mockClient, 'unknown-type');
      const filter = { environment: 'production' };
      const result = unknownOps.validateFilter(filter);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Unknown resource type');
    });
  });

  describe('validateUpdates', () => {
    it('should validate valid updates', () => {
      const updates = { environment: 'production', status: 'active' };
      const result = genericOps.validateUpdates(updates);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid updates', () => {
      const updates = { environment: '' };
      const result = genericOps.validateUpdates(updates);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('bulkUpdate', () => {
    it('should perform bulk update successfully', async () => {
      const mockServers = [
        { id: '1', name: 'server1', environment: 'staging' },
        { id: '2', name: 'server2', environment: 'staging' }
      ];

      const mockUpdatedServer = { id: '1', name: 'server1', environment: 'production' };

      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });
      mockClient.patch.mockResolvedValue({ data: mockUpdatedServer, status: 200, statusText: 'OK' });

      const filter = { environment: 'staging' };
      const updates = { environment: 'production' };

      const result = await genericOps.bulkUpdate(filter, updates);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockClient.get).toHaveBeenCalledWith('/servers?environment=staging');
      expect(mockClient.patch).toHaveBeenCalledTimes(2);
    });

    it('should handle no matching resources', async () => {
      mockClient.get.mockResolvedValue({ data: [], status: 200, statusText: 'OK' });

      const filter = { environment: 'nonexistent' };
      const updates = { environment: 'production' };

      const result = await genericOps.bulkUpdate(filter, updates);

      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.operationId).toBe('no-op');
    });

    it('should handle dry run mode', async () => {
      const mockServers = [
        { id: '1', name: 'server1', environment: 'staging' }
      ];

      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });

      const filter = { environment: 'staging' };
      const updates = { environment: 'production' };
      const config: Partial<BulkOperationConfig> = { dryRun: true };

      const result = await genericOps.bulkUpdate(filter, updates, config);

      expect(result.total).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.operationId).toBe('dry-run');
      expect(mockClient.patch).not.toHaveBeenCalled();
    });

    it('should reject invalid filter', async () => {
      const filter = { environment: '' };
      const updates = { environment: 'production' };

      await expect(
        genericOps.bulkUpdate(filter, updates)
      ).rejects.toThrow('Invalid filter');
    });

    it('should reject invalid updates', async () => {
      const filter = { environment: 'staging' };
      const updates = { environment: '' };

      await expect(
        genericOps.bulkUpdate(filter, updates)
      ).rejects.toThrow('Invalid updates');
    });
  });

  describe('bulkUpdateByType', () => {
    it('should temporarily change resource type', async () => {
      const mockApps = [
        { id: '1', name: 'app1', status: 'running' }
      ];

      mockClient.get.mockResolvedValue({ data: mockApps, status: 200, statusText: 'OK' });
      mockClient.patch.mockResolvedValue({ data: mockApps[0], status: 200, statusText: 'OK' });

      const filter = { status: 'running' };
      const updates = { status: 'stopped' };

      const result = await genericOps.bulkUpdateByType('applications', filter, updates);

      expect(mockClient.get).toHaveBeenCalledWith('/applications?status=running');
      expect(result.total).toBe(1);
      
      // Should restore original resource type
      expect(genericOps.getResourceType()).toBe('servers');
    });
  });

  describe('getResourceById', () => {
    it('should fetch resource by ID', async () => {
      const mockServer = { id: '1', name: 'server1' };

      mockClient.get.mockResolvedValue({ data: mockServer, status: 200, statusText: 'OK' });

      const result = await genericOps.getResourceById('1');

      expect(mockClient.get).toHaveBeenCalledWith('/servers/1');
      expect(result).toEqual({ data: mockServer, status: 200, statusText: 'OK' });
    });

    it('should handle fetch errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Not found'));

      await expect(genericOps.getResourceById('1')).rejects.toThrow('Not found');
    });
  });

  describe('resourceExists', () => {
    it('should return true if resource exists', async () => {
      mockClient.get.mockResolvedValue({ data: { id: '1' }, status: 200, statusText: 'OK' });

      const exists = await genericOps.resourceExists('1');

      expect(exists).toBe(true);
    });

    it('should return false if resource does not exist', async () => {
      mockClient.get.mockRejectedValue(new Error('Not found'));

      const exists = await genericOps.resourceExists('1');

      expect(exists).toBe(false);
    });
  });

  describe('countResources', () => {
    it('should count resources with filter', async () => {
      const mockServers = [
        { id: '1', name: 'server1' },
        { id: '2', name: 'server2' }
      ];

      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });

      const count = await genericOps.countResources({ environment: 'production' });

      expect(count).toBe(2);
    });

    it('should count all resources with no filter', async () => {
      const mockServers = [
        { id: '1', name: 'server1' },
        { id: '2', name: 'server2' },
        { id: '3', name: 'server3' }
      ];

      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });

      const count = await genericOps.countResources();

      expect(count).toBe(3);
    });
  });

  describe('bulkDelete', () => {
    it('should perform bulk delete successfully', async () => {
      const mockServers = [
        { id: '1', name: 'server1' },
        { id: '2', name: 'server2' }
      ];

      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });
      mockClient.delete.mockResolvedValue({ data: {}, status: 204, statusText: 'No Content' });

      const filter = { environment: 'staging' };

      const result = await genericOps.bulkDelete(filter);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockClient.delete).toHaveBeenCalledWith('/servers/1');
      expect(mockClient.delete).toHaveBeenCalledWith('/servers/2');
    });

    it('should handle no resources to delete', async () => {
      mockClient.get.mockResolvedValue({ data: [], status: 200, statusText: 'OK' });

      const filter = { environment: 'nonexistent' };

      const result = await genericOps.bulkDelete(filter);

      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.operationId).toBe('no-op');
      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it('should reject invalid filter for delete', async () => {
      const filter = { environment: '' };

      await expect(
        genericOps.bulkDelete(filter)
      ).rejects.toThrow('Invalid filter');
    });
  });

  describe('buildQueryParams', () => {
    it('should build query params from simple filter', async () => {
      const mockServers = [{ id: '1', name: 'server1' }];
      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });

      await genericOps.getResources({ environment: 'prod', status: 'active' });

      expect(mockClient.get).toHaveBeenCalledWith('/servers?environment=prod&status=active');
    });

    it('should handle empty filter', async () => {
      const mockServers = [{ id: '1', name: 'server1' }];
      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });

      await genericOps.getResources({});

      expect(mockClient.get).toHaveBeenCalledWith('/servers');
    });

    it('should handle null and undefined values', async () => {
      const mockServers = [{ id: '1', name: 'server1' }];
      mockClient.get.mockResolvedValue({ data: mockServers, status: 200, statusText: 'OK' });

      await genericOps.getResources({ 
        environment: 'prod', 
        status: null, 
        tags: undefined 
      });

      expect(mockClient.get).toHaveBeenCalledWith('/servers?environment=prod');
    });
  });
}); 