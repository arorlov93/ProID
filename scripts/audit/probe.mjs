// Точечная диагностика: почему поля формы не видны; рендер без JS; reduced-motion.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2];
const OUT = 'audit'; fs.mkdirSync(`${OUT}/probe`, { recursive: true });
const R = {};
const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function styles(url, formSel, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(()=>{});
  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
  await page.evaluate(sel => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), formSel);
  await page.waitForTimeout(2000);
  const d = await page.evaluate(sel => {
    const f = document.querySelector(sel); if (!f) return { missing: true };
    const g = e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect();
      return { tag: e.tagName, id: e.id, color: s.color, bg: s.backgroundColor, border: s.border,
               borderBottom: s.borderBottom, opacity: s.opacity, visibility: s.visibility,
               fontSize: s.fontSize, box: `${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}`,
               zIndex: s.zIndex, position: s.position }; };
    const fs_ = getComputedStyle(f); const fr = f.getBoundingClientRect();
    // что за элемент лежит под центром поля
    const first = f.querySelector('input,textarea,select');
    let behind = null;
    if (first) { const r = first.getBoundingClientRect();
      behind = document.elementsFromPoint(r.left + r.width/2, r.top + r.height/2)
        .slice(0,6).map(e => `${e.tagName}.${(e.className||'').toString().slice(0,30)}`); }
    return {
      form: { opacity: fs_.opacity, transform: fs_.transform, bg: fs_.backgroundColor, visibility: fs_.visibility,
              box: `${Math.round(fr.width)}x${Math.round(fr.height)} @${Math.round(fr.left)},${Math.round(fr.top)}`,
              classes: f.className, zIndex: fs_.zIndex, position: fs_.position, backdrop: fs_.backdropFilter },
      labels: [...f.querySelectorAll('label')].slice(0,4).map(g),
      fields: [...f.querySelectorAll('input,textarea,select')].slice(0,4).map(g),
      button: [...f.querySelectorAll('button')].map(g),
      behindFirstField: behind,
      parentChain: (() => { const out = []; let e = f.parentElement;
        for (let i=0;i<4 && e;i++){ const s=getComputedStyle(e);
          out.push(`${e.tagName}.${(e.className||'').toString().slice(0,26)} op=${s.opacity} bg=${s.backgroundColor} pos=${s.position}`); e=e.parentElement; }
        return out; })()
    };
  }, formSel);
  await page.screenshot({ path: `${OUT}/probe/${tag}-inview.jpg`, type: 'jpeg', quality: 85 });
  await ctx.close();
  return d;
}

R.contactForm = await styles(BASE + '/contact', '#cf', 'contact');
R.homeForm    = await styles(BASE, '#rq', 'home');

// рендер без JavaScript
const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
for (const [p, tag] of [['/', 'nojs-home'], ['/contact', 'nojs-contact']]) {
  const pg = await noJs.newPage();
  await pg.goto(BASE + p, { waitUntil: 'load', timeout: 45000 }).catch(()=>{});
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${OUT}/probe/${tag}.jpg`, type: 'jpeg', quality: 80 });
  R[tag] = await pg.evaluate(() => {
    const vis = [...document.querySelectorAll('.content, [data-reveal], .fade')]
      .map(e => ({ cls: (e.className||'').toString().slice(0,40), op: getComputedStyle(e).opacity, h: Math.round(e.getBoundingClientRect().height) }));
    return { hiddenByOpacity: vis.filter(v => parseFloat(v.op) < 0.5).length, totalRevealEls: vis.length,
             sample: vis.slice(0, 8), docHeight: document.documentElement.scrollHeight };
  });
  await pg.close();
}
await noJs.close();

// reduced motion
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const pg = await rm.newPage();
await pg.goto(BASE, { waitUntil: 'load', timeout: 45000 }).catch(()=>{});
await pg.waitForTimeout(2000);
await pg.screenshot({ path: `${OUT}/probe/reduced-motion-home.jpg`, type: 'jpeg', quality: 80 });
R.reducedMotion = await pg.evaluate(() => ({ docHeight: document.documentElement.scrollHeight }));
await rm.close();


// мобильная версия страницы контактов
{
  const mctx = await browser.newContext({ ...(await import('playwright')).devices['iPhone 13'] });
  const mp = await mctx.newPage();
  await mp.goto(BASE + '/contact', { waitUntil: 'load', timeout: 45000 }).catch(()=>{});
  try { await mp.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
  await mp.evaluate(() => document.querySelector('#cf')?.scrollIntoView({ block: 'center' }));
  await mp.waitForTimeout(2000);
  await mp.screenshot({ path: `${OUT}/probe/contact-mobile-form.jpg`, type: 'jpeg', quality: 85 });
  R.contactMobile = await mp.evaluate(() => {
    const f = document.querySelector('#cf'); if (!f) return { missing: true };
    const i = f.querySelector('input'); const r = i.getBoundingClientRect();
    return { formBox: (() => { const b = f.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)} @${Math.round(b.left)},${Math.round(b.top)}`; })(),
      behindFirstField: document.elementsFromPoint(r.left + r.width/2, r.top + r.height/2).slice(0,6).map(e => `${e.tagName}.${(e.className||'').toString().slice(0,30)}`),
      navLinksInHeader: document.querySelectorAll('header nav a, .nav a').length };
  });
  await mctx.close();
}
// есть ли навигация в шапке на мобильной главной
{
  const mctx = await browser.newContext({ ...(await import('playwright')).devices['iPhone 13'] });
  const mp = await mctx.newPage();
  await mp.goto(BASE, { waitUntil: 'load', timeout: 45000 }).catch(()=>{});
  await mp.waitForTimeout(1800);
  R.homeMobileNav = await mp.evaluate(() => {
    const hdr = document.querySelector('header') || document.body;
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0'; };
    return { headerLinks: [...hdr.querySelectorAll('a,button')].filter(vis).map(e => (e.textContent||'').replace(/\s+/g,' ').trim() || `[${e.tagName}]`).slice(0,15),
             hasHamburger: !!document.querySelector('[class*=burger],[class*=menu-toggle],[aria-label*=enu],[class*=navtoggle]') };
  });
  await mctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/probe-report.json`, JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
