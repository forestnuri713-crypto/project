import type { SitemapSourceAdapter } from './types';

// No enumeration endpoint exists (only GET /public/instructors/:slug).
// Will be replaced when a public list API is available.
export const instructorSitemapSource: SitemapSourceAdapter = {
  getUrls: async () => [],
};
