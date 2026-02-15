import { PublicService } from '../src/public/public.service';
import { InstructorService } from '../src/instructor/instructor.service';
import { NotFoundException } from '@nestjs/common';

describe('PublicService – slug history redirects', () => {
  let service: PublicService;
  let mockPrisma: any;

  const approvedUser = {
    id: 'a1b2c3d4-1111-2222-3333-444444444444',
    name: '김숲',
    slug: 'new-slug-a1b2',
    profileImageUrl: null,
    instructorStatus: 'APPROVED',
    certifications: [],
    providerMemberships: [],
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      slugHistory: {
        findUnique: jest.fn(),
      },
    };
    service = new PublicService(mockPrisma);
  });

  it('current slug resolves to profile', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(approvedUser);

    const result = await service.getInstructorProfile('new-slug-a1b2');

    expect(result.profile!.success).toBe(true);
    expect(result.profile!.data.slug).toBe('new-slug-a1b2');
  });

  it('old slug redirects to current slug', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.slugHistory.findUnique.mockResolvedValue({
      user: { slug: 'new-slug-a1b2', instructorStatus: 'APPROVED' },
    });

    const result = await service.getInstructorProfile('old-slug-a1b2');

    expect(result.redirect).toBe('new-slug-a1b2');
    expect(mockPrisma.slugHistory.findUnique).toHaveBeenCalledWith({
      where: { slug: 'old-slug-a1b2' },
      select: { user: { select: { slug: true, instructorStatus: true } } },
    });
  });

  it('old slug returns 404 if instructor no longer APPROVED', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.slugHistory.findUnique.mockResolvedValue({
      user: { slug: 'new-slug-a1b2', instructorStatus: 'REJECTED' },
    });

    await expect(
      service.getInstructorProfile('old-slug-a1b2'),
    ).rejects.toThrow(NotFoundException);
  });

  it('completely unknown slug returns 404', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.slugHistory.findUnique.mockResolvedValue(null);

    await expect(
      service.getInstructorProfile('nonexistent-slug'),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not check slug history for UUID lookups', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.getInstructorProfile('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(NotFoundException);

    expect(mockPrisma.slugHistory.findUnique).not.toHaveBeenCalled();
  });

  it('old slug returns 404 if user slug is null', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.slugHistory.findUnique.mockResolvedValue({
      user: { slug: null, instructorStatus: 'APPROVED' },
    });

    await expect(
      service.getInstructorProfile('old-slug-a1b2'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('InstructorService – updateSlug slug history', () => {
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

  it('creates SlugHistory record when slug changes', async () => {
    mockTx.user.findUnique.mockResolvedValue(approvedUser);

    await service.updateSlug('user-1', 'new-slug');

    expect(mockTx.slugHistory.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', slug: 'old-slug' },
    });
    expect(mockTx.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        slugChangeCount: { lt: 1 },
        instructorStatus: 'APPROVED',
      },
      data: { slug: 'new-slug', slugChangeCount: { increment: 1 } },
    });
  });

  it('does not create history when user.slug is null', async () => {
    mockTx.user.findUnique.mockResolvedValue({
      ...approvedUser,
      slug: null,
    });

    await service.updateSlug('user-1', 'new-slug');

    expect(mockTx.slugHistory.create).not.toHaveBeenCalled();
    expect(mockTx.user.updateMany).toHaveBeenCalled();
  });
});
