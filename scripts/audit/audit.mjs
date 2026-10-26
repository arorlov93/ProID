// Полный аудит сайта: HTTP/TLS, SEO, контент, доступность, формы, скорость, AI-читаемость.
// Запускается на GitHub Actions runner (открытый интернет). node audit.mjs <url> [maxPages]
import { chromium, devices } from 'playwright';
import fs from 'fs';
import { execSync } from 'child_process';

const BASE = process.argv[2];
const MAX  = Number(process.argv[3] || 25);
const OUT  = 'audit';
const SHOT = `${OUT}/shots`;
fs.mkdirSync(SHOT, { recursive: true });

const origin = new URL(BASE).origin;
const host   = new URL(BASE).host;
const R = { base: BASE, ranAt: new Date().toISOString(), net: {}, pages: [], lighthouse: {}, notes: [] };

const sh = (cmd) => { try { return execSync(cmd, { encoding: 'utf8', timeout: 60000, stdio: ['ignore','pipe','pipe'] }).trim(); } catch (e) { return `ERR: ${(e.stderr||e.message||'').toString().slice(0,500)}`; } };

/* ---------- 1. СЕТЬ, РЕДИРЕКТЫ, TLS, ЗАГОЛОВКИ ---------- */
async function chain(url) {
  const hops = [];
  let cur = url;
  for (let i = 0; i < 6; i++) {
    let r;
    try { r = await fetch(cur, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (audit)' } }); }
    catch (e) { hops.push({ url: cur, error: String(e.cause?.code || e.message) }); break; }
    const loc = r.headers.get('location');
    hops.push({ url: cur, status: r.status, location: loc, server: r.headers.get('server'),
                hsts: r.headers.get('strict-transport-security'),
                cacheControl: r.headers.get('cache-control'),
                contentEncoding: r.headers.get('content-encoding'),
                xFrame: r.headers.get('x-frame-options'),
                csp: r.headers.get('content-security-policy') ? 'present' : null,
                xPoweredBy: r.headers.get('x-powered-by'),
                poweredHeaders: [...r.headers.keys()].filter(k=>/wp|shopify|wix|tilda|webflow|squarespace|bitrix|platform/i.test(k)) });
    if (!loc) break;
    cur = new URL(loc, cur).href;
  }
  return hops;
}

R.net.https       = await chain(`https://${host}/`);
R.net.http        = await chain(`http://${host}/`);
R.net.wwwVariant  = await chain(host.startsWith('www.') ? `https://${host.replace(/^www\./,'')}/` : `https://www.${host}/`);
R.net.dns         = { a: sh(`dig +short ${host} A`), aaaa: sh(`dig +short ${host} AAAA`), ns: sh(`dig +short ${host} NS`), mx: sh(`dig +short ${host} MX`), txt: sh(`dig +short ${host} TXT`) };
R.net.tls         = sh(`echo | timeout 20 openssl s_client -servername ${host} -connect ${host}:443 2>/dev/null | openssl x509 -noout -issuer -subject -dates`);
R.net.http2       = sh(`curl -sS -o /dev/null -w '%{http_version} ttfb=%{time_starttransfer}s total=%{time_total}s size=%{size_download}' --compressed https://${host}/`);
R.net.whois       = sh(`whois ${host} 2>/dev/null | grep -iE '^(registrar|creation date|registry expiry|updated date|name server|domain name):' | head -12`);

for (const p of ['/robots.txt', '/sitemap.xml', '/sitemap_index.xml', '/llms.txt', '/favicon.ico', '/.well-known/security.txt']) {
  try {
    const r = await fetch(origin + p, { headers: { 'user-agent': 'Mozilla/5.0 (audit)' } });
    const t = r.ok ? (await r.text()).slice(0, 4000) : null;
    R.net[p] = { status: r.status, type: r.headers.get('content-type'), body: t };
  } catch (e) { R.net[p] = { error: String(e.cause?.code || e.message) }; }
}
try {
  const r = await fetch(origin + '/zzz-audit-404-probe-' + Date.now());
  R.net.notFound = { status: r.status, soft404: r.status === 200 };
} catch (e) { R.net.notFound = { error: String(e.message) }; }

/* ---------- 2. СЫРОЙ HTML БЕЗ JS (что видит краулер и AI-бот) ---------- */
async function rawHtml(url) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } });
    const h = await r.text();
    const text = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
                  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    return { bytes: h.length, textChars: text.length, textWords: text ? text.split(/\s+/).length : 0, sample: text.slice(0, 1500) };
  } catch (e) { return { error: String(e.message) }; }
}

/* ---------- 3. БРАУЗЕР ---------- */
const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function visit(ctx, url, label, shotName, isMobile) {
  const page = await ctx.newPage();
  const console_ = [], failed = [], reqs = [];
  page.on('console', m => { if (['error','warning'].includes(m.type())) console_.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
  page.on('pageerror', e => console_.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on('requestfailed', r => failed.push(`${r.failure()?.errorText} ${r.url()}`.slice(0, 300)));
  page.on('response', r => reqs.push({ url: r.url().slice(0, 200), status: r.status(), type: r.request().resourceType() }));

  const t0 = Date.now();
  let navErr = null;
  try { await page.goto(url, { waitUntil: 'load', timeout: 45000 }); }
  catch (e) { navErr = String(e.message).slice(0, 200); }
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(1200);

  const d = await page.evaluate(() => {
    const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource');
    const byType = {};
    for (const r of res) { const k = r.initiatorType; byType[k] = byType[k] || { n: 0, kb: 0 }; byType[k].n++; byType[k].kb += Math.round((r.transferSize || 0) / 1024); }
    const small = [...document.querySelectorAll('a[href], button, input[type=submit]')]
      .map(e => { const r = e.getBoundingClientRect(); return { t: txt(e).slice(0,40), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(x => x.w > 0 && (x.w < 44 || x.h < 44));
    return {
      title: document.title,
      titleLen: document.title.length,
      metaDesc: document.querySelector('meta[name="description"]')?.content || null,
      metaDescLen: (document.querySelector('meta[name="description"]')?.content || '').length,
      canonical: document.querySelector('link[rel=canonical]')?.href || null,
      robotsMeta: document.querySelector('meta[name=robots]')?.content || null,
      viewport: document.querySelector('meta[name=viewport]')?.content || null,
      lang: document.documentElement.lang || null,
      charset: document.characterSet,
      og: Object.fromEntries([...document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')]
            .map(m => [m.getAttribute('property') || m.getAttribute('name'), (m.content || '').slice(0, 200)])),
      h1: [...document.querySelectorAll('h1')].map(txt),
      headings: [...document.querySelectorAll('h1,h2,h3,h4')].map(h => `${h.tagName} ${txt(h)}`).slice(0, 60),
      bodyText: txt(document.body).slice(0, 18000),
      words: txt(document.body).split(/\s+/).filter(Boolean).length,
      imgs: [...document.images].map(i => ({ src: (i.currentSrc || i.src || '').slice(0, 160), alt: i.getAttribute('alt'),
              nat: `${i.naturalWidth}x${i.naturalHeight}`, disp: `${Math.round(i.width)}x${Math.round(i.height)}`, loading: i.loading })).slice(0, 60),
      links: [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href.slice(0,200), text: txt(a).slice(0, 70), target: a.target })).slice(0, 200),
      forms: [...document.forms].map(f => ({
        action: f.getAttribute('action'), resolved: f.action, method: (f.method || 'get').toUpperCase(), id: f.id, name: f.name,
        novalidate: f.noValidate,
        fields: [...f.elements].map(e => ({ tag: e.tagName, type: e.type, name: e.name, id: e.id, required: !!e.required,
          placeholder: e.placeholder || null, pattern: e.pattern || null, autocomplete: e.autocomplete || null,
          label: (document.querySelector(`label[for="${CSS.escape(e.id || '_none_')}"]`)?.textContent || '').replace(/\s+/g,' ').trim() || null,
          visible: !!(e.offsetWidth || e.offsetHeight) }))
      })),
      jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => (s.textContent || '').slice(0, 3000)),
      tel: [...document.querySelectorAll('a[href^="tel:"]')].map(a => a.getAttribute('href')),
      mailto: [...document.querySelectorAll('a[href^="mailto:"]')].map(a => a.getAttribute('href')),
      iframes: [...document.querySelectorAll('iframe')].map(f => (f.src || '').slice(0, 160)),
      scripts: [...document.querySelectorAll('script[src]')].map(s => s.src.slice(0, 160)),
      stylesheets: [...document.querySelectorAll('link[rel=stylesheet]')].map(s => s.href.slice(0, 160)),
      inlineStyleBytes: [...document.querySelectorAll('style')].reduce((a, s) => a + (s.textContent || '').length, 0),
      fonts: [...new Set([...document.querySelectorAll('*')].slice(0, 400).map(e => getComputedStyle(e).fontFamily))].slice(0, 8),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2
                 ? { scrollW: document.documentElement.scrollWidth, winW: window.innerWidth } : null,
      smallTapTargets: small.slice(0, 20),
      smallTapCount: small.length,
      docHeight: document.documentElement.scrollHeight,
      timing: { ttfb: Math.round(nav.responseStart || 0), domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
                load: Math.round(nav.loadEventEnd || 0), transferKB: Math.round((nav.transferSize || 0) / 1024),
                domNodes: document.getElementsByTagName('*').length, resourceCount: res.length,
                totalResourceKB: Math.round(res.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024), byType }
    };
  }).catch(e => ({ evalError: String(e.message) }));

  if (shotName) {
    await page.screenshot({ path: `${SHOT}/${shotName}.jpg`, fullPage: true, type: 'jpeg', quality: 72 }).catch(() => {});
  }
  await page.close();
  return { url, label, isMobile, navErr, loadMs, consoleIssues: console_.slice(0, 40), failedRequests: failed.slice(0, 20),
           bigResponses: reqs.filter(r => r.status >= 400).slice(0, 25), ...d };
}

/* ---------- 4. ОБХОД ---------- */
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent:
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
const mobile = await browser.newContext({ ...devices['iPhone 13'] });

const home = await visit(desktop, BASE, 'home', 'home-desktop', false);
home.raw = await rawHtml(BASE);
R.pages.push(home);

const seen = new Set([BASE.replace(/\/$/, '')]);
const queue = [];
for (const l of (home.links || [])) {
  try {
    const u = new URL(l.href);
    if (u.origin !== origin) continue;
    if (/\.(pdf|jpg|jpeg|png|webp|svg|zip|doc|docx|mp4|gif)$/i.test(u.pathname)) continue;
    u.hash = ''; u.search = '';
    const k = u.href.replace(/\/$/, '');
    if (!seen.has(k)) { seen.add(k); queue.push(u.href); }
  } catch {}
}
R.discoveredLinks = queue.slice(0, 80);

let n = 0;
for (const u of queue.slice(0, MAX - 1)) {
  n++;
  const slug = (new URL(u).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root').slice(0, 40);
  const p = await visit(desktop, u, 'inner', n <= 5 ? `p${n}-${slug}` : null, false);
  p.raw = await rawHtml(u);
  R.pages.push(p);
}

R.mobileHome = await visit(mobile, BASE, 'home-mobile', 'home-mobile', true);
const firstInner = queue[0];
if (firstInner) R.mobileInner = await visit(mobile, firstInner, 'inner-mobile', 'inner-mobile', true);

await browser.close();

/* ---------- 5. LIGHTHOUSE ---------- */
for (const mode of ['mobile', 'desktop']) {
  const f = `${OUT}/lh-${mode}.json`;
  sh(`CHROME_PATH=$(which google-chrome || which chromium) npx --yes lighthouse@12.2.1 "${BASE}" --preset=${mode === 'desktop' ? 'desktop' : ''} --form-factor=${mode} ${mode === 'mobile' ? '--screenEmulation.mobile' : ''} --output=json --output-path=${f} --quiet --chrome-flags="--headless=new --no-sandbox --disable-gpu" --only-categories=performance,accessibility,best-practices,seo --max-wait-for-load=60000`);
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const a = j.audits || {};
    const pick = (k) => a[k] ? { score: a[k].score, value: a[k].displayValue || a[k].numericValue } : null;
    R.lighthouse[mode] = {
      scores: Object.fromEntries(Object.entries(j.categories || {}).map(([k, v]) => [k, Math.round((v.score || 0) * 100)])),
      metrics: { fcp: pick('first-contentful-paint'), lcp: pick('largest-contentful-paint'), tbt: pick('total-blocking-time'),
                 cls: pick('cumulative-layout-shift'), si: pick('speed-index'), ttfb: pick('server-response-time'),
                 interactive: pick('interactive') },
      weight: pick('total-byte-weight'),
      opportunities: Object.values(a).filter(x => x && x.details?.type === 'opportunity' && x.score !== null && x.score < 0.9)
        .map(x => ({ id: x.id, title: x.title, savings: x.displayValue })).slice(0, 18),
      failedAudits: Object.values(a).filter(x => x && x.score !== null && x.score < 1 && x.scoreDisplayMode === 'binary')
        .map(x => ({ id: x.id, title: x.title, items: x.details?.items?.length || 0 })).slice(0, 40)
    };
    fs.unlinkSync(f);
  } catch (e) { R.lighthouse[mode] = { error: String(e.message).slice(0, 300) }; }
}

/* ---------- 6. ИТОГ ---------- */
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(R, null, 1));
const summary = {
  base: BASE, pagesCrawled: R.pages.length,
  pages: R.pages.map(p => ({ url: p.url, title: p.title, titleLen: p.titleLen, metaDescLen: p.metaDescLen,
    h1: p.h1, words: p.words, rawWords: p.raw?.textWords, forms: (p.forms || []).length,
    imgsNoAlt: (p.imgs || []).filter(i => i.alt === null || i.alt === '').length, consoleIssues: (p.consoleIssues || []).length })),
  lighthouse: R.lighthouse
};
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
