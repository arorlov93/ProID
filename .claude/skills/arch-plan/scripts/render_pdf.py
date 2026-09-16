# -*- coding: utf-8 -*-
"""SVG -> PDF в натуральную величину листа.

Размер страницы берётся из viewBox, который у Plan всегда в миллиметрах
бумаги, поэтому чертёж печатается в заявленном масштабе без подгонки.
"""
import sys, pathlib, re, glob, os
from playwright.sync_api import sync_playwright


def chromium_path():
    for pat in ('/opt/pw-browsers/chromium-*/chrome-linux/chrome',
                os.path.expanduser('~/.cache/ms-playwright/chromium-*/chrome-linux/chrome')):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    return None


src = pathlib.Path(sys.argv[1]).resolve()
dst = sys.argv[2] if len(sys.argv) > 2 else str(src.with_suffix('.pdf'))
svg = src.read_text(encoding='utf-8')
m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
w, h = (float(m.group(1)), float(m.group(2))) if m else (420, 297)

html = ('<!doctype html><meta charset="utf-8"><style>'
        '@page{margin:0}html,body{margin:0;padding:0}svg{display:block}'
        '</style>' + svg)
with sync_playwright() as pw:
    exe = chromium_path()
    b = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
    p = b.new_page()
    p.set_content(html)
    p.pdf(path=dst, width=f'{w}mm', height=f'{h}mm',
          print_background=True, margin={'top': '0', 'bottom': '0',
                                         'left': '0', 'right': '0'})
    b.close()
print(dst)
