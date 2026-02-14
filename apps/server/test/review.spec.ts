import { ReviewsService } from '../src/reviews/reviews.service';
import { AdminService } from '../src/admin/admin.service';
import { AdminQueryReviewsDto } from '../src/admin/dto/admin-query-reviews.dto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BusinessException } from '../src/common/exceptions/business.exception';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      reservation: {
        findUnique: jest.fn(),
      },
      review: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      program: {
        update: jest.fn(),
      },
    };
    service = new ReviewsService(mockPrisma);
  });

  describe('createReview', () => {
    const userId = 'user-1';
    const dto = { reservationId: 'res-1', rating: 5, comment: '좋아요!' };

    it('should create a review for COMPLETED reservation and refresh stats', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        userId,
        programId: 'prog-1',
        status: 'COMPLETED',
        attendance: null,
      });
      mockPrisma.review.findUnique.mockResolvedValue(null);
      mockPrisma.review.create.mockResolvedValue({
        id: 'rev-1',
        programId: 'prog-1',
        reservationId: 'res-1',
        parentUserId: userId,
        rating: 5,
        comment: '좋아요!',
      });
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 5.0 },
        _count: { rating: 1 },
      });
      mockPrisma.program.update.mockResolvedValue({});

      const result = await service.createReview(userId, dto);
      expect(result.id).toBe('rev-1');
      expect(mockPrisma.review.create).toHaveBeenCalledWith({
        data: {
          programId: 'prog-1',
          reservationId: 'res-1',
          parentUserId: userId,
          rating: 5,
          comment: '좋아요!',
        },
      });
      expect(mockPrisma.program.update).toHaveBeenCalledWith({
        where: { id: 'prog-1' },
        data: { ratingAvg: 5.0, reviewCount: 1 },
      });
    });

    it('should create a review for ATTENDED reservation', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        userId,
        programId: 'prog-1',
        status: 'CONFIRMED',
        attendance: { status: 'ATTENDED' },
      });
      mockPrisma.review.findUnique.mockResolvedValue(null);
      mockPrisma.review.create.mockResolvedValue({ id: 'rev-1' });
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 5.0 },
        _count: { rating: 1 },
      });
      mockPrisma.program.update.mockResolvedValue({});

      const result = await service.createReview(userId, dto);
      expect(result.id).toBe('rev-1');
    });

    it('should reject review for non-COMPLETED/non-ATTENDED reservation', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        userId,
        programId: 'prog-1',
        status: 'CONFIRMED',
        attendance: null,
      });

      await expect(service.createReview(userId, dto)).rejects.toThrow(
        expect.objectContaining({ code: 'REVIEW_NOT_ALLOWED' }),
      );
    });

    it('should reject duplicate review (UNIQUE reservationId)', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        userId,
        programId: 'prog-1',
        status: 'COMPLETED',
        attendance: null,
      });
      mockPrisma.review.findUnique.mockResolvedValue({ id: 'existing-rev' });

      await expect(service.createReview(userId, dto)).rejects.toThrow(
        expect.objectContaining({ code: 'REVIEW_ALREADY_EXISTS' }),
      );
    });

    it('should reject review from non-owner', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        userId: 'other-user',
        programId: 'prog-1',
        status: 'COMPLETED',
        attendance: null,
      });

      await expect(service.createReview(userId, dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw 404 for non-existent reservation', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(null);

      await expect(service.createReview(userId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateReview', () => {
    it('should update review once, return fixed fields, and refresh stats', async () => {
      const editedAt = new Date();
      const updatedAt = new Date();
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        parentUserId: 'user-1',
        programId: 'prog-1',
        editedAt: null,
      });
      mockPrisma.review.update.mockResolvedValue({
        id: 'rev-1',
        rating: 4,
        comment: '수정된 코멘트',
        editedAt,
        updatedAt,
      });
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.0 },
        _count: { rating: 1 },
      });
      mockPrisma.program.update.mockResolvedValue({});

      const result = await service.updateReview('user-1', 'rev-1', { rating: 4 });
      expect(result.rating).toBe(4);
      expect(result.id).toBe('rev-1');
      expect(result.editedAt).toBe(editedAt);
      expect(result.updatedAt).toBe(updatedAt);

      // Verify select fields
      expect(mockPrisma.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            rating: true,
            comment: true,
            editedAt: true,
            updatedAt: true,
          },
        }),
      );

      // Verify stats refresh
      expect(mockPrisma.program.update).toHaveBeenCalledWith({
        where: { id: 'prog-1' },
        data: { ratingAvg: 4.0, reviewCount: 1 },
      });
    });

    it('should reject second edit', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        parentUserId: 'user-1',
        programId: 'prog-1',
        editedAt: new Date(),
      });

      await expect(
        service.updateReview('user-1', 'rev-1', { rating: 3 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update from non-owner', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        parentUserId: 'other-user',
        programId: 'prog-1',
        editedAt: null,
      });

      await expect(
        service.updateReview('user-1', 'rev-1', { rating: 3 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getReviewsByProgram', () => {
    it('should return only VISIBLE reviews with average rating', async () => {
      mockPrisma.review.findMany.mockResolvedValue([
        { id: 'rev-1', rating: 5, status: 'VISIBLE' },
        { id: 'rev-2', rating: 3, status: 'VISIBLE' },
      ]);
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.0 },
        _count: { rating: 2 },
      });

      const result = await service.getReviewsByProgram('prog-1');
      expect(result.reviews).toHaveLength(2);
      expect(result.averageRating).toBe(4.0);
      expect(result.totalCount).toBe(2);

      // Verify VISIBLE-only filter and no sensitive fields
      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId: 'prog-1', status: 'VISIBLE' },
          select: {
            id: true,
            rating: true,
            comment: true,
            editedAt: true,
            createdAt: true,
          },
        }),
      );
    });

    it('should return zero average when no reviews', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });

      const result = await service.getReviewsByProgram('prog-1');
      expect(result.reviews).toHaveLength(0);
      expect(result.averageRating).toBe(0);
      expect(result.totalCount).toBe(0);
    });
  });
});

describe('AdminService - Review', () => {
  let service: AdminService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      review: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      program: {
        update: jest.fn(),
      },
    };
    service = new AdminService(mockPrisma, {} as any, {} as any);
  });

  describe('setReviewStatus', () => {
    it('should set review to HIDDEN and refresh stats', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        programId: 'prog-1',
        status: 'VISIBLE',
      });
      mockPrisma.review.update.mockResolvedValue({
        id: 'rev-1',
        status: 'HIDDEN',
      });
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });
      mockPrisma.program.update.mockResolvedValue({});

      const result = await service.setReviewStatus('rev-1', 'HIDDEN');
      expect(result.status).toBe('HIDDEN');
      expect(mockPrisma.review.update).toHaveBeenCalledWith({
        where: { id: 'rev-1' },
        data: { status: 'HIDDEN' },
      });
      expect(mockPrisma.program.update).toHaveBeenCalledWith({
        where: { id: 'prog-1' },
        data: { ratingAvg: 0, reviewCount: 0 },
      });
    });

    it('should set review to VISIBLE and refresh stats', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        programId: 'prog-1',
        status: 'HIDDEN',
      });
      mockPrisma.review.update.mockResolvedValue({
        id: 'rev-1',
        status: 'VISIBLE',
      });
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.0 },
        _count: { rating: 1 },
      });
      mockPrisma.program.update.mockResolvedValue({});

      const result = await service.setReviewStatus('rev-1', 'VISIBLE');
      expect(result.status).toBe('VISIBLE');
    });

    it('should be idempotent — setting same status again succeeds', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'rev-1',
        programId: 'prog-1',
        status: 'HIDDEN',
      });
      mockPrisma.review.update.mockResolvedValue({
        id: 'rev-1',
        status: 'HIDDEN',
      });
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });
      mockPrisma.program.update.mockResolvedValue({});

      const result = await service.setReviewStatus('rev-1', 'HIDDEN');
      expect(result.status).toBe('HIDDEN');
    });

    it('should throw 404 for non-existent review', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(service.setReviewStatus('bad-id', 'HIDDEN')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findReviews', () => {
    it('should return paginated reviews with filters', async () => {
      mockPrisma.review.findMany.mockResolvedValue([
        { id: 'rev-1', rating: 5, status: 'VISIBLE' },
      ]);
      mockPrisma.review.count.mockResolvedValue(1);

      const query = Object.assign(new AdminQueryReviewsDto(), {
        status: 'VISIBLE' as any,
        rating: 5,
        page: 1,
        limit: 20,
      });
      const result = await service.findReviews(query);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
