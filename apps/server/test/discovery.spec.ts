import { ProgramsService } from '../src/programs/programs.service';
import { ProgramsController } from '../src/programs/programs.controller';
import { CategoriesService } from '../src/categories/categories.service';
import { BusinessException } from '../src/common/exceptions/business.exception';

describe('ProgramsService - discover', () => {
  let service: ProgramsService;
  let mockPrisma: any;
  let mockCategoriesService: any;

  const makeProgram = (overrides: any = {}) => ({
    id: 'prog-1',
    title: '숲체험',
    description: '숲에서 놀아요',
    location: '강남구',
    price: 30000,
    ratingAvg: 4.5,
    reviewCount: 10,
    scheduleAt: new Date(),
    createdAt: new Date(),
    gallery: [{ imageKey: 'img/cover.jpg' }],
    provider: { regionTags: ['서울', '강남'] },
    instructor: { id: 'inst-1', name: '김강사', profileImageUrl: null },
    categories: [{ category: { slug: 'outdoor', name: '야외활동' } }],
    ...overrides,
  });

  beforeEach(() => {
    mockPrisma = {
      program: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    mockCategoriesService = {
      findBySlug: jest.fn(),
    };

    service = new ProgramsService(mockPrisma, mockCategoriesService);
  });

  it('should return paginated results with defaults', async () => {
    const prog = makeProgram();
    mockPrisma.program.findMany.mockResolvedValue([prog]);
    mockPrisma.program.count.mockResolvedValue(1);

    const result = await service.discover({});

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.items[0].coverImageUrl).toBe('img/cover.jpg');
    expect(result.items[0].regionTags).toEqual(['서울', '강남']);
    expect(result.items[0].minPrice).toBe(30000);
    expect(result.items[0].categories).toEqual([{ slug: 'outdoor', name: '야외활동' }]);
  });

  it('should return null coverImageUrl when no gallery', async () => {
    const prog = makeProgram({ gallery: [] });
    mockPrisma.program.findMany.mockResolvedValue([prog]);
    mockPrisma.program.count.mockResolvedValue(1);

    const result = await service.discover({});
    expect(result.items[0].coverImageUrl).toBeNull();
  });

  it('should return empty regionTags when no provider', async () => {
    const prog = makeProgram({ provider: null });
    mockPrisma.program.findMany.mockResolvedValue([prog]);
    mockPrisma.program.count.mockResolvedValue(1);

    const result = await service.discover({});
    expect(result.items[0].regionTags).toEqual([]);
  });

  it('should filter by keyword', async () => {
    mockPrisma.program.findMany.mockResolvedValue([]);
    mockPrisma.program.count.mockResolvedValue(0);

    await service.discover({ keyword: '숲체험' });

    expect(mockPrisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: '숲체험', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('should throw VALIDATION_ERROR for empty keyword', async () => {
    await expect(service.discover({ keyword: '   ' })).rejects.toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('should throw VALIDATION_ERROR for 1-char keyword (SPEC: min 2)', async () => {
    await expect(service.discover({ keyword: '숲' })).rejects.toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('should accept 2-char keyword', async () => {
    mockPrisma.program.findMany.mockResolvedValue([]);
    mockPrisma.program.count.mockResolvedValue(0);

    await service.discover({ keyword: '숲체' });

    expect(mockPrisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: '숲체', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('should throw VALIDATION_ERROR for keyword over 100 chars', async () => {
    const longKeyword = 'a'.repeat(101);
    await expect(service.discover({ keyword: longKeyword })).rejects.toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('should filter by category slug', async () => {
    mockCategoriesService.findBySlug.mockResolvedValue({ id: 'cat-1', slug: 'outdoor' });
    mockPrisma.program.findMany.mockResolvedValue([]);
    mockPrisma.program.count.mockResolvedValue(0);

    await service.discover({ category: 'outdoor' });

    expect(mockCategoriesService.findBySlug).toHaveBeenCalledWith('outdoor');
    expect(mockPrisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categories: { some: { category: { slug: 'outdoor' } } },
        }),
      }),
    );
  });

  it('should throw CATEGORY_NOT_FOUND for invalid category', async () => {
    mockCategoriesService.findBySlug.mockRejectedValue(
      new BusinessException('CATEGORY_NOT_FOUND', 'not found', 404),
    );

    await expect(service.discover({ category: 'bad-slug' })).rejects.toThrow(
      expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
    );
  });

  it('should filter by region', async () => {
    mockPrisma.program.findMany.mockResolvedValue([]);
    mockPrisma.program.count.mockResolvedValue(0);

    await service.discover({ region: '강남' });

    expect(mockPrisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          location: { contains: '강남', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('should sort by rating desc', async () => {
    mockPrisma.program.findMany.mockResolvedValue([]);
    mockPrisma.program.count.mockResolvedValue(0);

    await service.discover({ sort: 'rating' });

    expect(mockPrisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { ratingAvg: 'desc' },
      }),
    );
  });

  it('should sort by priceAsc', async () => {
    mockPrisma.program.findMany.mockResolvedValue([]);
    mockPrisma.program.count.mockResolvedValue(0);

    await service.discover({ sort: 'priceAsc' });

    expect(mockPrisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { price: 'asc' },
      }),
    );
  });

  it('should sort by priceDesc', async () => {
    mockPrisma.program.findMany.mockResolvedValue([]);
    mockPrisma.program.count.mockResolvedValue(0);

    await service.discover({ sort: 'priceDesc' });

    expect(mockPrisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { price: 'desc' },
      }),
    );
  });

  it('should paginate correctly', async () => {
    mockPrisma.program.findMany.mockResolvedValue([]);
    mockPrisma.program.count.mockResolvedValue(50);

    const result = await service.discover({ page: 3, pageSize: 10 });

    expect(mockPrisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(50);
  });

  it('should include categories array in response items', async () => {
    const prog = makeProgram({
      categories: [
        { category: { slug: 'outdoor', name: '야외활동' } },
        { category: { slug: 'forest', name: '숲체험' } },
      ],
    });
    mockPrisma.program.findMany.mockResolvedValue([prog]);
    mockPrisma.program.count.mockResolvedValue(1);

    const result = await service.discover({});
    expect(result.items[0].categories).toEqual([
      { slug: 'outdoor', name: '야외활동' },
      { slug: 'forest', name: '숲체험' },
    ]);
  });

  it('should return empty categories array when program has none', async () => {
    const prog = makeProgram({ categories: [] });
    mockPrisma.program.findMany.mockResolvedValue([prog]);
    mockPrisma.program.count.mockResolvedValue(1);

    const result = await service.discover({});
    expect(result.items[0].categories).toEqual([]);
  });
});

describe('ProgramsController - GET /programs routing', () => {
  let controller: ProgramsController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      findAll: jest.fn().mockResolvedValue([]),
      discover: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    controller = new ProgramsController(mockService);
  });

  it('should route to findAll when no discovery params', async () => {
    await controller.findAll({ location: '강남' });

    expect(mockService.findAll).toHaveBeenCalled();
    expect(mockService.discover).not.toHaveBeenCalled();
  });

  it('should route to discover when category param present', async () => {
    await controller.findAll({ category: 'outdoor' });

    expect(mockService.discover).toHaveBeenCalledWith({ category: 'outdoor' });
    expect(mockService.findAll).not.toHaveBeenCalled();
  });

  it('should route to discover when keyword param present', async () => {
    await controller.findAll({ keyword: '숲체험' });

    expect(mockService.discover).toHaveBeenCalled();
    expect(mockService.findAll).not.toHaveBeenCalled();
  });

  it('should route to discover when sort param present', async () => {
    await controller.findAll({ sort: 'rating' });

    expect(mockService.discover).toHaveBeenCalled();
    expect(mockService.findAll).not.toHaveBeenCalled();
  });

  it('should route to discover when page param present', async () => {
    await controller.findAll({ page: 2 });

    expect(mockService.discover).toHaveBeenCalled();
    expect(mockService.findAll).not.toHaveBeenCalled();
  });

  it('should route to discover when pageSize param present', async () => {
    await controller.findAll({ pageSize: 10 });

    expect(mockService.discover).toHaveBeenCalled();
    expect(mockService.findAll).not.toHaveBeenCalled();
  });

  it('should route to discover when region param present', async () => {
    await controller.findAll({ region: '강남' });

    expect(mockService.discover).toHaveBeenCalled();
    expect(mockService.findAll).not.toHaveBeenCalled();
  });

  it('should route to findAll with legacy params only', async () => {
    await controller.findAll({ location: '강남', dateFrom: '2026-01-01', minAge: 5 });

    expect(mockService.findAll).toHaveBeenCalled();
    expect(mockService.discover).not.toHaveBeenCalled();
  });
});
