import { CategoriesService } from '../src/categories/categories.service';
import { BusinessException } from '../src/common/exceptions/business.exception';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new CategoriesService(mockPrisma);
  });

  describe('findAll', () => {
    it('should return categories with programCount', async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: '야외활동',
          slug: 'outdoor',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { programs: 5 },
        },
      ]);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].programCount).toBe(5);
      expect(result[0].slug).toBe('outdoor');
    });
  });

  describe('findBySlug', () => {
    it('should return category by slug', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        name: '야외활동',
        slug: 'outdoor',
      });

      const result = await service.findBySlug('outdoor');
      expect(result.slug).toBe('outdoor');
    });

    it('should throw CATEGORY_NOT_FOUND for invalid slug', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('bad-slug')).rejects.toThrow(
        expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
      );
    });
  });

  describe('create', () => {
    it('should create a category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue({
        id: 'cat-1',
        name: '야외활동',
        slug: 'outdoor',
      });

      const result = await service.create({ name: '야외활동', slug: 'outdoor' });
      expect(result.id).toBe('cat-1');
    });

    it('should throw CATEGORY_SLUG_CONFLICT for duplicate slug', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ name: '야외활동', slug: 'outdoor' }),
      ).rejects.toThrow(
        expect.objectContaining({ code: 'CATEGORY_SLUG_CONFLICT' }),
      );
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      mockPrisma.category.findUnique
        .mockResolvedValueOnce({ id: 'cat-1', slug: 'outdoor' }) // find by id
        .mockResolvedValueOnce(null); // slug conflict check
      mockPrisma.category.update.mockResolvedValue({
        id: 'cat-1',
        name: '실내활동',
        slug: 'indoor',
      });

      const result = await service.update('cat-1', { name: '실내활동', slug: 'indoor' });
      expect(result.slug).toBe('indoor');
    });

    it('should throw CATEGORY_NOT_FOUND for non-existent id', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.update('bad-id', { name: 'test' })).rejects.toThrow(
        expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
      );
    });

    it('should throw CATEGORY_SLUG_CONFLICT when slug already taken', async () => {
      mockPrisma.category.findUnique
        .mockResolvedValueOnce({ id: 'cat-1', slug: 'outdoor' })
        .mockResolvedValueOnce({ id: 'cat-2', slug: 'indoor' }); // conflict

      await expect(
        service.update('cat-1', { slug: 'indoor' }),
      ).rejects.toThrow(
        expect.objectContaining({ code: 'CATEGORY_SLUG_CONFLICT' }),
      );
    });
  });

  describe('delete', () => {
    it('should delete a category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.category.delete.mockResolvedValue({});

      const result = await service.delete('cat-1');
      expect(result.deleted).toBe(true);
    });

    it('should throw CATEGORY_NOT_FOUND for non-existent id', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.delete('bad-id')).rejects.toThrow(
        expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
      );
    });
  });
});
