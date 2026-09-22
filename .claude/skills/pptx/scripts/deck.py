# -*- coding: utf-8 -*-
"""Раскладки для .pptx: холст 16:9, одна палитра, предсказуемые поля.

Смысл обёртки — не экономия строк, а то, что поля и кегли заданы в одном
месте. Собранные руками фигуры разъезжаются к десятому слайду, и видно
это уже на проекторе.
"""
import pathlib

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

W, H = 13.333, 7.5          # дюймы, 16:9
PAD = 0.62
FONT = 'Arial'              # есть на любой машине; вложить шрифт pptx не умеет


def rgb(h):
    h = h.lstrip('#')
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


class Deck:
    def __init__(self, accent='#7E2B25', paper='#F7F5F1', ink='#16181B',
                 muted='#5C646C', rule='#D8D4CC'):
        self.p = Presentation()
        self.p.slide_width = Inches(W)
        self.p.slide_height = Inches(H)
        self.accent, self.paper, self.ink = accent, paper, ink
        self.muted, self.rule = muted, rule

    # ── служебное ────────────────────────────────────────────────────────
    def _slide(self, bg=None):
        s = self.p.slides.add_slide(self.p.slide_layouts[6])   # пустой
        r = s.shapes.add_shape(1, 0, 0, self.p.slide_width, self.p.slide_height)
        r.fill.solid(); r.fill.fore_color.rgb = rgb(bg or self.paper)
        r.line.fill.background(); r.shadow.inherit = False
        return s

    def _tb(self, s, x, y, w, h, text, size, color, bold=False, mono=False,
            space=0.0, caps=False, align=PP_ALIGN.LEFT, line=1.15, label=False):
        tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        if label:
            # Метки — надзаголовки, подписи под числами, источники. Проверке
            # нужно знать, что мелкий кегль здесь не ошибка.
            tb.name = 'label'
        f = tb.text_frame
        f.word_wrap = True
        f.margin_left = f.margin_right = f.margin_top = f.margin_bottom = 0
        for i, part in enumerate(str(text).split('\n')):
            para = f.paragraphs[0] if i == 0 else f.add_paragraph()
            para.alignment = align
            para.line_spacing = line
            run = para.add_run()
            run.text = part.upper() if caps else part
            run.font.size = Pt(size)
            run.font.bold = bold
            run.font.name = 'Consolas' if mono else FONT
            run.font.color.rgb = rgb(color)
        return tb

    def _eyebrow(self, s, text, color=None):
        self._tb(s, PAD, PAD, W - PAD * 2, .3, text, 11, color or self.muted,
                 mono=True, caps=True, label=True)

    def _notes(self, s, notes):
        # Заметки обязательны: слайд для зала, заметки для выступающего.
        s.notes_slide.notes_text_frame.text = notes or ''

    def _src(self, s, text, color=None):
        if text:
            self._tb(s, PAD, H - .58, W - PAD * 2, .3, text, 10,
                     color or self.muted, mono=True, label=True)

    # ── раскладки ────────────────────────────────────────────────────────
    def statement(self, title, under=None, eyebrow=None, big=None,
                  notes='', src=None):
        s = self._slide()
        if eyebrow:
            self._eyebrow(s, eyebrow)
        y = 2.0
        if big:
            self._tb(s, PAD, 1.55, W - PAD * 2, 1.1, big, 62, self.accent, bold=True)
            y = 2.75
        self._tb(s, PAD, y, W - PAD * 2 - 1.2, 2.0, title, 34, self.ink, bold=True)
        if under:
            self._tb(s, PAD, y + 1.9, W * .62, 1.6, under, 15, self.muted, line=1.35)
        self._src(s, src); self._notes(s, notes)
        return s

    def stats(self, title, items, eyebrow=None, notes='', src=None,
              photo_right=None):
        """items: [(число, подпись[, мелкая приписка]), ...] — до четырёх.

        photo_right кладёт кадр в правую половину слайда, а числа
        выстраивает в столбец: так видно, о каком товаре идёт речь, и при
        этом цифры остаются на светлом фоне.
        """
        s = self._slide()
        if eyebrow:
            self._eyebrow(s, eyebrow)
        if photo_right:
            half = W * .44
            self._cover(s, photo_right, W - half, 0, half, H)
            self._tb(s, PAD, 1.25, W - half - PAD - .5, 1.5, title, 27,
                     self.ink, bold=True)
            y = 3.0
            for it in items:
                self._tb(s, PAD, y, 1.9, .9, it[0], 40, self.accent, bold=True)
                self._tb(s, PAD + 2.0, y + .12, W - half - PAD - 2.4, .5,
                         it[1], 15, self.ink)
                if len(it) > 2 and it[2]:
                    self._tb(s, PAD + 2.0, y + .58, W - half - PAD - 2.4, .4,
                             it[2], 11, self.muted, mono=True, label=True)
                y += 1.15
            self._src(s, src); self._notes(s, notes)
            return s
        self._tb(s, PAD, 1.25, W - PAD * 2 - 1.0, 1.3, title, 30, self.ink, bold=True)
        n = len(items)
        colw = (W - PAD * 2) / n
        for i, it in enumerate(items):
            x = PAD + colw * i
            self._tb(s, x, 3.15, colw - .3, 1.1, it[0], 52, self.accent, bold=True)
            self._tb(s, x, 4.32, colw - .35, .9, it[1], 15, self.ink, line=1.25)
            if len(it) > 2 and it[2]:
                self._tb(s, x, 5.02, colw - .35, .6, it[2], 11, self.muted,
                         mono=True, label=True)
        self._src(s, src); self._notes(s, notes)
        return s

    def table(self, title, header, rows, eyebrow=None, notes='', src=None,
              hi=None, widths=None):
        s = self._slide()
        if eyebrow:
            self._eyebrow(s, eyebrow)
        self._tb(s, PAD, 1.1, W - PAD * 2, .7, title, 28, self.ink, bold=True)
        top, bottom = 2.05, H - .85
        nrow = len(rows) + 1
        rh = min(.42, (bottom - top) / nrow)
        cols = len(header)
        ws = widths or [2.4] + [(W - PAD * 2 - 2.4) / (cols - 1)] * (cols - 1)
        for r in range(nrow):
            y = top + rh * r
            src_row = header if r == 0 else rows[r - 1]
            if hi is not None and r - 1 == hi:
                band = s.shapes.add_shape(1, Inches(PAD), Inches(y),
                                          Inches(W - PAD * 2), Inches(rh))
                band.fill.solid(); band.fill.fore_color.rgb = rgb('#F0E4E1')
                band.line.fill.background(); band.shadow.inherit = False
            x = PAD
            for c, cell in enumerate(src_row):
                bold = (r == 0) or (hi is not None and r - 1 == hi)
                col = self.muted if r == 0 else self.ink
                al = PP_ALIGN.LEFT if c == 0 else PP_ALIGN.RIGHT
                self._tb(s, x, y + rh * .22, ws[c], rh, cell,
                         11 if r == 0 else 13, col, bold=bold, align=al,
                         label=(r == 0))
                x += ws[c]
            ln = s.shapes.add_shape(1, Inches(PAD), Inches(y + rh - .012),
                                    Inches(W - PAD * 2), Inches(.012))
            ln.fill.solid(); ln.fill.fore_color.rgb = rgb(self.rule)
            ln.line.fill.background(); ln.shadow.inherit = False
        self._src(s, src); self._notes(s, notes)
        return s

    def bullets(self, title, items, eyebrow=None, notes='', src=None):
        s = self._slide()
        if eyebrow:
            self._eyebrow(s, eyebrow)
        self._tb(s, PAD, 1.15, W - PAD * 2 - 1.0, .9, title, 30, self.ink, bold=True)
        y = 2.45
        for it in items[:5]:                      # больше пяти пунктов не читают
            d = s.shapes.add_shape(1, Inches(PAD), Inches(y + .13),
                                   Inches(.18), Inches(.035))
            d.fill.solid(); d.fill.fore_color.rgb = rgb(self.accent)
            d.line.fill.background(); d.shadow.inherit = False
            self._tb(s, PAD + .38, y, W - PAD * 2 - .5, .8, it, 16, self.ink, line=1.3)
            y += .92
        self._src(s, src); self._notes(s, notes)
        return s

    def compare(self, title, left, right, rows, eyebrow=None, notes='', src=None):
        """rows: [(что сравниваем, слева, справа), ...]"""
        s = self._slide()
        if eyebrow:
            self._eyebrow(s, eyebrow)
        self._tb(s, PAD, 1.1, W - PAD * 2 - 1.0, .8, title, 28, self.ink, bold=True)
        kw, cw = 2.9, (W - PAD * 2 - 2.9) / 2 - .16
        y = 2.25
        self._tb(s, PAD + kw, y, cw, .3, left, 11, self.muted, mono=True,
                 caps=True, label=True)
        self._tb(s, PAD + kw + cw + .3, y, cw, .3, right, 11, self.muted, mono=True,
                 caps=True, label=True)
        y += .42
        for k, a, b in rows[:5]:
            ln = s.shapes.add_shape(1, Inches(PAD), Inches(y - .06),
                                    Inches(W - PAD * 2), Inches(.012))
            ln.fill.solid(); ln.fill.fore_color.rgb = rgb(self.rule)
            ln.line.fill.background(); ln.shadow.inherit = False
            self._tb(s, PAD, y + .1, kw - .2, .8, k, 14, self.ink, bold=True, line=1.25)
            self._tb(s, PAD + kw, y + .1, cw, .8, a, 14, self.accent, bold=True, line=1.25)
            self._tb(s, PAD + kw + cw + .3, y + .1, cw, .8, b, 14, self.ink, line=1.25)
            y += .92
        self._src(s, src); self._notes(s, notes)
        return s

    def photo(self, img, title, eyebrow=None, stats=None, sub=None,
              notes='', src=None, mid=False):
        """Полный кадр + текст снизу. Кроп считаем сами: cover в pptx нет."""
        s = self._slide(bg='#16181B')
        self._cover(s, img, 0, 0, W, H)
        # Титульный слайд несёт сразу надзаголовок, заголовок в две строки,
        # подпись и блок цифр — при позиции по умолчанию подпись садилась
        # на числа, поэтому текст поднимается, когда есть и то и другое.
        y = 2.9 if mid else (3.72 if (sub and stats) else 4.15)
        self._veil(s, mid, top=y - 1.7)
        if eyebrow:
            self._tb(s, PAD, y - .45, W - PAD * 2, .3, eyebrow, 11, '#E2C9C5',
                     mono=True, caps=True, label=True)
        self._tb(s, PAD, y, W * .72, 1.3, title, 32, '#FFFFFF', bold=True)
        if sub:
            self._tb(s, PAD, y + (1.0 if stats else 1.35), W * .62, .5,
                     sub, 13, '#CBD3D8')
        if stats:
            colw = (W - PAD * 2) / max(len(stats), 3)
            for i, it in enumerate(stats):
                x = PAD + colw * i
                self._tb(s, x, 5.55, colw - .3, .8, it[0], 36, '#F2B8B1', bold=True)
                self._tb(s, x, 6.35, colw - .35, .7, it[1], 12, '#CBD3D8',
                         line=1.2, label=True)
        self._src(s, src, '#A9B2B8'); self._notes(s, notes)
        return s

    def duo(self, title, left, right, notes='', src=None, sub=None):
        """Два кадра рядом с крупным числом на каждом — раскладка «контраст»."""
        s = self._slide(bg='#16181B')
        half = W / 2
        for i, (img, num, cap, unit) in enumerate((left, right)):
            x = half * i
            self._cover(s, img, x, 0, half, H)
            v = s.shapes.add_shape(1, Inches(x), Inches(H * .42),
                                   Inches(half), Inches(H * .58))
            v.fill.solid(); v.fill.fore_color.rgb = rgb('#0A0C0E')
            v.line.fill.background(); v.shadow.inherit = False
            _transparency(v, 28)
            self._tb(s, x + .42, 4.85, half - .9, .9, num, 40, '#FFFFFF', bold=True)
            self._tb(s, x + .42, 5.62, half - 1.0, .7, cap, 13, '#E8EAEC', line=1.2)
            self._tb(s, x + .42, 6.12, half - 1.0, .4, unit, 12, '#F2B8B1',
                     mono=True, label=True)
        band = s.shapes.add_shape(1, 0, 0, self.p.slide_width,
                                  Inches(2.3 if sub else 1.5))
        band.fill.solid(); band.fill.fore_color.rgb = rgb('#0A0C0E')
        band.line.fill.background(); band.shadow.inherit = False
        _transparency(band, 22)
        self._tb(s, PAD, .42, W - PAD * 2, .9, title, 26, '#FFFFFF', bold=True)
        if sub:
            self._tb(s, PAD, 1.22, W - PAD * 2 - 1.0, .9, sub, 14, '#DDE3E6',
                     line=1.3)
        self._src(s, src, '#A9B2B8'); self._notes(s, notes)
        return s

    # ── картинки ─────────────────────────────────────────────────────────
    def _cover(self, s, img, x, y, w, h):
        """Заполнить область кадром без искажения — аналог object-fit: cover.

        В pptx нет обрезки по рамке: картинка, вылезающая за свой блок, не
        прячется, а ложится на соседний слайдовый объект. Поэтому кроп
        считается заранее и в файл кладётся уже обрезанное изображение.
        """
        from PIL import Image
        im = Image.open(img)
        iw, ih = im.size
        want = w / h
        have = iw / ih
        if have > want:                     # шире нужного — режем по бокам
            nw = int(ih * want)
            box = ((iw - nw) // 2, 0, (iw - nw) // 2 + nw, ih)
        else:                               # выше нужного — режем сверху и снизу
            nh = int(iw / want)
            box = (0, (ih - nh) // 2, iw, (ih - nh) // 2 + nh)
        if box != (0, 0, iw, ih):
            cache = pathlib.Path(img).parent / '_crop'
            cache.mkdir(exist_ok=True)
            out = cache / (pathlib.Path(img).stem +
                           f'-{box[0]}-{box[1]}-{box[2]}-{box[3]}.jpg')
            if not out.exists():
                im.convert('RGB').crop(box).save(out, quality=88)
            img = str(out)
        s.shapes.add_picture(img, Inches(x), Inches(y), Inches(w), Inches(h))

    def _veil(self, s, mid, top=2.9):
        """Тень под текстом. На слайде с текстом по центру нужна ровная вуаль:
        градиент снизу оставляет заголовок на самом светлом месте кадра."""
        if mid:
            v = s.shapes.add_shape(1, 0, 0, self.p.slide_width, self.p.slide_height)
            v.fill.solid(); v.fill.fore_color.rgb = rgb('#080A0C')
            v.line.fill.background(); v.shadow.inherit = False
            _transparency(v, 18)
        else:
            # Градиентную заливку pptx умеет, но прозрачность её стопов
            # приходится дописывать в XML, а проверить результат без
            # PowerPoint нечем. Три крупных слоя давали видимую полосу на
            # стыке, поэтому берём много тонких: каждый идёт до низа кадра,
            # и накопленная плотность складывается в ровную растяжку.
            N, START, STEP = 20, max(1.2, top), 11
            for i in range(N):
                top = START + (H - START) * i / N
                v = s.shapes.add_shape(1, 0, Inches(top), self.p.slide_width,
                                       Inches(H - top))
                v.fill.solid(); v.fill.fore_color.rgb = rgb('#080A0C')
                v.line.fill.background(); v.shadow.inherit = False
                _transparency(v, 100 - STEP)

    def save(self, path):
        self.p.save(path)
        return path


def _transparency(shape, pct):
    """python-pptx не умеет прозрачность заливки — дописываем в XML."""
    from pptx.oxml.ns import qn
    fill = shape.fill._xPr.find(qn('a:solidFill'))
    clr = fill.find(qn('a:srgbClr'))
    alpha = clr.makeelement(qn('a:alpha'), {'val': str(int((100 - pct) * 1000))})
    clr.append(alpha)
