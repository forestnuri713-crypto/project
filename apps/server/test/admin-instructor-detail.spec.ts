import { AdminService } from '../src/admin/admin.service';
import { NotFoundException } from '@nestjs/common';

describe('AdminService - findInstructorById', () => {
  let service: AdminService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };
    service = new AdminService(mockPrisma, {} as any, {} as any);
  });

  it('should return instructor with correct select fields (200)', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'instructor@test.com',
      name: '김숲',
      role: 'INSTRUCTOR',
      phoneNumber: '010-1234-5678',
      profileImageUrl: null,
      instructorStatus: 'APPLIED',
      instructorStatusReason: null,
      certifications: [],
      createdAt: new Date('2026-02-01'),
    };
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.findInstructorById('user-1');

    expect(result).toEqual(mockUser);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phoneNumber: true,
        profileImageUrl: true,
        instructorStatus: true,
        instructorStatusReason: true,
        certifications: true,
        createdAt: true,
      },
    });
  });

  it('should throw NotFoundException when user not found (404 NOT_FOUND envelope)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findInstructorById('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
