import { NotFoundException } from '@nestjs/common';
import { AdminService } from '../src/admin/admin.service';

describe('Publish gating', () => {
  let service: AdminService;
  let mockPrisma: any;
  let mockStorage: any;

  beforeEach(() => {
    mockPrisma = {
      provider: { findUnique: jest.fn() },
      providerProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    mockStorage = {
      generateDownloadUrl: jest.fn().mockResolvedValue('https://signed.example.com'),
    };
    service = new AdminService(mockPrisma, {} as any, mockStorage);
  });

  describe('publishProviderProfile', () => {
    it('should throw 404 when profile does not exist', async () => {
      mockPrisma.providerProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.publishProviderProfile('provider-1', { isPublished: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update isPublished to true', async () => {
      mockPrisma.providerProfile.findUnique.mockResolvedValue({ id: 'p1', isPublished: false });
      mockPrisma.providerProfile.update.mockResolvedValue({ id: 'p1', isPublished: true });
      const result = await service.publishProviderProfile('provider-1', {
        isPublished: true,
      });
      expect(result.isPublished).toBe(true);
      expect(mockPrisma.providerProfile.update).toHaveBeenCalledWith({
        where: { providerId: 'provider-1' },
        data: { isPublished: true },
      });
    });

    it('should update isPublished to false', async () => {
      mockPrisma.providerProfile.findUnique.mockResolvedValue({ id: 'p1', isPublished: true });
      mockPrisma.providerProfile.update.mockResolvedValue({ id: 'p1', isPublished: false });
      const result = await service.publishProviderProfile('provider-1', {
        isPublished: false,
      });
      expect(result.isPublished).toBe(false);
    });
  });

  describe('getProviderProfile - gating', () => {
    it('should return profile when provider exists but no profile (default)', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Test',
        regionTags: [],
      });
      mockPrisma.providerProfile.findUnique.mockResolvedValue(null);
      const result = await service.getProviderProfile('p1');
      expect(result.profile.isPublished).toBe(false);
    });

    it('should throw 404 when provider does not exist', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue(null);
      await expect(service.getProviderProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
