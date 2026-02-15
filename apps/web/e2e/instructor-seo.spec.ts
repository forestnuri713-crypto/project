import { test, expect } from '@playwright/test';

test.describe('/instructors/[slug] SSR meta tags', () => {
  test('Case 1: APPROVED instructor has correct SEO meta', async ({ request }) => {
    const res = await request.get('/instructors/kim-forest-e2e');
    expect(res.status()).toBe(200);

    const html = await res.text();

    // <title> contains displayName
    expect(html).toMatch(/<title[^>]*>.*김숲E2E.*<\/title>/);

    // canonical is absolute URL
    expect(html).toContain(
      'href="http://localhost:3088/instructors/kim-forest-e2e"',
    );

    // og:title exists
    expect(html).toMatch(/property="og:title"\s+content="[^"]*김숲E2E[^"]*"/);

    // og:type = profile
    expect(html).toMatch(/property="og:type"\s+content="profile"/);
  });

  test('Case 2: Non-existent slug returns 404 with fallback meta', async ({ request }) => {
    const res = await request.get('/instructors/no-such-slug-999');
    expect(res.status()).toBe(404);

    const html = await res.text();

    // Next.js renders fallback title in RSC payload for notFound pages
    // The generateMetadata fallback "강사 소개 | 숲똑" is present in SSR output
    expect(html).toContain('강사 소개 | 숲똑');

    // Next.js automatically adds robots noindex for notFound pages
    expect(html).toContain('name="robots" content="noindex"');
  });
});
