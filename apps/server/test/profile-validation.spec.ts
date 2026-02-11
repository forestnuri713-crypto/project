import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AdminUpsertProfileDto } from '../src/admin/dto/admin-upsert-profile.dto';

describe('AdminUpsertProfileDto validation', () => {
  it('should pass with valid data', async () => {
    const dto = plainToInstance(AdminUpsertProfileDto, {
      displayName: '숲놀이터',
      introShort: '자연 속 아이들의 놀이터',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail when introShort exceeds 40 characters', async () => {
    const dto = plainToInstance(AdminUpsertProfileDto, {
      displayName: '숲놀이터',
      introShort: 'a'.repeat(41),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const introError = errors.find((e) => e.property === 'introShort');
    expect(introError).toBeDefined();
  });

  it('should fail when displayName is missing', async () => {
    const dto = plainToInstance(AdminUpsertProfileDto, {});
    const errors = await validate(dto);
    const nameError = errors.find((e) => e.property === 'displayName');
    expect(nameError).toBeDefined();
  });

  it('should fail when coverImageUrls exceeds max count', async () => {
    const dto = plainToInstance(AdminUpsertProfileDto, {
      displayName: '숲놀이터',
      coverImageUrls: ['a', 'b', 'c', 'd'],
    });
    const errors = await validate(dto);
    const coverError = errors.find((e) => e.property === 'coverImageUrls');
    expect(coverError).toBeDefined();
  });
});
