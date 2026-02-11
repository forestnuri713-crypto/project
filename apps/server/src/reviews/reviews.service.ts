import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      include: { attendance: true },
    });

    if (!reservation) {
      throw new NotFoundException('예약을 찾을 수 없습니다');
    }

    if (reservation.userId !== userId) {
      throw new ForbiddenException('본인의 예약에만 리뷰를 작성할 수 있습니다');
    }

    const isCompleted = reservation.status === 'COMPLETED';
    const isAttended = reservation.attendance?.status === 'ATTENDED';

    if (!isCompleted && !isAttended) {
      throw new BadRequestException('완료되었거나 출석한 예약에만 리뷰를 작성할 수 있습니다');
    }

    const existing = await this.prisma.review.findUnique({
      where: { reservationId: dto.reservationId },
    });

    if (existing) {
      throw new ConflictException('이미 리뷰를 작성한 예약입니다');
    }

    return this.prisma.review.create({
      data: {
        programId: reservation.programId,
        reservationId: dto.reservationId,
        parentUserId: userId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }

  async updateReview(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    if (review.parentUserId !== userId) {
      throw new ForbiddenException('본인의 리뷰만 수정할 수 있습니다');
    }

    if (review.editedAt) {
      throw new BadRequestException('리뷰는 1회만 수정할 수 있습니다');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.comment !== undefined && { comment: dto.comment }),
        editedAt: new Date(),
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        editedAt: true,
        updatedAt: true,
      },
    });
  }

  async getReviewsByProgram(programId: string) {
    const [reviews, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: { programId, status: 'VISIBLE' },
        select: {
          id: true,
          rating: true,
          comment: true,
          editedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.aggregate({
        where: { programId, status: 'VISIBLE' },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      reviews,
      averageRating: aggregate._avg.rating ?? 0,
      totalCount: aggregate._count.rating,
    };
  }
}
