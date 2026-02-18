import type { MetadataRoute } from 'next';
import { safeGetUrls, SITEMAP_REVALIDATE_SECONDS } from '@/lib/sitemap/runtime';
import { instructorSitemapSource } from '@/lib/sitemap/instructors.stub';

export const revalidate = SITEMAP_REVALIDATE_SECONDS;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];

  const instructorUrls = await safeGetUrls('instructors', () =>
    instructorSitemapSource.getUrls(),
  );

  return [...staticUrls, ...instructorUrls];
}
