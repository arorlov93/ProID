/**
 * Разбор поисковой и «машинной» оптимизации по готовой сборке.
 *
 * Отдельно от audit.mjs: тот проверяет, что сайт работает, этот — что его
 * правильно понимают поисковые роботы и языковые модели. Работает по файлам
 * в dist/, браузер не нужен — всё, что важно роботу, обязано быть в исходном
 * HTML (раздел 4 ТЗ).
 *
 * Запуск: npm run build && node scripts/seo.mjs
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST = 'dist';
const out = [];
const log = (s = '') => (out.push(s), console.log(s));
const problems = [];
const flag = (page, msg) => problems.push(`${page}: ${msg}`);

async function walk(dir) {
  const res = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) res.push(...(await walk(p)));
    else res.push(p);
  }
  return res;
}

const files = (await walk(DIST)).filter((f) => f.endsWith('.html'));
const urlOf = (f) => '/' + relative(DIST, f).replace(/\.html$/, '').replace(/(^|\/)index$/, '') || '/';

/* Разбор без парсера: нам нужны считаные вещи, и все они однозначны в разметке,
   которую генерирует сборка. Тянуть jsdom ради этого — лишняя зависимость. */
const pick = (html, re, g = 1) => (html.match(re)?.[g] ?? '').trim();
const all = (html, re) => [...html.matchAll(re)];
const strip = (s) =>
  s
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;| /g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const pages = [];
for (const f of files) {
  const html = await readFile(f, 'utf8');
  const url = urlOf(f);
  const ld = all(html, /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)
    .map(([, j]) => {
      try {
        return JSON.parse(j);
      } catch {
        flag(url, 'JSON-LD не разбирается');
        return null;
      }
    })
    .filter(Boolean);
  const types = ld.flatMap((b) => (b['@graph'] ?? [b]).map((n) => n['@type'])).flat();
  pages.push({
    url,
    file: f,
    html,
    size: html.length,
    title: pick(html, /<title>([\s\S]*?)<\/title>/),
    desc: pick(html, /<meta name="description" content="([^"]*)"/),
    canonical: pick(html, /<link rel="canonical" href="([^"]*)"/),
    robots: pick(html, /<meta name="robots" content="([^"]*)"/),
    lang: pick(html, /<html[^>]*lang="([^"]*)"/),
    ogImage: pick(html, /<meta property="og:image" content="([^"]*)"/),
    h1: all(html, /<h1[^>]*>([\s\S]*?)<\/h1>/g).map(([, t]) => strip(t)),
    heads: all(html, /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g).map(([, l, t]) => ({ l: +l, t: strip(t) })),
    words: strip(html.replace(/[\s\S]*?<main[^>]*>/, '').replace(/<\/main>[\s\S]*/, '')).split(' ').length,
    ld,
    types,
    imgs: all(html, /<img\b[^>]*>/g).map(([t]) => t),
    links: all(html, /href="(\/[^"#?]*)"/g).map(([, h]) => h.replace(/\/$/, '') || '/'),
  });
}

log(`Страниц в сборке: ${pages.length}\n`);

/* ── 1. Метатеги ──────────────────────────────────────────────────────────── */
log('=== 1. Заголовки и описания ===');
{
  const t = pages.map((p) => p.title.length);
  const d = pages.map((p) => p.desc.length);
  const longT = pages.filter((p) => p.title.length > 65);
  const shortT = pages.filter((p) => p.title.length < 30);
  const badD = pages.filter((p) => p.desc.length < 120 || p.desc.length > 165);
  log(`  title: ${Math.min(...t)}–${Math.max(...t)} знаков, за 65 вышло ${longT.length}, короче 30 — ${shortT.length}`);
  log(`  description: ${Math.min(...d)}–${Math.max(...d)} знаков, вне 120–165 — ${badD.length}`);
  [...longT, ...shortT, ...badD].forEach((p) => flag(p.url, `title ${p.title.length}, description ${p.desc.length}`));
  const dупли = new Set();
  for (const key of ['title', 'desc']) {
    const seen = new Map();
    for (const p of pages) {
      if (seen.has(p[key])) {
        flag(p.url, `${key} совпадает с ${seen.get(p[key])}`);
        dупли.add(p.url);
      }
      seen.set(p[key], p.url);
    }
  }
  log(`  дублей: ${dупли.size}`);
}

/* ── 2. Заголовки страницы ────────────────────────────────────────────────── */
log('\n=== 2. Иерархия заголовков ===');
{
  let noH1 = 0;
  let manyH1 = 0;
  let skips = 0;
  for (const p of pages) {
    if (p.h1.length === 0) (noH1++, flag(p.url, 'нет h1'));
    if (p.h1.length > 1) (manyH1++, flag(p.url, `h1 ${p.h1.length} штук`));
    let prev = 0;
    for (const h of p.heads) {
      if (prev && h.l > prev + 1) (skips++, flag(p.url, `пропуск уровня h${prev} → h${h.l}: «${h.t.slice(0, 40)}»`));
      prev = h.l;
    }
  }
  log(`  без h1: ${noH1}, с несколькими h1: ${manyH1}, пропусков уровня: ${skips}`);
  log(`  заголовков на странице: ${Math.min(...pages.map((p) => p.heads.length))}–${Math.max(...pages.map((p) => p.heads.length))}`);
}

/* ── 3. Канонические адреса и индексация ──────────────────────────────────── */
log('\n=== 3. Канонические адреса, robots, язык ===');
{
  let bad = 0;
  for (const p of pages) {
    const expect = p.url === '/' ? '/' : p.url;
    if (!p.canonical.endsWith(expect)) (bad++, flag(p.url, `canonical «${p.canonical}»`));
    if (!p.canonical.startsWith('https://')) (bad++, flag(p.url, 'canonical не абсолютный'));
    if (p.lang !== 'ru') flag(p.url, `lang="${p.lang}"`);
  }
  const noindex = pages.filter((p) => p.robots.includes('noindex')).map((p) => p.url);
  log(`  canonical некорректных: ${bad}`);
  log(`  закрыто от индексации: ${noindex.length ? noindex.join(', ') : 'нет'}`);
  log(`  max-image-preview:large: ${pages.filter((p) => p.robots.includes('max-image-preview:large')).length} из ${pages.length}`);
}

/* ── 4. Микроразметка ─────────────────────────────────────────────────────── */
log('\n=== 4. Микроразметка ===');
{
  const count = {};
  for (const p of pages) for (const t of p.types) count[t] = (count[t] ?? 0) + 1;
  log('  ' + Object.entries(count).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}×${n}`).join(', '));

  // Уникальность @id внутри страницы
  for (const p of pages) {
    const ids = p.ld.flatMap((b) => (b['@graph'] ?? [b]).map((n) => n['@id']).filter(Boolean));
    const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
    if (dup.length) flag(p.url, `повтор @id: ${[...new Set(dup)].join(', ')}`);
  }

  // На посадочной услуги обязана быть цена в разметке
  const srv = pages.filter((p) => p.types.includes('Service'));
  let noPrice = 0;
  for (const p of srv) {
    const node = p.ld.flatMap((b) => b['@graph'] ?? [b]).find((n) => n['@type'] === 'Service');
    const price = node?.offers?.price ?? node?.offers?.priceSpecification?.price;
    if (price === undefined) (noPrice++, flag(p.url, 'Service без offers.price'));
  }
  log(`  Service с ценой: ${srv.length - noPrice} из ${srv.length}`);
  const withOfferCatalog = pages.filter((p) =>
    p.ld.flatMap((b) => b['@graph'] ?? [b]).some((n) => n.hasOfferCatalog),
  ).length;
  log(`  hasOfferCatalog у организации: ${withOfferCatalog} из ${pages.length}`);
  const webPage = pages.filter((p) => p.types.includes('WebPage')).length;
  log(`  узел WebPage: ${webPage} из ${pages.length}`);
  const speakable = pages.filter((p) => p.html.includes('speakable')).length;
  log(`  speakable: ${speakable} из ${pages.length}`);
}

/* ── 5. Прямой ответ в начале страницы ────────────────────────────────────────
   То, что языковая модель вытащит как ответ: первый абзац после h1. Он должен
   быть самодостаточным — понятным без остального текста и без заголовка. */
log('\n=== 5. Прямой ответ после h1 ===');
{
  let bad = 0;
  for (const p of pages) {
    const after = p.html.split(/<\/h1>/)[1] ?? '';
    const lead = strip((after.match(/<p[^>]*>([\s\S]*?)<\/p>/) ?? [])[1] ?? '');
    if (lead.length < 120 || lead.length > 600) {
      bad++;
      flag(p.url, `первый абзац после h1: ${lead.length} знаков`);
    }
  }
  log(`  вне 120–600 знаков: ${bad} из ${pages.length}`);
}

/* ── 6. Объём и структура текста ──────────────────────────────────────────── */
log('\n=== 6. Объём текста ===');
{
  const sorted = [...pages].sort((a, b) => a.words - b.words);
  log(`  слов в <main>: ${sorted[0].words} (${sorted[0].url}) … ${sorted.at(-1).words} (${sorted.at(-1).url})`);
  const thin = pages.filter((p) => p.words < 300 && !p.robots.includes('noindex'));
  thin.forEach((p) => flag(p.url, `тонкая страница: ${p.words} слов`));
  log(`  тоньше 300 слов: ${thin.length}`);
  const tables = pages.filter((p) => /<table/.test(p.html)).length;
  const lists = pages.filter((p) => /<(ul|ol|dl)\b/.test(p.html)).length;
  log(`  страниц с таблицами: ${tables}, со списками: ${lists}`);
}

/* ── 7. Картинки ──────────────────────────────────────────────────────────── */
log('\n=== 7. Картинки ===');
{
  let total = 0;
  let noAlt = 0;
  let noDim = 0;
  for (const p of pages)
    for (const t of p.imgs) {
      total++;
      if (!/\balt="/.test(t)) (noAlt++, flag(p.url, `img без alt: ${t.slice(0, 60)}`));
      if (!/\bwidth="/.test(t) || !/\bheight="/.test(t)) noDim++;
    }
  const svgLabels = pages.reduce((n, p) => n + all(p.html, /<svg[^>]*role="img"/g).length, 0);
  log(`  <img>: ${total}, без alt: ${noAlt}, без width/height: ${noDim}`);
  log(`  <svg role="img"> с подписью: ${svgLabels}`);
}

/* ── 8. Перелинковка ──────────────────────────────────────────────────────── */
log('\n=== 8. Перелинковка ===');
{
  const known = new Set(pages.map((p) => p.url));
  const inbound = new Map([...known].map((u) => [u, 0]));
  for (const p of pages)
    for (const l of new Set(p.links)) if (known.has(l) && l !== p.url) inbound.set(l, inbound.get(l) + 1);
  const orphans = [...inbound].filter(([u, n]) => n === 0 && u !== '/404');
  orphans.forEach(([u]) => flag(u, 'нет ни одной входящей ссылки'));
  const weak = [...inbound].filter(([u, n]) => n > 0 && n < 3 && u !== '/404');
  log(`  страниц без входящих ссылок: ${orphans.length}`);
  log(`  с одной-двумя входящими: ${weak.length}${weak.length ? ' → ' + weak.map(([u, n]) => `${u} (${n})`).join(', ') : ''}`);
  const perPage = pages.map((p) => new Set(p.links.filter((l) => known.has(l))).size);
  log(`  исходящих внутренних на странице: ${Math.min(...perPage)}–${Math.max(...perPage)}`);
}

/* ── 9. robots.txt, sitemap, llms.txt ─────────────────────────────────────── */
log('\n=== 9. Файлы для роботов ===');
{
  const robots = await readFile(join(DIST, 'robots.txt'), 'utf8').catch(() => '');
  log(`  robots.txt: ${robots ? 'есть' : 'НЕТ'}`);

  /* Справочный режим: сборка закрыта от индексации намеренно (production
     в src/data/site.ts). Требовать от неё Host, Sitemap и разрешений для
     роботов бессмысленно — проверяем ровно обратное. */
  const closed = /^\s*Disallow:\s*\/\s*$/m.test(robots) && !/Allow:/.test(robots);
  if (closed) {
    log('  режим: справочная сборка, индексация закрыта целиком');
    const open = pages.filter((p) => !p.robots.includes('noindex'));
    log(`  страниц без noindex: ${open.length} (должно быть 0)`);
    open.forEach((p) => flag(p.url, 'открыта для индексации в справочной сборке'));
  } else {
    for (const need of ['Sitemap:', 'Host:', 'Clean-param:']) {
      if (!robots.includes(need)) flag('robots.txt', `нет строки ${need}`);
    }
    const ai = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'YandexAdditional'];
    const known = ai.filter((b) => robots.includes(b));
    log(`  явно названо роботов языковых моделей: ${known.length} из ${ai.length}${known.length ? ' — ' + known.join(', ') : ''}`);
    if (!known.length) flag('robots.txt', 'роботы языковых моделей не названы — ни разрешены, ни запрещены явно');
  }

  const sm = await readFile(join(DIST, 'sitemap-0.xml'), 'utf8').catch(() => '');
  const inSitemap = new Set(all(sm, /<loc>([^<]+)<\/loc>/g).map(([, u]) => new URL(u).pathname.replace(/\/$/, '') || '/'));
  const missing = closed ? [] : pages.filter((p) => !inSitemap.has(p.url) && !p.robots.includes('noindex'));
  log(`  в sitemap: ${inSitemap.size} адресов, не попало страниц: ${missing.length}`);
  missing.forEach((p) => flag(p.url, 'нет в sitemap'));
  log(`  lastmod в sitemap: ${/lastmod/.test(sm) ? 'есть' : 'НЕТ'}`);
  if (!/lastmod/.test(sm)) flag('sitemap', 'нет lastmod — роботу нечем оценить свежесть');

  const llms = await stat(join(DIST, 'llms.txt')).catch(() => null);
  log(`  llms.txt: ${llms ? `есть, ${(llms.size / 1024).toFixed(1)} КБ` : 'НЕТ'}`);
  if (!llms) flag('llms.txt', 'нет карты сайта для языковых моделей');
}

/* ── Итог ─────────────────────────────────────────────────────────────────── */
log('\n=== Замечания ===');
if (!problems.length) log('  нет');
else problems.forEach((p) => log('  • ' + p));
log(`\nВсего замечаний: ${problems.length}`);
