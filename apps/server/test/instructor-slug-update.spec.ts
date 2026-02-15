import { InstructorService } from '../src/instructor/instructor.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('InstructorService – updateSlug', () => {
  let service: InstructorService;
  let mockPrisma: any;

  const approvedUser = {
    id: 'user-1',
    slug: 'old-slug',
    slugChangeCount: 0,
    instructorStatus: 'APPROVED',
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new InstructorService(mockPrisma);
  });

  it('success: APPROVED user with slugChangeCount=0 updates slug', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(approvedUser);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.updateSlug('user-1', 'new-slug');

    expect(result).toEqual({ success: true, data: { slug: 'new-slug' } });
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        slugChangeCount: { lt: 1 },
        instructorStatus: 'APPROVED',
      },
      data: { slug: 'new-slug', slugChangeCount: { increment: 1 } },
    });
  });

  it('404: user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.updateSlug('no-user', 'slug')).rejects.toThrow(NotFoundException);
  });

  it('403: user not APPROVED', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...approvedUser,
      instructorStatus: 'APPLIED',
    });

    await expect(service.updateSlug('user-1', 'new-slug')).rejects.toThrow(ForbiddenException);
  });

  it('400 SLUG_CHANGE_EXHAUSTED: slugChangeCount >= 1', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...approvedUser,
      slugChangeCount: 1,
    });

    await expect(service.updateSlug('user-1', 'new-slug')).rejects.toThrow(BadRequestException);
  });

  it('400 SLUG_UNCHANGED: new slug same as current', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(approvedUser);

    await expect(service.updateSlug('user-1', 'old-slug')).rejects.toThrow(BadRequestException);
  });

  it('400 SLUG_CHANGE_EXHAUSTED on race condition (updateMany count=0)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(approvedUser);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.updateSlug('user-1', 'new-slug')).rejects.toThrow(BadRequestException);
  });

  it('409 SLUG_TAKEN: Prisma P2002 unique constraint', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(approvedUser);
    mockPrisma.user.updateMany.mockRejectedValue({ code: 'P2002' });

    await expect(service.updateSlug('user-1', 'taken-slug')).rejects.toThrow(ConflictException);
  });

  it('normalizes to lowercase', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(approvedUser);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.updateSlug('user-1', 'My-Slug');

    expect(result.data.slug).toBe('my-slug');
  });

  it('collapses repeated hyphens', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(approvedUser);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.updateSlug('user-1', 'my---slug');

    expect(result.data.slug).toBe('my-slug');
  });

  it('trims leading and trailing hyphens', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(approvedUser);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.updateSlug('user-1', '-my-slug-');

    expect(result.data.slug).toBe('my-slug');
  });
});
