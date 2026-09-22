# -*- coding: utf-8 -*-
"""Контактный лист для .pptx без PowerPoint и LibreOffice.

    python3 preview.py deck.pptx        → deck-pptx-contact.png

Зачем: геометрические проверки не видят налезающих друг на друга блоков,
а LibreOffice в неинтерактивных средах часто вообще не открывает файл
(«source file could not be loaded») — тогда сверить нечем. Скрипт читает
фигуры прямо из pptx и раскладывает их абсолютным позиционированием в
HTML, после чего снимает страницу браузером.

Это предпросмотр, а не рендер: переносы строк и кернинг считает браузер,
а не PowerPoint, поэтому длины строк отличаются на несколько процентов.
Задача — увидеть композицию и наложения, а не сдать в печать.
"""
import glob, html, pathlib, sys, base64
from pptx import Presentation
from pptx.util import Emu

EMU_IN = 914400


def _color(run, dflt='#16181B'):
    try:
        c = run.font.color
        if c and c.type is not None and c.rgb is not None:
            return '#' + str(c.rgb)
    except Exception:
        pass
    return dflt


def _fill(sh):
    try:
        f = sh.fill
        if f.type is not None and f.fore_color.rgb is not None:
            alpha = 1.0
            for el in f.fore_color._xFill.iter():
                if el.tag.endswith('}alpha'):
                    alpha = int(el.get('val')) / 100000
            return '#' + str(f.fore_color.rgb), alpha
    except Exception:
        pass
    return None, 1.0


def slide_html(s, W, H, px):
    out = []
    for sh in s.shapes:
        if sh.left is None:
            continue
        x, y = sh.left / EMU_IN * px, sh.top / EMU_IN * px
        w, h = sh.width / EMU_IN * px, sh.height / EMU_IN * px
        if sh.shape_type == 13 or sh.__class__.__name__ == 'Picture':
            b64 = base64.b64encode(sh.image.blob).decode()
            out.append(f'<img style="left:{x:.1f}px;top:{y:.1f}px;width:{w:.1f}px;'
                       f'height:{h:.1f}px" src="data:{sh.image.content_type};base64,{b64}">')
            continue
        col, alpha = _fill(sh)
        if col and not (sh.has_text_frame and sh.text_frame.text.strip()):
            out.append(f'<div class="r" style="left:{x:.1f}px;top:{y:.1f}px;'
                       f'width:{w:.1f}px;height:{h:.1f}px;background:{col};'
                       f'opacity:{alpha:.2f}"></div>')
            continue
        if not sh.has_text_frame:
            continue
        paras = []
        for p in sh.text_frame.paragraphs:
            runs = []
            for r in p.runs:
                pt = r.font.size.pt if r.font.size else 18
                fam = 'Consolas,monospace' if (r.font.name or '').startswith('Cons') \
                    else 'Arial,Helvetica,sans-serif'
                runs.append(f'<span style="font-size:{pt/72*px:.1f}px;'
                            f'font-weight:{700 if r.font.bold else 400};'
                            f'font-family:{fam};color:{_color(r)}">'
                            + html.escape(r.text) + '</span>')
            al = {2: 'right', 3: 'center'}.get(
                getattr(p.alignment, 'value', None), 'left')
            paras.append(f'<div style="text-align:{al};line-height:'
                         f'{p.line_spacing or 1.15}">' + ''.join(runs) + '</div>')
        out.append(f'<div class="t" style="left:{x:.1f}px;top:{y:.1f}px;'
                   f'width:{w:.1f}px;height:{h:.1f}px">' + ''.join(paras) + '</div>')
    return ''.join(out)


def main():
    src = pathlib.Path(sys.argv[1]).resolve()
    cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    prs = Presentation(str(src))
    W, H = prs.slide_width / EMU_IN, prs.slide_height / EMU_IN
    px = 1920 / W                       # холст кладём в 1920 по ширине
    TW = 480
    cells = []
    for i, s in enumerate(prs.slides, 1):
        cells.append(
            f'<div class="cell"><div class="mini">{slide_html(s, W, H, px)}</div>'
            f'<span class="tag">{i}</span></div>')
    page = (f'<meta charset="utf-8"><style>'
            f'body{{margin:0;background:#0d0f11;padding:24px;display:grid;'
            f'grid-template-columns:repeat({cols},{TW}px);gap:16px}}'
            f'.cell{{width:{TW}px;height:{TW*H/W:.0f}px;position:relative;'
            f'overflow:hidden;background:#F7F5F1}}'
            f'.mini{{width:1920px;height:{1920*H/W:.0f}px;position:relative;'
            f'transform:scale({TW/1920});transform-origin:top left}}'
            f'.mini .t,.mini .r,.mini img{{position:absolute}}'
            f'.mini .t{{overflow:visible;white-space:pre-wrap}}'
            f'.tag{{position:absolute;left:6px;bottom:4px;color:#fff;background:#000a;'
            f'font:600 11px monospace;padding:1px 5px;border-radius:3px}}'
            f'</style>' + ''.join(cells))
    tmp = src.with_name(src.stem + '-preview.html')
    tmp.write_text(page, encoding='utf-8')
    png = src.with_name(src.stem + '-pptx-contact.png')
    exe = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome')
                 + glob.glob(str(pathlib.Path.home() /
                                 '.cache/ms-playwright/chromium-*/chrome-linux/chrome')))
    from playwright.sync_api import sync_playwright
    rows = -(-len(prs.slides) // cols)
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=exe[-1]) if exe else pw.chromium.launch()
        p = b.new_page(viewport={'width': cols * TW + (cols - 1) * 16 + 48,
                                 'height': int(rows * (TW * H / W) + (rows - 1) * 16 + 48)})
        p.goto(tmp.as_uri()); p.wait_for_timeout(600)
        p.screenshot(path=str(png), full_page=True)
        b.close()
    print(f'слайдов: {len(prs.slides)}')
    print(f'контактный лист: {png}')
    print('предпросмотр приблизительный: переносы строк считает браузер, не PowerPoint')


if __name__ == '__main__':
    main()
