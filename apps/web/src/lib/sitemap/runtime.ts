import type { SitemapUrl } from './types';

export const SITEMAP_REVALIDATE_SECONDS = 3600;

const TIMEOUT_MS = 2000;

export async function safeGetUrls(
  label: string,
  fn: () => Promise<SitemapUrl[]>,
): Promise<SitemapUrl[]> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: timeout`)), TIMEOUT_MS),
    );
    return await Promise.race([fn(), timeout]);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[sitemap] ${label} failed:`, e);
    }
    return [];
  }
}
