import { test, expect } from '@playwright/test';

test.describe('sitemap.xml', () => {
  test('returns 200 with valid urlset', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain('<urlset');
  });
});
