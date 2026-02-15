import { PublicService } from '../src/public/public.service';
import { NotFoundException } from '@nestjs/common';

describe('PublicService - getInstructorProfile', () => {
  let service: PublicService;
  let mockPrisma: any;

  const approvedUser = {
    id: 'a1b2c3d4-1111-2222-3333-444444444444',
    name: '김숲',
    slug: 'gimsup-a1b2',
    profileImageUrl: 'https://example.com/photo.jpg',
    instructorStatus: 'APPROVED',
    certifications: [{ title: '숲해설사', issuer: '산림청', issuedAt: '2025-01-01' }],
    providerMemberships: [
      {
        provider: { id: 'prov-1', name: '숲똑 자연학교' },
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    service = new PublicService(mockPrisma);
  });

  it('should 308 redirect when looked up by UUID and slug exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(approvedUser);

    const result = await service.getInstructorProfile(approvedUser.id);

    expect(result.redirect).toBe('gimsup-a1b2');
    expect(result.profile).toBeUndefined();
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: approvedUser.id } }),
    );
  });

  it('should return profile when looked up by UUID and no slug', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...approvedUser,
      slug: null,
    });

    const result = await service.getInstructorProfile(approvedUser.id);

    expect(result.redirect).toBeUndefined();
    expect(result.profile!.success).toBe(true);
    expect(result.profile!.data.slug).toBe(approvedUser.id);
    expect(result.profile!.data.displayName).toBe('김숲');
  });

  it('should return profile when looked up by slug (APPROVED)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(approvedUser);

    const result = await service.getInstructorProfile('gimsup-a1b2');

    expect(result.redirect).toBeUndefined();
    expect(result.profile!.success).toBe(true);
    expect(result.profile!.data.slug).toBe('gimsup-a1b2');
    expect(result.profile!.data.provider).toEqual({ id: 'prov-1', name: '숲똑 자연학교' });
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'gimsup-a1b2' } }),
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should return 404 when UUID exists but not APPROVED', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...approvedUser,
      instructorStatus: 'APPLIED',
    });

    await expect(
      service.getInstructorProfile(approvedUser.id),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return 404 when slug exists but not APPROVED', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...approvedUser,
      instructorStatus: 'REJECTED',
    });

    await expect(
      service.getInstructorProfile('gimsup-a1b2'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return 404 when UUID not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.getInstructorProfile('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return 404 when slug not found', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.getInstructorProfile('nonexistent-slug'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should handle empty certifications and no provider', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...approvedUser,
      certifications: [],
      providerMemberships: [],
    });

    const result = await service.getInstructorProfile('gimsup-a1b2');

    expect(result.profile!.data.certifications).toEqual([]);
    expect(result.profile!.data.provider).toBeNull();
  });

  it('should lowercase slug key for lookup', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(approvedUser);

    await service.getInstructorProfile('GimSup-A1B2');

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'gimsup-a1b2' } }),
    );
  });
});
