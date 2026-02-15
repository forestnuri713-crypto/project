import { slugify, generateUniqueSlug } from '../src/public/slug.utils';

describe('slugify', () => {
  it('should romanize Korean name', () => {
    expect(slugify('김숲')).toBe('gimsup');
  });

  it('should romanize multi-syllable Korean name', () => {
    expect(slugify('박지민')).toBe('bakjimin');
  });

  it('should lowercase English name', () => {
    expect(slugify('John')).toBe('john');
  });

  it('should handle mixed Korean and English', () => {
    expect(slugify('김 Coach')).toBe('gim-coach');
  });

  it('should strip special characters', () => {
    expect(slugify('Hello! World@#')).toBe('hello-world');
  });

  it('should collapse multiple hyphens', () => {
    expect(slugify('a   b   c')).toBe('a-b-c');
  });

  it('should trim leading and trailing hyphens', () => {
    expect(slugify(' hello ')).toBe('hello');
  });

  it('should return empty string for whitespace-only input', () => {
    expect(slugify('   ')).toBe('');
  });

  it('should return empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });
});

describe('generateUniqueSlug', () => {
  it('should generate slug with name and short id', async () => {
    const mockPrisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const slug = await generateUniqueSlug(mockPrisma, '김숲', 'a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    expect(slug).toBe('gimsup-a1b2');
  });

  it('should use fallback for empty name', async () => {
    const mockPrisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const slug = await generateUniqueSlug(mockPrisma, '', 'abcd1234-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    expect(slug).toBe('inst-abcd');
  });

  it('should append -2 on first collision', async () => {
    const mockPrisma = {
      user: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'other-user' })  // candidate taken
          .mockResolvedValueOnce(null),                   // candidate-2 available
      },
    };

    const slug = await generateUniqueSlug(mockPrisma, '김숲', 'a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    expect(slug).toBe('gimsup-a1b2-2');
  });

  it('should skip collision check if same user owns the slug', async () => {
    const userId = 'a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
    const mockPrisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: userId }),
      },
    };

    const slug = await generateUniqueSlug(mockPrisma, '김숲', userId);
    expect(slug).toBe('gimsup-a1b2');
  });
});
