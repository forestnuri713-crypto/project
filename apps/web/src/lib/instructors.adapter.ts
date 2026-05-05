/**
 * Sprint 24: Instructor list adapter for sitemap generation.
 *
 * Calls GET /public/instructors (APPROVED-only, cursor pagination) and
 * exhausts all pages to collect slugs.  Falls back to empty list if the
 * endpoint is unreachable, the env var is missing, or the response shape is
 * unexpected — so the sitemap never hard-fails the build.
 */

const MAX_PAGES = 1000;
const PAGE_LIMIT = 100;

export async function listInstructorsForSitemap(): Promise<{
  slugs: string[];
  source: 'remote' | 'stub';
}> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    // No base URL configured (e.g. CI without secrets) — soft fallback.
    return { slugs: [], source: 'stub' };
  }

  try {
    const collected: string[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(`${apiBase}/public/instructors`);
      url.searchParams.set('limit', String(PAGE_LIMIT));
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      // Use Next.js extended fetch caching: revalidate daily alongside sitemap.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await fetch(url.toString(), { next: { revalidate: 86400 } } as any);
      if (!res.ok) break;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json().catch(() => null);

      // Validate response shape (Option B from Sprint 23 SSOT).
      if (!json?.success || !Array.isArray(json?.data?.items)) break;

      for (const item of json.data.items) {
        const slug =
          typeof item?.slug === 'string' ? item.slug.trim() : '';
        if (slug) collected.push(slug);
      }

      // Stop when there are no more pages.
      if (!json.data.hasMore || !json.data.nextCursor) break;
      cursor = String(json.data.nextCursor);
    }

    // Deduplicate defensively.
    return { slugs: [...new Set(collected)], source: 'remote' };
  } catch {
    // Network error, JSON parse failure, or any unexpected throw → soft fallback.
    return { slugs: [], source: 'stub' };
  }
}
