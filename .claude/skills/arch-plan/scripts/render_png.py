# -*- coding: utf-8 -*-
"""SVG -> PNG через Chromium. Нужен, чтобы посмотреть на чертёж глазами:
коллизии подписей и наложение дуг открывания иначе не видны."""
import sys, pathlib, glob, os
from playwright.sync_api import sync_playwright


def chromium_path():
    """Браузер в окружении предустановлен, но версия сборки может не совпасть
    с той, которую ждёт установленный playwright. Ищем то, что есть на диске,
    вместо playwright install — качать нечего и незачем."""
    for pat in ('/opt/pw-browsers/chromium-*/chrome-linux/chrome',
                '/opt/pw-browsers/chromium_headless_shell-*/*/chrome-headless-shell',
                os.path.expanduser('~/.cache/ms-playwright/chromium-*/chrome-linux/chrome')):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    return None

src = pathlib.Path(sys.argv[1]).resolve()
dst = sys.argv[2] if len(sys.argv) > 2 else str(src.with_suffix('.png'))
zoom = float(sys.argv[3]) if len(sys.argv) > 3 else 4.0   # пикселей на мм

svg = src.read_text(encoding='utf-8')
import re
m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
w, h = (float(m.group(1)), float(m.group(2))) if m else (420, 297)

html = ('<!doctype html><meta charset="utf-8">'
        '<style>html,body{margin:0;background:#fff}svg{display:block}</style>' + svg)
with sync_playwright() as pw:
    exe = chromium_path()
    b = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
    p = b.new_page(viewport={'width': int(w * zoom), 'height': int(h * zoom)},
                   device_scale_factor=1)
    p.set_content(html)
    p.eval_on_selector('svg', f'e => {{ e.setAttribute("width", {w*zoom}); '
                              f'e.setAttribute("height", {h*zoom}); }}')
    p.screenshot(path=dst, full_page=True)
    b.close()
print(dst)
