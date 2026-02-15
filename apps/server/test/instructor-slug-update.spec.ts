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
  let mockTx: any;

  const approvedUser = {
    id: 'user-1',
    slug: 'old-slug',
    slugChangeCount: 0,
    instructorStatus: 'APPROVED',
  };

  beforeEach(() => {
    mockTx = {
      user: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      slugHistory: {
        create: jest.fn(),
      },
    };

    mockPrisma = {
      $transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(mockTx)),
    };
    service = new InstructorService(mockPrisma);
  });

  it('success: APPROVED user with slugChangeCount=0 updates slug', async () => {
    mockTx.user.findUnique.mockResolvedValue(approvedUser);

    const result = await service.updateSlug('user-1', 'new-slug');

    expect(result).toEqual({ success: true, data: { slug: 'new-slug' } });
    expect(mockTx.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        slugChangeCount: { lt: 1 },
        instructorStatus: 'APPROVED',
      },
      data: { slug: 'new-slug', slugChangeCount: { increment: 1 } },
    });
  });

  it('404: user not found', async () => {
    mockTx.user.findUnique.mockResolvedValue(null);

    await expect(service.updateSlug('no-user', 'slug')).rejects.toThrow(NotFoundException);
  });

  it('403: user not APPROVED', async () => {
    mockTx.user.findUnique.mockResolvedValue({
      ...approvedUser,
      instructorStatus: 'APPLIED',
    });

    await expect(service.updateSlug('user-1', 'new-slug')).rejects.toThrow(ForbiddenException);
  });

  it('400 SLUG_CHANGE_EXHAUSTED: slugChangeCount >= 1', async () => {
    mockTx.user.findUnique.mockResolvedValue({
      ...approvedUser,
      slugChangeCount: 1,
    });

    await expect(service.updateSlug('user-1', 'new-slug')).rejects.toThrow(BadRequestException);
  });

  it('400 SLUG_UNCHANGED: new slug same as current', async () => {
    mockTx.user.findUnique.mockResolvedValue(approvedUser);

    await expect(service.updateSlug('user-1', 'old-slug')).rejects.toThrow(BadRequestException);
  });

  it('400 SLUG_CHANGE_EXHAUSTED on race condition (updateMany count=0)', async () => {
    mockTx.user.findUnique.mockResolvedValue(approvedUser);
    mockTx.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.updateSlug('user-1', 'new-slug')).rejects.toThrow(BadRequestException);
  });

  it('409 SLUG_TAKEN: Prisma P2002 unique constraint', async () => {
    mockPrisma.$transaction.mockRejectedValue({ code: 'P2002' });

    await expect(service.updateSlug('user-1', 'taken-slug')).rejects.toThrow(ConflictException);
  });

  it('normalizes to lowercase', async () => {
    mockTx.user.findUnique.mockResolvedValue(approvedUser);

    const result = await service.updateSlug('user-1', 'My-Slug');

    expect(result.data.slug).toBe('my-slug');
  });

  it('collapses repeated hyphens', async () => {
    mockTx.user.findUnique.mockResolvedValue(approvedUser);

    const result = await service.updateSlug('user-1', 'my---slug');

    expect(result.data.slug).toBe('my-slug');
  });

  it('trims leading and trailing hyphens', async () => {
    mockTx.user.findUnique.mockResolvedValue(approvedUser);

    const result = await service.updateSlug('user-1', '-my-slug-');

    expect(result.data.slug).toBe('my-slug');
  });
});
