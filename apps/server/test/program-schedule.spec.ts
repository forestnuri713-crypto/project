import { ProgramsService } from '../src/programs/programs.service';
import { NotFoundException } from '@nestjs/common';

describe('ProgramsService - findSchedules', () => {
  let service: ProgramsService;
  let schedules: any[];

  beforeEach(() => {
    schedules = [
      { id: 'sch-2', programId: 'prog-1', startAt: new Date('2026-03-02'), endAt: null, capacity: 10, status: 'ACTIVE' },
      { id: 'sch-1', programId: 'prog-1', startAt: new Date('2026-03-01'), endAt: new Date('2026-03-01T12:00:00'), capacity: 5, status: 'ACTIVE' },
    ];

    const mockPrisma: any = {
      program: {
        findUnique: jest.fn().mockImplementation((args: any) => {
          if (args.where.id === 'prog-1') return Promise.resolve({ id: 'prog-1' });
          return Promise.resolve(null);
        }),
      },
      programSchedule: {
        findMany: jest.fn().mockImplementation((args: any) => {
          const filtered = schedules
            .filter((s) => s.programId === args.where.programId && s.status === args.where.status)
            .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
            .map((s) => ({
              id: s.id,
              startAt: s.startAt,
              endAt: s.endAt,
              capacity: s.capacity,
              status: s.status,
            }));
          return Promise.resolve(filtered);
        }),
      },
    };

    const mockCategories: any = {};
    service = new ProgramsService(mockPrisma, mockCategories);
  });

  it('should return schedules ordered by startAt asc with correct fields', async () => {
    const result = await service.findSchedules('prog-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('sch-1');
    expect(result[1].id).toBe('sch-2');
    // Verify returned fields
    expect(result[0]).toEqual({
      id: 'sch-1',
      startAt: new Date('2026-03-01'),
      endAt: new Date('2026-03-01T12:00:00'),
      capacity: 5,
      status: 'ACTIVE',
    });
  });

  it('should throw NotFoundException for unknown programId', async () => {
    await expect(service.findSchedules('unknown')).rejects.toThrow(NotFoundException);
  });
});
