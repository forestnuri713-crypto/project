import { AdminService } from '../src/admin/admin.service';
import { NotFoundException } from '@nestjs/common';

describe('AdminService - Provider', () => {
  let service: AdminService;
  let mockPrisma: any;
  let mockNotifications: any;
  let mockStorage: any;

  beforeEach(() => {
    mockPrisma = {
      provider: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      providerProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };
    mockNotifications = {};
    mockStorage = {
      generateDownloadUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
      generateUploadUrl: jest.fn().mockResolvedValue('https://upload-url.example.com'),
    };
    service = new AdminService(mockPrisma, mockNotifications, mockStorage);
  });

  describe('createProvider', () => {
    it('should create a provider', async () => {
      const dto = { name: '테스트 업체', regionTags: ['서울', '경기'] };
      mockPrisma.provider.create.mockResolvedValue({ id: '1', ...dto });
      const result = await service.createProvider(dto);
      expect(result.name).toBe('테스트 업체');
      expect(mockPrisma.provider.create).toHaveBeenCalledWith({
        data: { name: '테스트 업체', regionTags: ['서울', '경기'] },
      });
    });
  });

  describe('findProviders', () => {
    it('should return paginated providers', async () => {
      mockPrisma.provider.findMany.mockResolvedValue([{ id: '1', name: 'A' }]);
      mockPrisma.provider.count.mockResolvedValue(1);
      const result = await service.findProviders({ page: 1, pageSize: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  describe('updateProvider', () => {
    it('should throw 404 if provider not found', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue(null);
      await expect(service.updateProvider('bad-id', { name: 'new' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getProviderProfile', () => {
    it('should return default profile when none exists', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test',
        regionTags: ['서울'],
      });
      mockPrisma.providerProfile.findUnique.mockResolvedValue(null);
      const result = await service.getProviderProfile('1');
      expect(result.profile.displayName).toBe('Test');
      expect(result.profile.isPublished).toBe(false);
    });
  });
});
