// Повьюпортные скриншоты (без артефактов full-page), проверка og:image, hreflang, DMARC, Lighthouse mobile.
import { chromium, devices } from 'playwright';
import fs from 'fs';
import { execSync } from 'child_process';
const BASE = process.argv[2];
const OUT = 'audit'; const V = `${OUT}/views`;
fs.mkdirSync(V, { recursive: true });
const origin = new URL(BASE).origin;
const sh = c => { try { return execSync(c, {encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']}).trim(); } catch(e){ return 'ERR '+String(e.message).slice(0,200);} };

const R = { ranAt: new Date().toISOString(), assets: {}, hreflang: {}, dns: {}, views: [] };
R.dns.dmarc = sh(`dig +short TXT _dmarc.${new URL(BASE).host}`);
R.dns.dkim  = sh(`dig +short TXT google._domainkey.${new URL(BASE).host}`);

const PAGES = ['/', '/services', '/supply', '/contact', '/building-materials', '/fr'];
for (const p of PAGES) {
  try { const r = await fetch(origin + p); const h = r.ok ? await r.text() : '';
    R.hreflang[p] = { status: r.status,
      links: [...h.matchAll(/<link[^>]+hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["']/gi)].map(m => `${m[1]} -> ${m[2]}`),
      preload: [...h.matchAll(/<link[^>]+rel=["']preload["'][^>]*>/gi)].map(m=>m[0].slice(0,140)).slice(0,5),
      icon: [...h.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi)].map(m=>m[0].slice(0,160)),
      htmlBytes: h.length };
  } catch (e) { R.hreflang[p] = { error: String(e.message) }; }
}
for (const a of ['/media/port-noir.jpg','/media/port-noir.webp','/media/robots-wide.jpg','/media/miami-bay.jpg','/media/pipe.jpg','/media/machinery.jpg','/favicon.svg','/favicon.png','/apple-touch-icon.png','/site.webmanifest']) {
  try { const r = await fetch(origin + a, { method: 'GET' });
    R.assets[a] = { status: r.status, type: r.headers.get('content-type'), kb: Math.round((+(r.headers.get('content-length')||0))/1024) || null };
  } catch (e) { R.assets[a] = { error: String(e.message) }; }
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
async function shots(url, tag, ctxOpts, maxShots) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(()=>{});
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}
  await page.waitForTimeout(1500);
  const vh = ctxOpts.viewport.height;
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const n = Math.min(maxShots, Math.max(1, Math.ceil(total / vh)));
  const info = { url, tag, totalHeight: total, viewport: ctxOpts.viewport, shots: [] };
  for (let i = 0; i < n; i++) {
    await page.evaluate(y => window.scrollTo(0, y), i * vh);
    await page.waitForTimeout(1100);
    const f = `${V}/${tag}-${String(i).padStart(2,'0')}.jpg`;
    await page.screenshot({ path: f, type: 'jpeg', quality: 78 }).catch(()=>{});
    info.shots.push(f);
  }
  // палитра и типографика
  info.design = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const sample = [...document.querySelectorAll('h1,h2,h3,p,a,button')].slice(0, 60).map(e => {
      const s = getComputedStyle(e);
      return `${e.tagName} ${s.fontFamily.split(',')[0]} ${s.fontSize}/${s.lineHeight} w${s.fontWeight} ${s.color}`;
    });
    return { bodyBg: cs.backgroundColor, bodyColor: cs.color, bodyFont: cs.fontFamily, bodySize: cs.fontSize,
      uniq: [...new Set(sample)].slice(0, 25),
      maxWidths: [...new Set([...document.querySelectorAll('section,main,div')].slice(0,200)
        .map(e => getComputedStyle(e).maxWidth).filter(v => v !== 'none'))].slice(0, 8) };
  }).catch(()=>null);
  await ctx.close();
  return info;
}
const D = { viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' };
R.views.push(await shots(BASE, 'home-d', D, 8));
R.views.push(await shots(BASE + '/services', 'services-d', D, 5));
R.views.push(await shots(BASE + '/contact', 'contact-d', D, 4));
R.views.push(await shots(BASE, 'home-m', { ...devices['iPhone 13'] }, 8));
await browser.close();

sh(`CHROME_PATH=$(which google-chrome) npx --yes lighthouse@12.2.1 "${BASE}" --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate --output=json --output-path=${OUT}/lh-m.json --quiet --chrome-flags="--headless=new --no-sandbox --disable-gpu" --only-categories=performance,accessibility,best-practices,seo --max-wait-for-load=60000`);
try {
  const j = JSON.parse(fs.readFileSync(`${OUT}/lh-m.json`, 'utf8')); const a = j.audits || {};
  const pick = k => a[k] ? { score: a[k].score, value: a[k].displayValue } : null;
  R.lighthouseMobile = { scores: Object.fromEntries(Object.entries(j.categories||{}).map(([k,v])=>[k,Math.round((v.score||0)*100)])),
    metrics: { fcp: pick('first-contentful-paint'), lcp: pick('largest-contentful-paint'), tbt: pick('total-blocking-time'),
               cls: pick('cumulative-layout-shift'), si: pick('speed-index'), ttfb: pick('server-response-time') },
    weight: pick('total-byte-weight'),
    opportunities: Object.values(a).filter(x=>x&&x.details?.type==='opportunity'&&x.score!==null&&x.score<0.9).map(x=>({id:x.id,title:x.title,savings:x.displayValue})).slice(0,15),
    failed: Object.values(a).filter(x=>x&&x.score!==null&&x.score<1&&x.scoreDisplayMode==='binary').map(x=>({id:x.id,title:x.title,items:x.details?.items?.length||0})).slice(0,30) };
  fs.unlinkSync(`${OUT}/lh-m.json`);
} catch (e) { R.lighthouseMobile = { error: String(e.message).slice(0,300) }; }

fs.writeFileSync(`${OUT}/visual-report.json`, JSON.stringify(R, null, 1));
console.log(JSON.stringify({ assets: R.assets, hreflang: R.hreflang, dns: R.dns, lh: R.lighthouseMobile?.scores, heights: R.views.map(v=>[v.tag,v.totalHeight]) }, null, 1));
