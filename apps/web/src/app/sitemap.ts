/**
 * Sprint 24: Sitemap generator.
 *
 * Emits:
 *  1. Static routes from Sprint 22 foundation (home page).
 *  2. Instructor profile URLs sourced from GET /public/instructors via adapter.
 *
 * ISR revalidation: 24 h.  If the adapter fails, static-only sitemap is
 * returned — no build break and no unhandled rejection.
 */

import type { MetadataRoute } from 'next';
import { listInstructorsForSitemap } from '@/lib/instructors.adapter';

// Revalidate the sitemap every 24 hours (ISR).
export const revalidate = 86400;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // --- Sprint 22 static entries (preserve) ---
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];

  // --- Sprint 24: instructor URLs from real endpoint ---
  let instructorEntries: MetadataRoute.Sitemap = [];
  try {
    const { slugs } = await listInstructorsForSitemap();
    instructorEntries = slugs.map((slug) => ({
      url: `${SITE_URL}/instructors/${slug}`,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch (err) {
    // Adapter should never throw, but guard here too so the sitemap
    // always renders with at least the static entries.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[sitemap] instructor adapter error (static-only fallback):', err);
    }
  }

  return [...staticEntries, ...instructorEntries];
}
