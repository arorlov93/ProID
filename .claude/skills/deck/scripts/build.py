# -*- coding: utf-8 -*-
"""Сборка презентации: PDF, контактный лист и проверки.

    python3 build.py deck.html

Рядом появятся deck.pdf и deck-contact.png. Контактный лист нужен не для
красоты: переполнение текста, съехавшие подписи и слипшиеся графики видны
только на отрендеренных слайдах, а не в разметке.
"""
import sys, pathlib, glob, os, json
from playwright.sync_api import sync_playwright

W, H = 1920, 1080


def chromium():
    for pat in ('/opt/pw-browsers/chromium-*/chrome-linux/chrome',
                os.path.expanduser('~/.cache/ms-playwright/chromium-*/chrome-linux/chrome')):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    return None


CHECKS = r"""
() => {
  const out = [], PAD = 80;
  const lum = (c) => {
    const m = c.match(/[\d.]+/g); if (!m) return null;
    const [r,g,b] = m.slice(0,3).map(v => {
      v = v/255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4);
    });
    return .2126*r + .7152*g + .0722*b;
  };
  const bgOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
    }
    return 'rgb(255,255,255)';
  };
  document.querySelectorAll('[data-build]').forEach(b => b.classList.add('shown'));
  document.querySelectorAll('.slide').forEach((s, i) => {
    const prev = s.style.display; s.style.display = 'flex';
    const n = i + 1;
    if (!s.querySelector('h1,h2,blockquote'))
      out.push({slide:n, kind:'нет заголовка', detail:'слайд без утверждения'});
    const li = s.querySelectorAll('ul li');
    if (li.length > 5)
      out.push({slide:n, kind:'длинный список', detail:li.length + ' пунктов, больше пяти'});
    const box = s.getBoundingClientRect();
    s.querySelectorAll('*').forEach(el => {
      if (!el.offsetParent && getComputedStyle(el).position !== 'absolute') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.bottom > box.bottom + 1 || r.right > box.right + 1 || r.top < box.top - 1)
        out.push({slide:n, kind:'выходит за холст',
                  detail:(el.tagName.toLowerCase()) + ': ' + (el.textContent||'').trim().slice(0,40)});
      const st = getComputedStyle(el);
      const txt = [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
      if (!txt) return;
      const fs = parseFloat(st.fontSize);
      /* Надзаголовки, подписи и номера — метки, им мелкий кегль положен.
         Проверяем только то, что зритель читает как текст. */
      const isLabel = el.closest('.eyebrow, figcaption, .tag, .who, .c, .src, .usd, .q, .lbl, #num, #help, .notes');
      if (fs < 24 && !isLabel)
        out.push({slide:n, kind:'мелкий шрифт',
                  detail:fs.toFixed(0) + 'px: ' + el.textContent.trim().slice(0,40)});
      if (el.closest('.q')) return;          // заглушка фото, исчезнет со снимком
      const l1 = lum(st.color), l2 = lum(bgOf(el));
      if (l1 !== null && l2 !== null) {
        const cr = (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
        const need = fs >= 44 ? 3 : 4.5;
        if (cr < need)
          out.push({slide:n, kind:'низкий контраст',
                    detail:cr.toFixed(1)+':1 при норме '+need+':1 — '+el.textContent.trim().slice(0,32)});
      }
    });
    s.style.display = prev;
  });
  return out;
}
"""

CONTACT = r"""
(cols) => {
  document.querySelectorAll('[data-build]').forEach(b => b.classList.add('shown'));
  const slides = [...document.querySelectorAll('.slide')];
  const wrap = document.createElement('div');
  const TW = 480, gap = 16, pad = 24;
  wrap.style.cssText = `position:absolute;left:0;top:0;z-index:999;background:#0d0f11;
    padding:${pad}px;display:grid;grid-template-columns:repeat(${cols},${TW}px);gap:${gap}px`;
  slides.forEach((s, k) => {
    const cell = document.createElement('div');
    cell.style.cssText = `width:${TW}px;height:${TW*1080/1920}px;overflow:hidden;
      position:relative;background:#F5F4F0`;
    const mini = document.createElement('div');
    mini.style.cssText = `width:1920px;height:1080px;transform:scale(${TW/1920});
      transform-origin:top left`;
    const cl = s.cloneNode(true);
    cl.style.display = 'flex';
    cl.querySelectorAll('[data-build]').forEach(b => b.classList.add('shown'));
    mini.append(cl); cell.append(mini);
    const tag = document.createElement('div');
    tag.textContent = k + 1;
    tag.style.cssText = `position:absolute;left:6px;bottom:4px;color:#fff;background:#000a;
      font:600 11px monospace;padding:1px 5px;border-radius:3px`;
    cell.append(tag); wrap.append(cell);
  });
  document.body.append(wrap);
  const rows = Math.ceil(slides.length / cols);
  return {w: cols*TW + (cols-1)*gap + pad*2,
          h: rows*(TW*1080/1920) + (rows-1)*gap + pad*2};
}
"""


def main():
    src = pathlib.Path(sys.argv[1]).resolve()
    pdf = src.with_suffix('.pdf')
    png = src.with_name(src.stem + '-contact.png')
    cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4

    with sync_playwright() as pw:
        exe = chromium()
        b = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
        p = b.new_page(viewport={'width': W, 'height': H})
        p.goto(src.as_uri())
        p.wait_for_timeout(400)
        n = p.evaluate("document.querySelectorAll('.slide').length")

        issues = p.evaluate(CHECKS)
        p.pdf(path=str(pdf), width=f'{W}px', height=f'{H}px', print_background=True,
              margin={'top': '0', 'bottom': '0', 'left': '0', 'right': '0'})

        p.goto(src.as_uri())
        p.wait_for_timeout(300)
        size = p.evaluate(CONTACT, cols)
        p.set_viewport_size({'width': int(size['w']), 'height': int(size['h'])})
        p.wait_for_timeout(200)
        p.screenshot(path=str(png), full_page=True)
        b.close()

    print(f'слайдов: {n}')
    print(f'PDF: {pdf}')
    print(f'контактный лист: {png}')
    print(f'время выступления при 1,5–2 мин на слайд: {n*1.5:.0f}–{n*2:.0f} мин')
    if not issues:
        print('\nзамечаний нет')
        return
    by = {}
    for x in issues:
        by.setdefault(x['kind'], []).append(x)
    print(f'\nзамечаний: {len(issues)}')
    for kind, lst in sorted(by.items(), key=lambda t: -len(t[1])):
        print(f'\n  {kind} — {len(lst)}')
        for x in lst[:8]:
            print(f'     слайд {x["slide"]}: {x["detail"]}')
        if len(lst) > 8:
            print(f'     … ещё {len(lst)-8}')


if __name__ == '__main__':
    main()
