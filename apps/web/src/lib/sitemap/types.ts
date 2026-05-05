export type SitemapUrl = { url: string; lastModified?: Date };

export interface SitemapSourceAdapter {
  getUrls(): Promise<SitemapUrl[]>;
}
