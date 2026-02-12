export async function refreshProgramReviewStats(
  prisma: { review: any; program: any },
  programId: string,
): Promise<void> {
  const aggregate = await prisma.review.aggregate({
    where: { programId, status: 'VISIBLE' },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.program.update({
    where: { id: programId },
    data: {
      ratingAvg: aggregate._avg.rating ?? 0,
      reviewCount: aggregate._count.rating,
    },
  });
}
