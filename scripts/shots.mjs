/**
 * Скриншоты всех страниц: десктоп 1440 и мобильный 390 (плюс 320 по флагу).
 * Запуск: npm run build && npx astro preview & ; node scripts/shots.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = process.env.OUT || 'shots';
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const full = !process.argv.includes('--viewport');
const narrow = process.argv.includes('--320');

const PAGES = [
  ['index', '/'],
  ['oformlenie-id', '/oformlenie-id'],
  ['vedenie-id', '/vedenie-id'],
  ['vosstanovlenie-id', '/vosstanovlenie-id'],
  ['autsorsing-pto', '/autsorsing-pto'],
  ['ppr', '/ppr'],
  ['smety', '/smety'],
  ['audit-komplekta', '/audit-komplekta'],
  ['uslugi', '/uslugi'],
  ['ceny', '/ceny'],
  ['obekty', '/obekty'],
  ['obekt-dom-pravosudiya', '/obekty/dom-pravosudiya'],
  ['o-kompanii', '/o-kompanii'],
  ['blog', '/blog'],
  ['blog-prichiny', '/blog/prichiny-vozvrata-id'],
  ['kontakty', '/kontakty'],
  ['checklist', '/checklist'],
  ['privacy', '/privacy'],
  ['404', '/404'],
];

const VIEWPORTS = [
  ['1440', 1440, 900],
  ['390', 390, 844],
  ...(narrow ? [['320', 320, 720]] : []),
];

await mkdir(OUT, { recursive: true });
// Браузер уже стоит в образе; версия пакета и версия сборки могут не совпадать,
// поэтому указываем бинарник напрямую вместо playwright install.
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const list = only.length ? PAGES.filter(([n]) => only.some((o) => n.includes(o))) : PAGES;
const problems = [];

for (const [vname, w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    isMobile: w < 700,
    hasTouch: w < 700,
  });
  const page = await ctx.newPage();

  for (const [name, url] of list) {
    const res = await page.goto(BASE + url, { waitUntil: 'networkidle' });
    if (!res || res.status() >= 400) {
      problems.push(`${url} → HTTP ${res?.status()}`);
      continue;
    }
    // Прокрутка до низа, чтобы отработали появление секций и отрисовка чертежей.
    await page.evaluate(async () => {
      // Мелкий шаг: IntersectionObserver отдаёт наблюдения покадрово, и при
      // резких прыжках часть элементов проскакивает мимо, не успев засчитаться.
      const step = innerHeight * 0.5;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 180)));
      }
      scrollTo({ top: 0, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 1400));
    });

    // Горизонтальный скролл — сразу в отчёт.
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (over > 1) problems.push(`${url} @${w}: горизонтальный скролл +${over}px`);

    await page.screenshot({ path: `${OUT}/${name}-${vname}.png`, fullPage: full });
  }
  await ctx.close();
}

await browser.close();
console.log(problems.length ? '\nПРОБЛЕМЫ:\n' + problems.join('\n') : '\nГоризонтального скролла нет.');
