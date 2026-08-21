/**
 * Поиск и загрузка кандидатов по темам из photos/themes.json.
 *
 * Источники без ключа: Openverse (агрегатор изображений со свободными
 * лицензиями) и Wikimedia Commons. Оба отдают лицензию и автора — это
 * важнее удобства: коммерческому сайту нужна прослеживаемость прав.
 *
 * ВАЖНО, проверено на практике: лицензионно эти два источника хороши,
 * но корпус у них не тот — на предметные запросы приходят музейные
 * сканы, старые карты и контактные листы плёнки. Из 92 кандидатов
 * не нашлось ни одного пригодного. Рабочим источником оказался
 * Unsplash. Прежде чем гонять весь список тем, проверьте на одной
 * теме, что источник вообще отдаёт нужный материал.
 *
 * Скрипт ничего не выбирает. Он приносит кандидатов и метаданные,
 * выбор делается по контактному листу — машиной или человеком.
 *
 *   node scripts/photos/fetch.mjs                 все темы
 *   node scripts/photos/fetch.mjs kontakty ppr    только эти
 *   node scripts/photos/fetch.mjs --per 12        сколько кандидатов на тему
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'photos', 'raw');

/* Лицензии, при которых снимок можно поставить на коммерческий сайт.
   nd — запрет производных, а мы приводим все кадры к одной обработке,
   поэтому nd не берём. */
const OK_LICENSE = new Set(['cc0', 'pdm', 'by', 'by-sa']);
const MIN_WIDTH = 1600;

const args = process.argv.slice(2);
const perIdx = args.indexOf('--per');
const PER = perIdx >= 0 ? Number(args[perIdx + 1]) : 8;
const only = args.filter((a) => !a.startsWith('--') && a !== String(PER));

async function get(url, kind = 'json') {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'propto-photo-fetch/1.0' } });
      if (r.status === 429) throw new Error('429');
      if (!r.ok) throw new Error(String(r.status));
      return kind === 'json' ? await r.json() : Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((res) => setTimeout(res, 2000 * 2 ** attempt));
    }
  }
}

async function openverse(q, n) {
  const u = new URL('https://api.openverse.org/v1/images/');
  u.searchParams.set('q', q);
  u.searchParams.set('license_type', 'commercial,modification');
  u.searchParams.set('size', 'large');
  u.searchParams.set('page_size', String(Math.min(n * 3, 20)));
  const d = await get(u.toString());
  return (d.results || [])
    .filter((r) => (r.width || 0) >= MIN_WIDTH && OK_LICENSE.has((r.license || '').toLowerCase()))
    .map((r) => ({
      url: r.url,
      w: r.width,
      h: r.height,
      title: r.title || '',
      author: r.creator || 'не указан',
      license: `${(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim(),
      licenseUrl: r.license_url || '',
      source: r.foreign_landing_url || r.url,
      provider: r.provider || 'openverse',
    }));
}

async function commons(q, n) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  u.searchParams.set('action', 'query');
  u.searchParams.set('format', 'json');
  u.searchParams.set('generator', 'search');
  u.searchParams.set('gsrsearch', `filetype:bitmap ${q}`);
  u.searchParams.set('gsrnamespace', '6');
  u.searchParams.set('gsrlimit', String(Math.min(n * 3, 30)));
  u.searchParams.set('prop', 'imageinfo');
  u.searchParams.set('iiprop', 'url|size|extmetadata');
  u.searchParams.set('iiurlwidth', '2400');
  const d = await get(u.toString());
  const pages = Object.values(d?.query?.pages || {});
  return pages
    .map((p) => p.imageinfo?.[0])
    .filter(Boolean)
    .filter((i) => (i.width || 0) >= MIN_WIDTH)
    .map((i) => ({
      url: i.thumburl || i.url,
      w: i.width,
      h: i.height,
      title: i.extmetadata?.ObjectName?.value || '',
      author: (i.extmetadata?.Artist?.value || 'не указан').replace(/<[^>]+>/g, '').trim(),
      license: i.extmetadata?.LicenseShortName?.value || '',
      licenseUrl: i.extmetadata?.LicenseUrl?.value || '',
      source: i.descriptionurl || i.url,
      provider: 'wikimedia',
    }))
    .filter((c) => /cc0|public domain|cc by/i.test(c.license));
}

const seen = new Set();

async function theme(t) {
  const dir = join(RAW, t.id);
  await mkdir(dir, { recursive: true });
  const found = [];

  for (const q of t.queries) {
    if (found.length >= PER) break;
    for (const search of [openverse, commons]) {
      if (found.length >= PER) break;
      let batch = [];
      try {
        batch = await search(q, PER);
      } catch (e) {
        console.warn(`  ${t.id}: ${search.name} «${q}» — ${e.message}`);
        continue;
      }
      for (const c of batch) {
        if (found.length >= PER) break;
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        found.push({ ...c, query: q });
      }
    }
  }

  const saved = [];
  for (const [i, c] of found.entries()) {
    const name = `${String(i + 1).padStart(2, '0')}.jpg`;
    try {
      const buf = await get(c.url, 'bin');
      await writeFile(join(dir, name), buf);
      saved.push({ file: name, bytes: buf.length, ...c });
    } catch (e) {
      console.warn(`  ${t.id}/${name}: не скачался — ${e.message}`);
    }
  }

  await writeFile(join(dir, 'candidates.json'), JSON.stringify(saved, null, 2));
  console.log(`${t.id}: ${saved.length} кандидатов`);
  return saved.length;
}

const cfg = JSON.parse(await readFile(join(ROOT, 'photos', 'themes.json'), 'utf8'));
const list = only.length ? cfg.themes.filter((t) => only.includes(t.id)) : cfg.themes;

let total = 0;
for (const t of list) total += await theme(t);

console.log(`\nВсего кандидатов: ${total} по ${list.length} темам.`);
console.log('Дальше: node scripts/photos/sheet.mjs — контактный лист для выбора.');
