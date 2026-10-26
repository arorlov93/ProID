// Тест форм: валидация пустой формы, невалидный email, реальная тестовая отправка.
// node forms.mjs <baseUrl> [extraUrl ...]
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.argv[2];
const EXTRA = process.argv.slice(3);
const OUT = 'audit';
fs.mkdirSync(`${OUT}/forms`, { recursive: true });

const STAMP = new Date().toISOString().slice(0, 16).replace('T', ' ');
const MSG = `AUTOMATED TEST SUBMISSION - please ignore. Technical site audit, ${STAMP} UTC. No reply needed.`;
const VAL = {
  email:  'test@example.com',
  tel:    '3055550142',
  name:   'TEST - site audit (ignore)',
  first:  'Test', last: 'Audit', company: 'Test',
  zip:    '33139', city: 'Miami Beach', address: '100 Test St',
  number: '100', url: 'https://example.com',
  text:   MSG, textarea: MSG, date: '2026-12-01',
};

function valueFor(f) {
  const k = `${f.name} ${f.id} ${f.placeholder} ${f.label} ${f.autocomplete}`.toLowerCase();
  if (f.type === 'email' || /e-?mail|корреспонд/.test(k)) return VAL.email;
  if (f.type === 'tel'   || /phone|tel|mobile|телефон/.test(k)) return VAL.tel;
  if (/first.?name|fname|имя/.test(k)) return VAL.first;
  if (/last.?name|lname|surname|фамил/.test(k)) return VAL.last;
  if (/compan|organi|business|firm/.test(k)) return VAL.company;
  if (/zip|postal/.test(k)) return VAL.zip;
  if (/city|town/.test(k)) return VAL.city;
  if (/address|street|addr/.test(k)) return VAL.address;
  if (/subject|тема/.test(k)) return 'TEST - site audit';
  if (/message|comment|describe|detail|inquiry|сообщ/.test(k)) return MSG;
  if (/name|имя/.test(k)) return VAL.name;
  if (f.type === 'number') return VAL.number;
  if (f.type === 'url') return VAL.url;
  if (f.type === 'date') return VAL.date;
  return VAL.name;
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const results = [];

async function listForms(page) {
  const out = [];
  for (const fr of page.frames()) {
    let found = [];
    try {
      found = await fr.evaluate(() => [...document.forms].map((f, idx) => ({
        idx, action: f.getAttribute('action'), resolved: f.action, method: (f.method || 'get').toUpperCase(),
        id: f.id || null, name: f.name || null, cls: f.className || null,
        visible: !!(f.offsetWidth || f.offsetHeight),
        html: f.outerHTML.slice(0, 2500),
        captcha: /recaptcha|hcaptcha|turnstile|cf-chl/i.test(document.documentElement.innerHTML),
        fields: [...f.elements].map(e => ({
          tag: e.tagName, type: e.type, name: e.name || null, id: e.id || null,
          required: !!e.required, placeholder: e.placeholder || null,
          autocomplete: e.autocomplete || null, pattern: e.pattern || null,
          maxlength: e.maxLength > 0 ? e.maxLength : null,
          label: (document.querySelector(`label[for="${(e.id||'_x_').replace(/"/g,'')}"]`)?.textContent || '').replace(/\s+/g,' ').trim() || null,
          hidden: e.type === 'hidden' || !(e.offsetWidth || e.offsetHeight),
          value: e.type === 'hidden' ? String(e.value).slice(0, 80) : null,
        })),
      })));
    } catch {}
    for (const f of found) out.push({ ...f, frameUrl: fr.url() });
  }
  return out;
}

async function testPage(url, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  const net = [], errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 250)); });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 250)));
  page.on('request', r => { if (['POST','PUT'].includes(r.method())) net.push({ phase: 'req', method: r.method(), url: r.url().slice(0, 220), postData: (r.postData() || '').slice(0, 600) }); });
  page.on('response', async r => { if (['POST','PUT'].includes(r.request().method())) {
      let body = ''; try { body = (await r.text()).slice(0, 600); } catch {}
      net.push({ phase: 'res', status: r.status(), url: r.url().slice(0, 220), body });
  }});

  const rec = { url, tag, forms: [], tests: [], consoleErrors: errs, network: net };
  try { await page.goto(url, { waitUntil: 'load', timeout: 45000 }); }
  catch (e) { rec.navError = String(e.message).slice(0, 200); }
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}
  await page.waitForTimeout(1500);

  rec.forms = await listForms(page);
  if (!rec.forms.length) { await ctx.close(); results.push(rec); return; }

  // работаем с первой видимой формой, у которой есть заполняемые поля
  const target = rec.forms.find(f => f.visible && f.fields.some(x => !x.hidden && ['text','email','tel','textarea','number','url'].includes(x.type))) || rec.forms[0];
  rec.targetForm = { idx: target.idx, frameUrl: target.frameUrl, action: target.resolved, method: target.method };
  const frame = page.frames().find(f => f.url() === target.frameUrl) || page.mainFrame();
  const fsel = `form >> nth=${target.idx}`;

  const submitSel = async () => {
    const h = await frame.$(`form:nth-of-type(${target.idx + 1}) [type=submit], form:nth-of-type(${target.idx + 1}) button`);
    return h;
  };

  // --- ТЕСТ 1: пустая отправка -> проверяем клиентскую валидацию
  try {
    const before = net.length;
    const btn = await submitSel();
    if (btn) { await btn.click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(2500); }
    const v = await frame.evaluate((i) => {
      const f = document.forms[i]; if (!f) return null;
      return { valid: f.checkValidity(),
        invalidFields: [...f.elements].filter(e => e.willValidate && !e.checkValidity()).map(e => `${e.name || e.id || e.type}: ${e.validationMessage}`),
        visibleErrors: [...document.querySelectorAll('[class*=error],[class*=invalid],[role=alert],[class*=Error]')]
          .map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 8) };
    }, target.idx).catch(() => null);
    rec.tests.push({ name: 'empty-submit', clientValidation: v, networkFired: net.length > before });
  } catch (e) { rec.tests.push({ name: 'empty-submit', error: String(e.message).slice(0, 200) }); }
  await page.screenshot({ path: `${OUT}/forms/${tag}-1-empty.jpg`, type: 'jpeg', quality: 72, fullPage: true }).catch(() => {});

  // --- ТЕСТ 2: невалидный email
  try {
    const emailField = target.fields.find(f => f.type === 'email' || /mail/i.test(`${f.name}${f.id}${f.placeholder}`));
    if (emailField) {
      const sel = emailField.id ? `#${CSS_escape(emailField.id)}` : `[name="${emailField.name}"]`;
      await frame.fill(sel, 'not-an-email', { timeout: 6000 }).catch(() => {});
      const before = net.length;
      const btn = await submitSel(); if (btn) await btn.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const v = await frame.evaluate((i) => { const f = document.forms[i]; return f ? f.checkValidity() : null; }, target.idx).catch(() => null);
      rec.tests.push({ name: 'invalid-email', formValid: v, networkFired: net.length > before });
    } else rec.tests.push({ name: 'invalid-email', skipped: 'no email field' });
  } catch (e) { rec.tests.push({ name: 'invalid-email', error: String(e.message).slice(0, 200) }); }

  // --- ТЕСТ 3: настоящая тестовая отправка
  try {
    const filled = [];
    for (const f of target.fields) {
      if (f.hidden || ['submit','button','reset','hidden','file','image'].includes(f.type)) continue;
      const sel = f.id ? `#${CSS_escape(f.id)}` : (f.name ? `[name="${f.name}"]` : null);
      if (!sel) continue;
      try {
        if (f.type === 'checkbox') { await frame.check(sel, { timeout: 4000 }); filled.push(`${f.name}=checked`); }
        else if (f.type === 'radio') { await frame.check(sel, { timeout: 4000 }); filled.push(`${f.name}=radio`); }
        else if (f.tag === 'SELECT') {
          const opts = await frame.$$eval(`${sel} option`, os => os.map(o => o.value).filter(v => v && v !== '0'));
          if (opts.length) { await frame.selectOption(sel, opts[0]); filled.push(`${f.name}=${opts[0]}`); }
        } else { const v = valueFor(f); await frame.fill(sel, v, { timeout: 5000 }); filled.push(`${f.name || f.id}=${v.slice(0, 40)}`); }
      } catch (e) { filled.push(`${f.name || f.id}=FAILED(${String(e.message).slice(0, 60)})`); }
    }
    await page.screenshot({ path: `${OUT}/forms/${tag}-2-filled.jpg`, type: 'jpeg', quality: 72, fullPage: true }).catch(() => {});

    const urlBefore = page.url();
    const htmlBefore = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
    const netBefore = net.length;
    const t0 = Date.now();
    const btn = await submitSel();
    const btnText = btn ? (await btn.innerText().catch(() => '')) : null;
    if (btn) await btn.click({ timeout: 10000 }).catch(e => rec.clickError = String(e.message).slice(0, 150));
    await page.waitForTimeout(9000);
    try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
    const ms = Date.now() - t0;
    const htmlAfter = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
    const diff = htmlAfter.length !== htmlBefore.length
      ? htmlAfter.split(' ').filter((w, i) => htmlBefore.split(' ')[i] !== w).slice(0, 60).join(' ') : '';
    rec.tests.push({ name: 'real-submit', filled, submitButton: btnText, elapsedMs: ms,
      urlBefore, urlAfter: page.url(), redirected: page.url() !== urlBefore,
      networkCalls: net.slice(netBefore),
      successTextFound: /thank|success|received|sent|спасибо|отправлен/i.test(htmlAfter) && !/thank/i.test(htmlBefore),
      pageTextAfterSample: htmlAfter.slice(0, 1200), textDiffSample: diff.slice(0, 600) });
    await page.screenshot({ path: `${OUT}/forms/${tag}-3-after.jpg`, type: 'jpeg', quality: 72, fullPage: true }).catch(() => {});
  } catch (e) { rec.tests.push({ name: 'real-submit', error: String(e.message).slice(0, 300) }); }

  rec.consoleErrors = errs.slice(0, 25);
  rec.network = net.slice(0, 40);
  await ctx.close();
  results.push(rec);
}
function CSS_escape(s) { return String(s).replace(/([ #;?%&,.+*~':"!^$\[\]()=>|\/@])/g, '\\$1'); }

// какие страницы тестировать
let urls = [BASE, ...EXTRA];
try {
  const rep = JSON.parse(fs.readFileSync(`${OUT}/report.json`, 'utf8'));
  for (const p of rep.pages || []) if ((p.forms || []).length && !urls.includes(p.url)) urls.push(p.url);
  for (const p of rep.pages || []) if (/contact|quote|estimate|request|contacto/i.test(p.url) && !urls.includes(p.url)) urls.push(p.url);
} catch {}
urls = [...new Set(urls)].slice(0, 6);
console.log('testing forms on:', urls);

let i = 0;
for (const u of urls) { i++; await testPage(u, `f${i}-` + (new URL(u).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home').slice(0, 30)); }

await browser.close();
fs.writeFileSync(`${OUT}/forms-report.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify(results.map(r => ({ url: r.url, forms: r.forms.length,
  action: r.targetForm?.action, method: r.targetForm?.method,
  tests: r.tests.map(t => ({ n: t.name, ...(t.networkFired !== undefined ? { net: t.networkFired } : {}),
    ...(t.networkCalls ? { calls: t.networkCalls.filter(c => c.phase === 'res').map(c => `${c.status} ${c.url}`) } : {}),
    ...(t.successTextFound !== undefined ? { success: t.successTextFound } : {}) })) })), null, 1));
