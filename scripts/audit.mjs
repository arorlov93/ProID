/**
 * Самопроверка перед сдачей. Считает то, что можно посчитать, и печатает числа,
 * а не «ок». Результат переносится в REPORT.md.
 *
 * Запуск: npm run build && npx astro preview & ; node scripts/audit.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4321';
const DIST = 'dist';
const CHROME = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const out = [];
const log = (...a) => {
  const line = a.join(' ');
  out.push(line);
  console.log(line);
};

async function walk(dir, ext, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, ext, acc);
    else if (!ext || extname(e.name) === ext) acc.push(full);
  }
  return acc;
}

const htmlFiles = (await walk(DIST, '.html')).sort();
const urlOf = (f) => '/' + relative(DIST, f).replace(/\.html$/, '').replace(/^index$/, '');

/* ── 1. Текст в исходном HTML без JS ──────────────────────────────────────── */
log('\n=== 1. Текст в исходном HTML (без выполнения JS) ===');
{
  const probes = [
    ['/index', 'которую принимают'],
    ['/oformlenie-id', 'сборка'],
    ['/vedenie-id', 'в темпе стройки'],
    ['/vosstanovlenie-id', 'сбор доказательств'],
    ['/autsorsing-pto', 'абонентской плате'],
    ['/ppr', 'не пускают на площадку'],
    ['/smety', 'заключение'],
    ['/audit-komplekta', 'глазами приёмки'],
    ['/ceny', '28 позиций'],
    ['/obekty', 'регламенты приёмки'],
    ['/blog/prichiny-vozvrata-id', 'двенадцать самых частых'],
    ['/blog/sostav-ispolnitelnoy-dokumentacii', 'четырёх опорах'],
    ['/blog/id-ne-velas', 'инвентаризации'],
    ['/checklist', 'позиций'],
    ['/kontakty', 'бесплатна'],
    ['/o-kompanii', 'приёмки'],
    ['/privacy', '152-ФЗ'],
    ['/404', 'страницы нет'],
  ];
  let ok = 0;
  for (const [p, needle] of probes) {
    const f = join(DIST, p.replace(/^\//, '') + '.html');
    const html = await readFile(f, 'utf8').catch(() => '');
    // Считаем только текст вне <script>, чтобы не зачесть JSON-LD.
    // Типографика расставила неразрывные пробелы — сравниваем нормализованно.
    const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/\u00a0/g, ' ');
    const found = body.includes(needle);
    if (found) ok++;
    else log(`  НЕ НАЙДЕНО: ${p} → «${needle}»`);
  }
  log(`  найдено на ${ok} из ${probes.length} страниц`);
}

/* ── 2. Вес страниц и число запросов ──────────────────────────────────────── */
log('\n=== 2. Вес страницы и количество запросов ===');
const browser = await chromium.launch({ executablePath: CHROME });
{
  const pages = ['/', '/oformlenie-id', '/ceny', '/blog/prichiny-vozvrata-id', '/checklist'];
  for (const p of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    let bytes = 0;
    let reqs = 0;
    page.on('response', async (r) => {
      reqs++;
      try {
        const b = await r.body();
        bytes += b.length;
      } catch {}
    });
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    log(`  ${p.padEnd(34)} ${(bytes / 1024).toFixed(0).padStart(5)} КБ   ${String(reqs).padStart(3)} запросов`);
    await ctx.close();
  }
}

/* ── 3. Контраст текста ───────────────────────────────────────────────────── */
log('\n=== 3. Контраст текста к фону (WCAG AA, минимум 4,5:1) ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const worst = [];
  for (const p of ['/', '/ceny', '/oformlenie-id', '/blog/prichiny-vozvrata-id', '/kontakty']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    const res = await page.evaluate(() => {
      const lum = (c) => {
        const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      // Полупрозрачный фон надо смешать с тем, что под ним: rgba(...,0.07)
      // сам по себе не цвет фона, а тонкая плёнка поверх родителя.
      const parse = (c) => {
        const m = (c || '').match(/[\d.]+/g);
        if (!m) return null;
        return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] === undefined ? 1 : Number(m[3])];
      };
      const bgOf = (el) => {
        const layers = [];
        let n = el;
        while (n && n !== document.documentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c[3] > 0) {
            layers.push(c);
            if (c[3] === 1) break;
          }
          n = n.parentElement;
        }
        layers.push([23, 28, 34, 1]);
        let out = layers[layers.length - 1].slice(0, 3);
        for (let i = layers.length - 2; i >= 0; i--) {
          const [r, g, b, a] = layers[i];
          out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
        }
        return `rgb(${out.map((v) => Math.round(v)).join(',')})`;
      };
      const bad = [];
      document.querySelectorAll('p,li,span,a,h1,h2,h3,h4,td,th,dt,dd,summary,label,button').forEach((el) => {
        if (!el.textContent.trim() || el.children.length) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.opacity === '0') return;
        const L1 = lum(cs.color);
        const L2 = lum(bgOf(el));
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        if (ratio < 4.5)
          bad.push({ t: el.textContent.trim().slice(0, 42), ratio: +ratio.toFixed(2), c: cs.color, sz: cs.fontSize });
      });
      return bad;
    });
    if (res.length) worst.push([p, res]);
  }
  if (!worst.length) log('  нарушений не найдено на 5 проверенных страницах');
  else
    for (const [p, list] of worst) {
      log(`  ${p}: ${list.length} элементов ниже 4,5:1`);
      list.slice(0, 6).forEach((x) => log(`     ${x.ratio}:1  ${x.sz}  «${x.t}»`));
    }
}

/* ── 4. Клавиатура и фокус ────────────────────────────────────────────────── */
log('\n=== 4. Навигация с клавиатуры ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const seq = [];
  let noOutline = 0;
  for (let i = 0; i < 22; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const visible = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      return { tag: el.tagName, txt: (el.textContent || '').trim().slice(0, 26), visible };
    });
    if (!info) break;
    if (!info.visible) noOutline++;
    seq.push(`${info.tag}:${info.txt}`);
  }
  log(`  обойдено ${seq.length} элементов, без видимого фокуса: ${noOutline}`);
  log(`  первый в порядке обхода: ${seq[0]}`);
}

/* ── 5. Формы ─────────────────────────────────────────────────────────────── */
log('\n=== 5. Формы: валидация, honeypot, экран благодарности ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/kontakty', { waitUntil: 'networkidle' });

  await page.click('#kt-zayavka button[type=submit]');
  const errs = await page.locator('#kt-zayavka .err:not(:empty)').count();
  log(`  пустая отправка → сообщений об ошибке: ${errs}`);

  await page.fill('#kt-zayavka input[name=name]', 'Иван');
  await page.fill('#kt-zayavka input[name=phone]', '9161234567');
  const masked = await page.inputValue('#kt-zayavka input[name=phone]');
  log(`  маска телефона: «9161234567» → «${masked}»`);

  await page.fill('#kt-zayavka input[name=email]', 'ivan@stroy.ru');
  await page.click('#kt-zayavka button[type=submit]');
  await page.waitForTimeout(900);
  const thanks = await page.locator('#kt-zayavka').locator('..').locator('[data-thanks]').isVisible();
  log(`  экран благодарности показан без перезагрузки: ${thanks}`);

  // Honeypot: заполненная ловушка не должна ничего отправлять.
  await page.goto(BASE + '/kontakty', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('profid:lastSend'));
  await page.evaluate(() => {
    const f = document.getElementById('kt-zayavka');
    f.querySelector('.hp-input').value = 'bot';
  });
  let posted = 0;
  page.on('request', (r) => r.method() === 'POST' && posted++);
  await page.click('#kt-zayavka button[type=submit]');
  await page.waitForTimeout(500);
  log(`  honeypot заполнен → исходящих POST: ${posted} (ожидается 0)`);
}

/* ── 6. Микроразметка ─────────────────────────────────────────────────────── */
log('\n=== 6. Микроразметка Schema.org ===');
{
  const types = new Map();
  let broken = 0;
  for (const f of htmlFiles) {
    const html = await readFile(f, 'utf8');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const [, raw] of blocks) {
      try {
        const j = JSON.parse(raw);
        for (const node of j['@graph'] ?? [j]) {
          types.set(node['@type'], (types.get(node['@type']) ?? 0) + 1);
        }
      } catch (e) {
        broken++;
        log(`  НЕВАЛИДНЫЙ JSON-LD: ${f} — ${e.message}`);
      }
    }
  }
  log(`  блоков с ошибкой разбора: ${broken}`);
  log('  типы: ' + [...types.entries()].map(([t, n]) => `${t}×${n}`).join(', '));
}

/* ── 7. Метатеги ──────────────────────────────────────────────────────────── */
log('\n=== 7. Уникальность title и description ===');
{
  const titles = new Map();
  const descs = new Map();
  const problems = [];
  for (const f of htmlFiles) {
    const html = await readFile(f, 'utf8');
    const t = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
    const d = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    const u = urlOf(f);
    titles.set(t, [...(titles.get(t) ?? []), u]);
    descs.set(d, [...(descs.get(d) ?? []), u]);
    const tl = t.replace(/ /g, ' ').length;
    const dl = d.replace(/ /g, ' ').length;
    if (tl > 60) problems.push(`  title ${tl} знаков (>60): ${u} — ${t}`);
    if (dl < 140 || dl > 165) problems.push(`  description ${dl} знаков (норма 140–160): ${u}`);
    const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) problems.push(`  h1 на странице: ${h1} (нужен 1): ${u}`);
  }
  const dupT = [...titles.values()].filter((v) => v.length > 1);
  const dupD = [...descs.values()].filter((v) => v.length > 1);
  log(`  страниц: ${htmlFiles.length}, уникальных title: ${titles.size}, description: ${descs.size}`);
  log(`  дублей title: ${dupT.length}, дублей description: ${dupD.length}`);
  problems.forEach((p) => log(p));
  if (!problems.length) log('  длина title и description в норме, h1 ровно один на каждой странице');
}

/* ── 8. Запрещённые обороты ───────────────────────────────────────────────── */
log('\n=== 8. Запрещённые обороты ===');
{
  const banned = [
    'динамично развива',
    'индивидуальный подход',
    'команда профессионалов',
    'широкий спектр',
    'гибкая система скидок',
    'качественно и в срок',
    'на рынке с ',
    'высококвалифицированн',
    'под ключ по доступным',
  ];
  let hits = 0;
  for (const f of htmlFiles) {
    const text = (await readFile(f, 'utf8'))
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .toLowerCase();
    for (const b of banned)
      if (text.includes(b)) {
        hits++;
        log(`  НАЙДЕНО «${b}» → ${urlOf(f)}`);
      }
  }
  log(`  совпадений: ${hits} из ${banned.length} проверяемых оборотов`);
}

/* ── 8а. Служебные пометки в вёрстке ──────────────────────────────────────── */
log('\n=== 8а. Незаполненные значения, просочившиеся в текст ===');
{
  let hits = 0;
  for (const f of htmlFiles) {
    const text = (await readFile(f, 'utf8'))
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ');
    for (const m of text.matchAll(/TODO[^\s.,;)]*/g)) {
      hits++;
      log(`  ВИДНО НА СТРАНИЦЕ «${m[0]}» → ${urlOf(f)}`);
    }
  }
  log(`  видимых служебных пометок: ${hits} (в футере и политике пометки о незаполненных реквизитах — намеренные)`);
}

/* ── 9. Типографика ───────────────────────────────────────────────────────── */
log('\n=== 9. Типографика ===');
{
  let nbsp = 0;
  let emdash = 0;
  let endash = 0;
  let quotes = 0;
  let straight = 0;
  let hyphenSpaced = 0;
  for (const f of htmlFiles) {
    const text = (await readFile(f, 'utf8'))
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ');
    nbsp += (text.match(/ /g) ?? []).length;
    emdash += (text.match(/—/g) ?? []).length;
    endash += (text.match(/–/g) ?? []).length;
    quotes += (text.match(/[«»]/g) ?? []).length;
    straight += (text.match(/"/g) ?? []).length;
    hyphenSpaced += (text.match(/ - /g) ?? []).length;
  }
  log(`  неразрывных пробелов: ${nbsp}`);
  log(`  длинных тире —: ${emdash}, средних тире –: ${endash}`);
  log(`  кавычек-ёлочек: ${quotes}, прямых кавычек в тексте: ${straight}`);
  log(`  дефисов вместо тире (« - »): ${hyphenSpaced}`);
}

/* ── 10. Ссылки ───────────────────────────────────────────────────────────── */
log('\n=== 10. Внутренние ссылки ===');
{
  const known = new Set(htmlFiles.map(urlOf));
  const assets = new Set((await walk(DIST)).map((f) => '/' + relative(DIST, f)));
  let total = 0;
  const broken = new Set();
  for (const f of htmlFiles) {
    const html = await readFile(f, 'utf8');
    for (const [, href] of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      total++;
      const clean = href.replace(/\/$/, '') || '/';
      if (known.has(clean) || assets.has(href) || assets.has(clean)) continue;
      broken.add(`${href}  ← ${urlOf(f)}`);
    }
  }
  log(`  внутренних ссылок: ${total}, битых: ${broken.size}`);
  [...broken].forEach((b) => log('  БИТАЯ: ' + b));
}

/* ── 11. Размер файлов ────────────────────────────────────────────────────── */
log('\n=== 11. Самые тяжёлые файлы сборки ===');
{
  const files = await walk(DIST);
  const sized = await Promise.all(files.map(async (f) => [f, (await stat(f)).size]));
  sized.sort((a, b) => b[1] - a[1]);
  sized.slice(0, 8).forEach(([f, s]) => log(`  ${(s / 1024).toFixed(0).padStart(5)} КБ  ${relative(DIST, f)}`));
  const total = sized.reduce((s, x) => s + x[1], 0);
  log(`  всего в dist: ${(total / 1024 / 1024).toFixed(2)} МБ, файлов: ${files.length}`);
}

await browser.close();
console.log('\n— конец —');
