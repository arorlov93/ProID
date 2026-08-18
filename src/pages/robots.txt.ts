import type { APIRoute } from 'astro';
import { production, site } from '../data/site';

/**
 * robots.txt собирается кодом, а не лежит статикой, по одной причине:
 * он обязан следовать за флагом production. Пока боевым сайтом ПроПТО
 * выбран другой проект, эта сборка закрывается целиком — две сборки
 * на одном домене с одинаковыми canonical делят бренд в выдаче.
 *
 * Боевой вариант ниже сохранён полностью: включается снятием одного флага.
 */

const CLEAN = 'utm_source&utm_medium&utm_campaign&utm_term&utm_content&yclid&gclid&from&_openstat';

/* Роботы языковых моделей названы поимённо намеренно: молчание часть из них
   трактует как разрешение, часть — как запрет, и сайт то появляется
   в ответах, то нет. */
const AI = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'YandexAdditional',
  'Applebot-Extended',
  'Bingbot',
];

export const GET: APIRoute = () => {
  const L: string[] = [];

  if (!production) {
    L.push('# Справочная сборка ПроПТО, не боевой сайт.');
    L.push('# Индексация закрыта намеренно: боевым выбран другой проект,');
    L.push('# и две сборки на одном домене делили бы бренд в выдаче.');
    L.push('# Включается флагом production в src/data/site.ts.');
    L.push('');
    L.push('User-agent: *');
    L.push('Disallow: /');
  } else {
    L.push('# Обычные поисковые роботы');
    for (const ua of ['*', 'Yandex']) {
      L.push(`User-agent: ${ua}`);
      L.push('Allow: /');
      L.push('Disallow: /404');
      L.push(`Clean-param: ${CLEAN}`);
      L.push('');
    }
    L.push('# Роботы языковых моделей и ответных сервисов.');
    L.push('# Доступ открыт: попасть в ответ на «сколько стоит АОСР» ценнее,');
    L.push('# чем закрыть прайс, который и так открыт всем.');
    L.push('# Карта для машинного чтения — /llms.txt');
    L.push('');
    for (const ua of AI) {
      L.push(`User-agent: ${ua}`);
      L.push('Allow: /');
      L.push('');
    }
    L.push(`Host: ${site.url}`);
    L.push(`Sitemap: ${site.url}/sitemap-index.xml`);
  }

  return new Response(L.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
