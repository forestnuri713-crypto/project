import { PublicService } from '../src/public/public.service';

const now = new Date('2026-02-18T12:00:00.000Z');
const earlier = new Date('2026-02-17T12:00:00.000Z');
const earliest = new Date('2026-02-16T12:00:00.000Z');

function makeUser(
  overrides: Partial<{
    id: string;
    slug: string | null;
    instructorStatus: string;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: overrides.id ?? 'id-1',
    slug: overrides.slug !== undefined ? overrides.slug : 'slug-1',
    instructorStatus: overrides.instructorStatus ?? 'APPROVED',
    updatedAt: overrides.updatedAt ?? now,
  };
}

function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`).toString('base64url');
}

describe('PublicService - listApprovedInstructors', () => {
  let service: PublicService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      slugHistory: {
        findUnique: jest.fn(),
      },
    };
    service = new PublicService(mockPrisma);
  });

  it('should filter by APPROVED status and non-null slug', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    await service.listApprovedInstructors(undefined, 20);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instructorStatus: 'APPROVED',
          slug: { not: null },
        },
      }),
    );
  });

  it('should return only APPROVED instructors with slug (excludes APPLIED/REJECTED/NONE)', async () => {
    const approved = makeUser({ id: 'a1', slug: 'approved-slug', instructorStatus: 'APPROVED' });
    mockPrisma.user.findMany.mockResolvedValue([approved]);

    const result = await service.listApprovedInstructors(undefined, 20);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].slug).toBe('approved-slug');
    expect(result.items[0]).toHaveProperty('updatedAt');
    // id must NOT be exposed in response items
    expect((result.items[0] as any).id).toBeUndefined();
  });

  it('should return empty list when no instructors match', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await service.listApprovedInstructors(undefined, 20);

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });

  it('should respect limit parameter (take = limit + 1)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    await service.listApprovedInstructors(undefined, 5);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 6 }),
    );
  });

  it('should detect hasMore and return nextCursor when more items exist', async () => {
    const items = [
      makeUser({ id: 'a1', slug: 's1', updatedAt: now }),
      makeUser({ id: 'a2', slug: 's2', updatedAt: earlier }),
      makeUser({ id: 'a3', slug: 's3', updatedAt: earliest }),
    ];
    // limit=2, but 3 returned → hasMore=true
    mockPrisma.user.findMany.mockResolvedValue(items);

    const result = await service.listApprovedInstructors(undefined, 2);

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTruthy();
    // Decode the cursor to verify it matches the last returned item
    const decoded = Buffer.from(result.nextCursor!, 'base64url').toString();
    expect(decoded).toBe(`${earlier.toISOString()}|a2`);
  });

  it('should apply cursor tie-breaker WHERE when valid cursor provided', async () => {
    const cursor = encodeCursor(now, 'cursor-id');
    mockPrisma.user.findMany.mockResolvedValue([]);

    await service.listApprovedInstructors(cursor, 20);

    const call = mockPrisma.user.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { updatedAt: { lt: now } },
      { updatedAt: { equals: now }, id: { lt: 'cursor-id' } },
    ]);
  });

  it('should treat invalid cursor as first page (no error)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await service.listApprovedInstructors('not-a-valid-cursor', 20);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    // Should not have OR clause (treated as first page)
    const call = mockPrisma.user.findMany.mock.calls[0][0];
    expect(call.where.OR).toBeUndefined();
  });

  it('should return correct response shape { items, nextCursor, hasMore }', async () => {
    const user = makeUser({ id: 'a1', slug: 'test-slug', updatedAt: now });
    mockPrisma.user.findMany.mockResolvedValue([user]);

    const result = await service.listApprovedInstructors(undefined, 20);

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('nextCursor');
    expect(result).toHaveProperty('hasMore');
    expect(Object.keys(result)).toEqual(['items', 'nextCursor', 'hasMore']);
    expect(result.items[0]).toEqual({ slug: 'test-slug', updatedAt: now });
  });

  it('should order by updatedAt DESC, id DESC', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    await service.listApprovedInstructors(undefined, 20);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
});

describe('Route ordering: GET /public/instructors vs GET /public/instructors/:slug', () => {
  it('list endpoint should not interfere with slug endpoint', async () => {
    const mockPrisma: any = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      slugHistory: { findUnique: jest.fn() },
    };
    const service = new PublicService(mockPrisma);

    // List call should use findMany (not findFirst/findUnique)
    await service.listApprovedInstructors(undefined, 20);
    expect(mockPrisma.user.findMany).toHaveBeenCalled();
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();

    // Slug call should use findFirst (not findMany)
    jest.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'id-1',
      name: 'Test',
      slug: 'test-slug',
      profileImageUrl: null,
      instructorStatus: 'APPROVED',
      certifications: [],
      providerMemberships: [],
    });
    await service.getInstructorProfile('test-slug');
    expect(mockPrisma.user.findFirst).toHaveBeenCalled();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });
});
