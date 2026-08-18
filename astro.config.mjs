// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import typograf from './src/integrations/typograf.js';

export const SITE = 'https://pro-pto.com';

export default defineConfig({
  site: SITE,
  trailingSlash: 'never',
  build: {
    // ЧПУ без .html и без завершающего слэша: /oformlenie-id
    format: 'file',
    // критический CSS инлайном — меньше запросов, лучше LCP
    inlineStylesheets: 'always',
  },
  compressHTML: true,
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [
    sitemap({
      changefreq: 'weekly',
      lastmod: new Date(),
      serialize(item) {
        const u = item.url;
        if (u === SITE + '/') item.priority = 1.0;
        else if (/\/(ceny|oformlenie-id|vedenie-id|vosstanovlenie-id|autsorsing-pto|ppr|smety|audit-komplekta)$/.test(u)) item.priority = 0.9;
        else if (/\/blog\//.test(u)) item.priority = 0.7;
        else if (/\/(privacy|spasibo)$/.test(u)) item.priority = 0.2;
        else item.priority = 0.6;
        return item;
      },
      filter: (page) => !/\/(spasibo|404)/.test(page),
    }),
    // Русская типографика применяется к готовому HTML на этапе сборки.
    typograf(),
  ],
});
