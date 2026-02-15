/**
 * Lightweight Korean-to-Romanization slug utilities.
 *
 * Slug format: {romanized-name}-{first 4 chars of userId}
 * Example: 김숲 → gim-sup-a1b2
 */

// Korean Unicode block: 가 (0xAC00) ~ 힣 (0xD7A3)
// Each syllable = (initial * 21 + medial) * 28 + final
const INITIALS = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp',
  's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
];

const MEDIALS = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye',
  'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we',
  'wi', 'yu', 'eu', 'ui', 'i',
];

const FINALS = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't',
  'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l',
  'm', 'p', 'p', 's', 's', 'ng', 'j', 'j',
  'k', 't', 'p', 'h',
];

function romanizeKoreanChar(code: number): string {
  const base = code - 0xac00;
  const initialIdx = Math.floor(base / (21 * 28));
  const medialIdx = Math.floor((base % (21 * 28)) / 28);
  const finalIdx = base % 28;

  return INITIALS[initialIdx] + MEDIALS[medialIdx] + FINALS[finalIdx];
}

/**
 * Convert a name string into a URL-safe slug segment.
 * - Korean syllables are romanized
 * - Lowercase, a-z 0-9 hyphen only
 * - Collapses repeated hyphens, trims leading/trailing hyphens
 */
export function slugify(name: string): string {
  let result = '';

  for (const char of name) {
    const code = char.charCodeAt(0);

    if (code >= 0xac00 && code <= 0xd7a3) {
      // Korean syllable
      result += romanizeKoreanChar(code);
    } else {
      result += char.toLowerCase();
    }
  }

  return result
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → hyphen
    .replace(/-{2,}/g, '-')       // collapse multiple hyphens
    .replace(/^-|-$/g, '');       // trim leading/trailing hyphens
}

/**
 * Generate a unique slug for a user.
 *
 * Format: {slugified-name}-{first 4 chars of userId}
 * If collision, appends -2, -3, ... until unique.
 *
 * @param prisma - PrismaClient or PrismaService (needs user.findFirst)
 * @param name - User display name
 * @param userId - User UUID (used for short suffix)
 */
export async function generateUniqueSlug(
  prisma: { user: { findFirst: (args: any) => Promise<any> } },
  name: string,
  userId: string,
): Promise<string> {
  const base = slugify(name);
  const shortId = userId.slice(0, 4);
  const candidate = base ? `${base}-${shortId}` : `inst-${shortId}`;

  // Check if candidate is available
  const existing = await prisma.user.findFirst({
    where: { slug: candidate },
    select: { id: true },
  });

  if (!existing || existing.id === userId) {
    return candidate;
  }

  // Resolve collision: append -2, -3, ...
  for (let suffix = 2; suffix <= 100; suffix++) {
    const attempt = `${candidate}-${suffix}`;
    const conflict = await prisma.user.findFirst({
      where: { slug: attempt },
      select: { id: true },
    });
    if (!conflict || conflict.id === userId) {
      return attempt;
    }
  }

  // Fallback: use full id prefix (8 chars) to virtually guarantee uniqueness
  return `${base || 'inst'}-${userId.slice(0, 8)}`;
}
