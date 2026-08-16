/**
 * Три проверки, которые нельзя сделать по исходникам: узкий экран, работа без
 * JavaScript и режим уменьшенного движения. Числа идут в REPORT.md.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4321';
const CHROME = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const PAGES = [
  '/', '/oformlenie-id', '/vedenie-id', '/vosstanovlenie-id', '/autsorsing-pto', '/ppr',
  '/smety', '/audit-komplekta', '/uslugi', '/ceny', '/obekty', '/obekty/dom-pravosudiya',
  '/o-kompanii', '/blog', '/blog/prichiny-vozvrata-id', '/kontakty', '/checklist', '/privacy', '/404',
];

const browser = await chromium.launch({ executablePath: CHROME });

/* ── Ширина 320 px ────────────────────────────────────────────────────────── */
console.log('\n=== Ширина 320 px: горизонтальный скролл ===');
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  let bad = 0;
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.5) {
        scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 40)));
      }
      scrollTo({ top: 0, behavior: 'instant' });
    });
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (over > 1) {
      bad++;
      console.log(`  ПЕРЕПОЛНЕНИЕ ${p}: +${over}px`);
    }
  }
  console.log(`  проверено ${PAGES.length} страниц, с горизонтальным скроллом: ${bad}`);
  await ctx.close();
}

/* ── Размер кликабельных областей ─────────────────────────────────────────── */
console.log('\n=== Кликабельные области на мобильных (минимум 44×44) ===');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  let small = 0;
  let total = 0;
  for (const p of ['/', '/ceny', '/kontakty', '/blog/prichiny-vozvrata-id']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    const res = await page.evaluate(() => {
      const bad = [];
      let n = 0;
      document.querySelectorAll('a[href], button, input, select, summary').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        // Ссылки внутри строки текста — исключение WCAG 2.5.8: цель задаёт строка.
        if (el.tagName === 'A' && el.closest('p, li, .prose, label, figcaption')) return;
        n++;
        // Флажок внутри ярлыка: нажатие срабатывает по всему ярлыку,
        // поэтому меряем его, а не сам квадратик 20×20.
        const target = el.type === 'checkbox' && el.closest('label') ? el.closest('label') : el;
        const tr = target.getBoundingClientRect();
        if (tr.height < 44 - 0.5)
          bad.push(`${el.tagName} ${Math.round(tr.width)}×${Math.round(tr.height)} «${(el.textContent || '').trim().slice(0, 24)}»`);
      });
      return { n, bad };
    });
    total += res.n;
    small += res.bad.length;
    res.bad.slice(0, 5).forEach((b) => console.log(`  ${p}: ${b}`));
  }
  console.log(`  проверено ${total} элементов, ниже 44 px по высоте: ${small}`);
  await ctx.close();
}

/* ── Без JavaScript ───────────────────────────────────────────────────────── */
console.log('\n=== Без JavaScript ===');
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let hidden = 0;
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    const res = await page.evaluate(() => {
      let invisible = 0;
      let chars = 0;
      document.querySelectorAll('[data-reveal]').forEach((el) => {
        const cs = getComputedStyle(el);
        if (parseFloat(cs.opacity) < 0.9) invisible++;
      });
      document.querySelectorAll('main p, main li, main h1, main h2, main h3').forEach((el) => {
        chars += (el.textContent || '').trim().length;
      });
      return { invisible, chars, drawn: document.querySelectorAll('[data-draw]').length };
    });
    if (res.invisible) {
      hidden++;
      console.log(`  СКРЫТО без JS: ${p} — ${res.invisible} блоков`);
    }
    if (p === '/' || p === '/ceny') console.log(`  ${p}: видимого текста ${res.chars} знаков, чертежей ${res.drawn}`);
  }
  console.log(`  страниц со скрытым контентом без JS: ${hidden} из ${PAGES.length}`);
  await ctx.close();
}

/* ── Уменьшенное движение ─────────────────────────────────────────────────── */
console.log('\n=== prefers-reduced-motion: reduce ===');
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const res = await page.evaluate(() => {
    let animated = 0;
    let transitioned = 0;
    let revealHidden = 0;
    document.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      const dur = (s) => s.split(',').reduce((m, x) => Math.max(m, parseFloat(x) || 0), 0);
      if (cs.animationName !== 'none' && dur(cs.animationDuration) > 0.01) animated++;
      if (dur(cs.transitionDuration) > 0.01) transitioned++;
    });
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      if (parseFloat(getComputedStyle(el).opacity) < 0.9) revealHidden++;
    });
    return { animated, transitioned, revealHidden };
  });
  console.log(`  элементов с активной анимацией: ${res.animated}`);
  console.log(`  элементов с переходом дольше 10 мс: ${res.transitioned}`);
  console.log(`  скрытых блоков появления: ${res.revealHidden}`);
  await ctx.close();
}

await browser.close();
console.log('\n— конец —');
