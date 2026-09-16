# -*- coding: utf-8 -*-
"""
Генератор архитектурных планов по СПДС.

МОДЕЛЬ В МИЛЛИМЕТРАХ НАТУРЫ, ЛИСТ В МИЛЛИМЕТРАХ БУМАГИ.
Все координаты, которые вы задаёте, — настоящие миллиметры объекта.
Перевод в лист делает сам генератор делением на масштаб, поэтому толщины
линий и кегль шрифта здесь — честные миллиметры бумаги: 0,6 мм останется
0,6 мм и при 1:50, и при 1:200. Это избавляет от самой частой ошибки,
когда линии оказываются либо волосяными, либо в палец толщиной.

API

    p = Plan(scale=100, title='План офиса', obj='ул. Примерная, 1')

    i = p.wall((0, 0), (8400, 0), 250)     # ось от точки до точки, толщина
    p.opening(i, 1200, 1800, 'window')     # в стене i, 1200 от её начала
    p.opening(i, 5000, 900, 'door', side=+1, hinge='start')

    p.room([(0,0), (8400,0), (8400,6000), (0,6000)], 1, 'Открытый офис')

    p.dim_chain_x([0, 1200, 3000, 8400], y=0, level=1)   # уровень 1, 2, 3
    p.dim_chain_y([0, 6000], x=0, level=1)
    p.axis_x(0, 'А'); p.axis_x(8400, 'Б')

    print(p.check())                        # список замечаний, пустой — хорошо
    p.render('plan.svg')

Стены только горизонтальные и вертикальные: этого хватает почти для любого
офиса, а наклонные потребовали бы аккуратной обработки углов, которую лучше
делать руками, чем получить незаметно кривой стык.
"""

from math import hypot

# ── толщины линий и кегли, миллиметры бумаги ───────────────────────────────
W_WALL, W_THIN, W_DIM, W_AXIS = 0.6, 0.3, 0.2, 0.2
F_DIM, F_ROOM, F_NAME, F_TITLE = 2.5, 2.5, 3.5, 5.0
TICK = 3.0                    # длина засечки
DIM_STEP = 8.0                # шаг между размерными цепочками
DIM_FIRST = 12.0              # отступ первой цепочки от контура
SHEETS = {'A4': (297, 210), 'A3': (420, 297), 'A2': (594, 420), 'A1': (841, 594)}


def _fmt(v):
    return f'{v:.0f}' if abs(v - round(v)) < 0.5 else f'{v:.0f}'


def _area(pts):
    """Площадь многоугольника в м², формула площадей."""
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2 / 1_000_000


class Wall:
    def __init__(self, p1, p2, t):
        self.p1, self.p2, self.t = p1, p2, t
        self.horizontal = abs(p1[1] - p2[1]) < 1e-6
        if not self.horizontal and abs(p1[0] - p2[0]) > 1e-6:
            raise ValueError('стена должна быть горизонтальной или вертикальной')
        self.length = hypot(p2[0] - p1[0], p2[1] - p1[1])
        self.openings = []

    def at(self, s):
        """Точка на осевой на расстоянии s от начала."""
        if self.horizontal:
            sign = 1 if self.p2[0] > self.p1[0] else -1
            return (self.p1[0] + sign * s, self.p1[1])
        sign = 1 if self.p2[1] > self.p1[1] else -1
        return (self.p1[0], self.p1[1] + sign * s)


class Plan:
    STD_SCALES = (20, 25, 50, 100, 200, 500)

    def __init__(self, scale='auto', title='', obj='', sheet='A3',
                 stage='Эскиз', author='', note=''):
        self.scale, self.title, self.obj = scale, title, obj
        self.stage, self.author, self.note = stage, author, note
        self.sw, self.sh = SHEETS[sheet]
        self.walls, self.rooms, self.dims, self.axes, self.marks = [], [], [], [], []
        self.notes = []

    # ── набор модели ───────────────────────────────────────────────────────
    def wall(self, p1, p2, t=100):
        self.walls.append(Wall(p1, p2, t))
        return len(self.walls) - 1

    def opening(self, wall_i, offset, width, kind='door', side=None,
                hinge='start', toward=None):
        """Проём в стене.

        Сторону открывания двери лучше задавать параметром toward — точкой
        внутри того помещения, в которое дверь распахивается. Знак side тоже
        работает, но в нём легко ошибиться и заметить это только на картинке,
        а дверь, открытая не в ту сторону, — ошибка, по которой закажут
        не ту коробку.
        """
        w = self.walls[wall_i]
        if toward is not None:
            mid = w.at(offset + width / 2)
            if w.horizontal:
                side = 1 if toward[1] > mid[1] else -1
            else:
                side = 1 if toward[0] > mid[0] else -1
        elif side is None:
            side = 1
        if offset < 0 or offset + width > w.length + 1e-6:
            raise ValueError(f'проём выходит за стену {wall_i}: '
                             f'{offset}+{width} > {w.length:.0f}')
        w.openings.append(dict(o=offset, w=width, kind=kind, side=side, hinge=hinge))
        return self

    def room(self, pts, num, name):
        self.rooms.append(dict(pts=pts, num=num, name=name, area=_area(pts)))
        return self

    def dim_chain_x(self, xs, y, level=1, below=True):
        self.dims.append(dict(axis='x', vals=sorted(xs), at=y, level=level, below=below))
        return self

    def dim_chain_y(self, ys, x, level=1, left=True):
        self.dims.append(dict(axis='y', vals=sorted(ys), at=x, level=level, below=left))
        return self

    def axis_x(self, x, label, y_from=None):
        self.axes.append(dict(axis='x', v=x, label=label, base=y_from))
        return self

    def axis_y(self, y, label, x_from=None):
        self.axes.append(dict(axis='y', v=y, label=label, base=x_from))
        return self

    def note_block(self, items):
        """Примечания к чертежу — нумерованным списком в поле листа.

        Всё, что нужно сказать словами (принятые допущения, что подлежит
        уточнению, откуда взяты размеры), должно стоять здесь, а не выноской
        посреди помещения: выноска в пустоту читается как ошибка вёрстки,
        а на чертеже по фотографиям таких оговорок обычно несколько.
        """
        self.notes = list(items)
        return self

    def mark(self, xy, text):
        """Выноска с текстом — для пометок вроде «размер уточнить»."""
        self.marks.append(dict(xy=xy, text=text))
        return self

    # ── проверки ───────────────────────────────────────────────────────────
    def check(self):
        out = []
        for i, w in enumerate(self.walls):
            ops = sorted(w.openings, key=lambda o: o['o'])
            for a, b in zip(ops, ops[1:]):
                if a['o'] + a['w'] > b['o'] + 1e-6:
                    out.append(f'стена {i}: проёмы перекрываются на {a["o"]}')
                elif b['o'] - (a['o'] + a['w']) < 50:
                    out.append(f'стена {i}: простенок меньше 50 мм между проёмами')
            for o in ops:
                if o['o'] < 50 or w.length - (o['o'] + o['w']) < 50:
                    out.append(f'стена {i}: проём вплотную к концу стены')
        for d in self.dims:
            v = d['vals']
            if len(v) < 2:
                out.append('размерная цепочка из одной точки')
            elif abs(sum(b - a for a, b in zip(v, v[1:])) - (v[-1] - v[0])) > 1:
                out.append('сумма участков цепочки не равна габариту')
        if self.rooms:
            bb = self._bbox()
            gross = (bb[2] - bb[0]) * (bb[3] - bb[1]) / 1_000_000
            net = sum(r['area'] for r in self.rooms)
            if net > gross * 1.001:
                out.append(f'площади помещений {net:.1f} больше габарита {gross:.1f}')
        if not self.dims:
            out.append('нет ни одной размерной цепочки')
        if not self.rooms:
            out.append('нет ни одного помещения с площадью')
        bb = self._bbox()
        for i, w in enumerate(self.walls):
            for o in w.openings:
                if o['kind'] != 'door':
                    continue
                mid = w.at(o['o'] + o['w'] / 2)
                if w.horizontal:
                    py = mid[1] + o['side'] * o['w']
                    out_of = py < bb[1] - 1 or py > bb[3] + 1
                else:
                    px = mid[0] + o['side'] * o['w']
                    out_of = px < bb[0] - 1 or px > bb[2] + 1
                if out_of:
                    out.append(f'стена {i}: дверь на отметке {o["o"]:.0f} '
                               f'открывается за габарит плана — проверьте сторону')
        if getattr(self, '_fits', True) is False:
            out.append('чертёж не помещается на лист: возьмите лист крупнее '
                       'или масштаб мельче')
        return out

    def _bbox(self):
        xs, ys = [], []
        for w in self.walls:
            for p in (w.p1, w.p2):
                xs.append(p[0]); ys.append(p[1])
        return min(xs), min(ys), max(xs), max(ys)

    # ── отрисовка ──────────────────────────────────────────────────────────
    def render(self, path):
        svg = self._svg()
        with open(path, 'w', encoding='utf-8') as f:
            f.write(svg)
        return path

    def _region(self):
        """Прямоугольник листа, доступный под сам чертёж, в миллиметрах бумаги.
        Слева и снизу вычтено поле под размерные цепочки и оси, снизу справа —
        под штамп с экспликацией."""
        pad_l, pad_b, pad_t, pad_r = 40, 40, 14, 14
        return (25 + pad_l, 8 + pad_t,
                self.sw - 25 - pad_r, self.sh - 5 - 55 - 10 - pad_b)

    def _pick_scale(self):
        """Масштаб выбирается самым крупным из стандартного ряда, при котором
        чертёж ещё влезает. Иначе получается план в четверть листа: формально
        верный, а читать неудобно и печатать жалко."""
        bb = self._bbox()
        x0, y0, x1, y1 = self._region()
        for sc in self.STD_SCALES:
            if (bb[2] - bb[0]) / sc <= x1 - x0 and (bb[3] - bb[1]) / sc <= y1 - y0:
                return sc
        return self.STD_SCALES[-1]

    def _svg(self):
        if self.scale == 'auto':
            self.scale = self._pick_scale()
        k = 1.0 / self.scale
        bb = self._bbox()
        w_mm = (bb[2] - bb[0]) * k
        h_mm = (bb[3] - bb[1]) * k
        # Поле вокруг чертежа: слева и снизу под размерные цепочки и оси,
        # сверху и справа — просто воздух. Штамп стоит внизу справа,
        # экспликация над ним, поэтому нижнюю границу поднимаем.
        x0, y0, x1, y1 = self._region()
        ox = x0 + max(0, (x1 - x0 - w_mm) / 2)
        oy = y0 + max(0, (y1 - y0 - h_mm) / 2)
        self._fits = (w_mm <= x1 - x0) and (h_mm <= y1 - y0)

        def X(x): return ox + (x - bb[0]) * k
        def Y(y): return oy + h_mm - (y - bb[1]) * k   # ось Y вверх

        g = [f'<?xml version="1.0" encoding="UTF-8"?>',
             f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.sw}mm" '
             f'height="{self.sh}mm" viewBox="0 0 {self.sw} {self.sh}">',
             '<rect width="100%" height="100%" fill="#fff"/>',
             '<g font-family="Arial, Helvetica, sans-serif" fill="#000">']
        g.append(self._frame())
        for w in self.walls:
            g.append(self._wall_svg(w, X, Y, k))
        for r in self.rooms:
            g.append(self._room_svg(r, X, Y))
        for d in self.dims:
            g.append(self._dim_svg(d, X, Y, bb))
        for a in self.axes:
            g.append(self._axis_svg(a, X, Y, bb))
        for m in self.marks:
            g.append(self._mark_svg(m, X, Y))
        g.append(self._notes())
        g.append(self._explication())
        g.append(self._title_block())
        g.append('</g></svg>')
        return '\n'.join(x for x in g if x)

    def _frame(self):
        return (f'<rect x="20" y="5" width="{self.sw-25}" height="{self.sh-10}" '
                f'fill="none" stroke="#000" stroke-width="{W_WALL}"/>')

    def _wall_svg(self, w, X, Y, k):
        t = w.t * k / 2
        out = []
        segs, cur = [], 0.0
        for o in sorted(w.openings, key=lambda o: o['o']):
            if o['o'] > cur:
                segs.append((cur, o['o']))
            cur = o['o'] + o['w']
        if cur < w.length:
            segs.append((cur, w.length))

        for a, b in segs:
            p1, p2 = w.at(a), w.at(b)
            if w.horizontal:
                x1, x2 = sorted([X(p1[0]), X(p2[0])])
                y1, y2 = Y(p1[1]) - t, Y(p1[1]) + t
            else:
                y1, y2 = sorted([Y(p1[1]), Y(p2[1])])
                x1, x2 = X(p1[0]) - t, X(p1[0]) + t
            out.append(f'<rect x="{x1:.3f}" y="{y1:.3f}" width="{x2-x1:.3f}" '
                       f'height="{y2-y1:.3f}" fill="#1b1b1b" stroke="#000" '
                       f'stroke-width="{W_WALL}"/>')

        for o in sorted(w.openings, key=lambda o: o['o']):
            out.append(self._opening_svg(w, o, X, Y, k))
        return ''.join(out)

    def _opening_svg(self, w, o, X, Y, k):
        t = w.t * k / 2
        a, b = w.at(o['o']), w.at(o['o'] + o['w'])
        out = []
        if w.horizontal:
            x1, x2 = sorted([X(a[0]), X(b[0])])
            yc = Y(a[1])
            box = (x1, yc - t, x2 - x1, 2 * t)
        else:
            y1, y2 = sorted([Y(a[1]), Y(b[1])])
            xc = X(a[0])
            box = (xc - t, y1, 2 * t, y2 - y1)

        if o['kind'] == 'window':
            # проём: контур тонкой линией плюс линия остекления по центру
            out.append(f'<rect x="{box[0]:.3f}" y="{box[1]:.3f}" width="{box[2]:.3f}" '
                       f'height="{box[3]:.3f}" fill="#fff" stroke="#000" '
                       f'stroke-width="{W_THIN}"/>')
            if w.horizontal:
                yc2 = box[1] + box[3] / 2
                out.append(f'<line x1="{box[0]:.3f}" y1="{yc2:.3f}" x2="{box[0]+box[2]:.3f}" '
                           f'y2="{yc2:.3f}" stroke="#000" stroke-width="{W_THIN}"/>')
            else:
                xc2 = box[0] + box[2] / 2
                out.append(f'<line x1="{xc2:.3f}" y1="{box[1]:.3f}" x2="{xc2:.3f}" '
                           f'y2="{box[1]+box[3]:.3f}" stroke="#000" stroke-width="{W_THIN}"/>')
            return ''.join(out)

        # дверь: пустой проём, полотно и дуга открывания
        out.append(f'<rect x="{box[0]:.3f}" y="{box[1]:.3f}" width="{box[2]:.3f}" '
                   f'height="{box[3]:.3f}" fill="#fff" stroke="none"/>')
        for pt in (a, b):                                   # притолоки
            if w.horizontal:
                out.append(f'<line x1="{X(pt[0]):.3f}" y1="{Y(pt[1])-t:.3f}" '
                           f'x2="{X(pt[0]):.3f}" y2="{Y(pt[1])+t:.3f}" '
                           f'stroke="#000" stroke-width="{W_THIN}"/>')
            else:
                out.append(f'<line x1="{X(pt[0])-t:.3f}" y1="{Y(pt[1]):.3f}" '
                           f'x2="{X(pt[0])+t:.3f}" y2="{Y(pt[1]):.3f}" '
                           f'stroke="#000" stroke-width="{W_THIN}"/>')

        hinge = a if o['hinge'] == 'start' else b
        r = o['w'] * k
        hx, hy = X(hinge[0]), Y(hinge[1])
        s = o['side']
        if w.horizontal:
            dx = r if (o['hinge'] == 'start') == (X(b[0]) > X(a[0])) else -r
            lx, ly = hx, hy - s * r
            sweep = 1 if (dx > 0) == (s > 0) else 0
            out.append(f'<path d="M {hx+dx:.3f} {hy:.3f} A {r:.3f} {r:.3f} 0 0 {sweep} '
                       f'{lx:.3f} {ly:.3f}" fill="none" stroke="#000" '
                       f'stroke-width="{W_DIM}"/>')
            out.append(f'<line x1="{hx:.3f}" y1="{hy:.3f}" x2="{lx:.3f}" y2="{ly:.3f}" '
                       f'stroke="#000" stroke-width="{W_THIN}"/>')
        else:
            dy = r if (o['hinge'] == 'start') == (Y(b[1]) > Y(a[1])) else -r
            lx, ly = hx + s * r, hy
            sweep = 0 if (dy > 0) == (s > 0) else 1
            out.append(f'<path d="M {hx:.3f} {hy+dy:.3f} A {r:.3f} {r:.3f} 0 0 {sweep} '
                       f'{lx:.3f} {ly:.3f}" fill="none" stroke="#000" '
                       f'stroke-width="{W_DIM}"/>')
            out.append(f'<line x1="{hx:.3f}" y1="{hy:.3f}" x2="{lx:.3f}" y2="{ly:.3f}" '
                       f'stroke="#000" stroke-width="{W_THIN}"/>')
        return ''.join(out)

    def _room_svg(self, r, X, Y):
        xs = [p[0] for p in r['pts']]; ys = [p[1] for p in r['pts']]
        cx = X(sum(xs) / len(xs)); cy = Y(sum(ys) / len(ys))
        a = f'{r["area"]:.2f}'.replace('.', ',')
        wdt = len(a) * F_ROOM * 0.58
        return (f'<circle cx="{cx:.2f}" cy="{cy-4.6:.2f}" r="2.6" fill="#fff" '
                f'stroke="#000" stroke-width="{W_THIN}"/>'
                f'<text x="{cx:.2f}" y="{cy-3.7:.2f}" font-size="{F_DIM}" '
                f'text-anchor="middle">{r["num"]}</text>'
                f'<text x="{cx:.2f}" y="{cy+1.4:.2f}" font-size="{F_ROOM}" '
                f'text-anchor="middle">{r["name"]}</text>'
                f'<text x="{cx:.2f}" y="{cy+5.6:.2f}" font-size="{F_ROOM}" '
                f'text-anchor="middle">{a}</text>'
                f'<line x1="{cx-wdt/2:.2f}" y1="{cy+6.4:.2f}" x2="{cx+wdt/2:.2f}" '
                f'y2="{cy+6.4:.2f}" stroke="#000" stroke-width="{W_DIM}"/>')

    def _dim_svg(self, d, X, Y, bb):
        k = 1.0 / self.scale
        off = DIM_FIRST + (d['level'] - 1) * DIM_STEP
        out = []
        if d['axis'] == 'x':
            yl = Y(bb[1]) + off if d['below'] else Y(bb[3]) - off
            ybase = Y(d['at'])
            out.append(f'<line x1="{X(d["vals"][0]):.2f}" y1="{yl:.2f}" '
                       f'x2="{X(d["vals"][-1]):.2f}" y2="{yl:.2f}" stroke="#000" '
                       f'stroke-width="{W_DIM}"/>')
            for v in d['vals']:
                x = X(v)
                out.append(f'<line x1="{x:.2f}" y1="{ybase:.2f}" x2="{x:.2f}" '
                           f'y2="{yl+2:.2f}" stroke="#000" stroke-width="{W_DIM}"/>')
                out.append(f'<line x1="{x-TICK/2:.2f}" y1="{yl+TICK/2:.2f}" '
                           f'x2="{x+TICK/2:.2f}" y2="{yl-TICK/2:.2f}" stroke="#000" '
                           f'stroke-width="{W_WALL}"/>')
            for a, b in zip(d['vals'], d['vals'][1:]):
                out.append(f'<text x="{(X(a)+X(b))/2:.2f}" y="{yl-1.2:.2f}" '
                           f'font-size="{F_DIM}" text-anchor="middle">{_fmt(b-a)}</text>')
        else:
            xl = X(bb[0]) - off if d['below'] else X(bb[2]) + off
            xbase = X(d['at'])
            out.append(f'<line x1="{xl:.2f}" y1="{Y(d["vals"][0]):.2f}" x2="{xl:.2f}" '
                       f'y2="{Y(d["vals"][-1]):.2f}" stroke="#000" stroke-width="{W_DIM}"/>')
            for v in d['vals']:
                y = Y(v)
                out.append(f'<line x1="{xbase:.2f}" y1="{y:.2f}" x2="{xl-2:.2f}" '
                           f'y2="{y:.2f}" stroke="#000" stroke-width="{W_DIM}"/>')
                out.append(f'<line x1="{xl-TICK/2:.2f}" y1="{y+TICK/2:.2f}" '
                           f'x2="{xl+TICK/2:.2f}" y2="{y-TICK/2:.2f}" stroke="#000" '
                           f'stroke-width="{W_WALL}"/>')
            for a, b in zip(d['vals'], d['vals'][1:]):
                ym = (Y(a) + Y(b)) / 2
                out.append(f'<text x="{xl-1.2:.2f}" y="{ym:.2f}" font-size="{F_DIM}" '
                           f'text-anchor="middle" transform="rotate(-90 {xl-1.2:.2f} '
                           f'{ym:.2f})">{_fmt(b-a)}</text>')
        return ''.join(out)

    def _axis_svg(self, a, X, Y, bb):
        R = 3.0
        if a['axis'] == 'x':
            x = X(a['v']); y = Y(bb[1]) + DIM_FIRST + 3 * DIM_STEP
            line = (f'<line x1="{x:.2f}" y1="{Y(bb[3]):.2f}" x2="{x:.2f}" y2="{y-R:.2f}" '
                    f'stroke="#000" stroke-width="{W_AXIS}" stroke-dasharray="6 1.5 1 1.5"/>')
        else:
            y = Y(a['v']); x = X(bb[0]) - DIM_FIRST - 3 * DIM_STEP
            line = (f'<line x1="{X(bb[2]):.2f}" y1="{y:.2f}" x2="{x+R:.2f}" y2="{y:.2f}" '
                    f'stroke="#000" stroke-width="{W_AXIS}" stroke-dasharray="6 1.5 1 1.5"/>')
        return (line + f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{R}" fill="#fff" '
                f'stroke="#000" stroke-width="{W_THIN}"/>'
                f'<text x="{x:.2f}" y="{y+1.2:.2f}" font-size="{F_DIM}" '
                f'text-anchor="middle">{a["label"]}</text>')

    def _mark_svg(self, m, X, Y):
        x, y = X(m['xy'][0]), Y(m['xy'][1])
        return (f'<line x1="{x:.2f}" y1="{y:.2f}" x2="{x+10:.2f}" y2="{y-8:.2f}" '
                f'stroke="#000" stroke-width="{W_DIM}"/>'
                f'<line x1="{x+10:.2f}" y1="{y-8:.2f}" x2="{x+26:.2f}" y2="{y-8:.2f}" '
                f'stroke="#000" stroke-width="{W_DIM}"/>'
                f'<text x="{x+10:.2f}" y="{y-9:.2f}" font-size="{F_DIM}">{m["text"]}</text>')

    def _notes(self):
        if not self.notes:
            return ''
        x, y = 27, self.sh - 5 - 8 - 4.6 * len(self.notes)
        out = [f'<text x="{x}" y="{y-4:.1f}" font-size="{F_DIM}" '
               f'font-weight="bold">Примечания</text>']
        for i, t in enumerate(self.notes):
            out.append(f'<text x="{x}" y="{y + i*4.6:.1f}" font-size="{F_DIM}">'
                       f'{i+1}. {t}</text>')
        return ''.join(out)

    def _explication(self):
        if not self.rooms:
            return ''
        h_row = 5.0
        height = (len(self.rooms) + 1) * h_row + 7
        x = self.sw - 25 - 90
        y = self.sh - 5 - 55 - 6 - height + 7
        rows = [('№', 'Наименование', 'Пл., м²')] + [
            (str(r['num']), r['name'], f'{r["area"]:.2f}'.replace('.', ','))
            for r in self.rooms]
        h = h_row
        out = [f'<text x="{x:.1f}" y="{y-2:.1f}" font-size="{F_DIM}">'
               f'Экспликация помещений</text>']
        for i, (a, b, c) in enumerate(rows):
            yy = y + i * h
            bold = ' font-weight="bold"' if i == 0 else ''
            out.append(f'<rect x="{x:.1f}" y="{yy:.1f}" width="90" height="{h}" '
                       f'fill="none" stroke="#000" stroke-width="{W_DIM}"/>')
            out.append(f'<line x1="{x+10:.1f}" y1="{yy:.1f}" x2="{x+10:.1f}" '
                       f'y2="{yy+h:.1f}" stroke="#000" stroke-width="{W_DIM}"/>')
            out.append(f'<line x1="{x+72:.1f}" y1="{yy:.1f}" x2="{x+72:.1f}" '
                       f'y2="{yy+h:.1f}" stroke="#000" stroke-width="{W_DIM}"/>')
            out.append(f'<text x="{x+5:.1f}" y="{yy+3.5:.1f}" font-size="{F_DIM}" '
                       f'text-anchor="middle"{bold}>{a}</text>')
            out.append(f'<text x="{x+12:.1f}" y="{yy+3.5:.1f}" font-size="{F_DIM}"{bold}>{b}</text>')
            out.append(f'<text x="{x+81:.1f}" y="{yy+3.5:.1f}" font-size="{F_DIM}" '
                       f'text-anchor="middle"{bold}>{c}</text>')
        total = f'{sum(r["area"] for r in self.rooms):.2f}'.replace('.', ',')
        yy = y + len(rows) * h
        out.append(f'<text x="{x:.1f}" y="{yy+3.5:.1f}" font-size="{F_DIM}" '
                   f'font-weight="bold">Итого {total} м\u00b2</text>')
        return ''.join(out)

    def _title_block(self):
        """Основная надпись, форма 3 по ГОСТ Р 21.101: 185 x 55 мм."""
        w, h = 185.0, 55.0
        x, y = self.sw - 25 - w, self.sh - 5 - h
        o = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" '
             f'stroke="#000" stroke-width="{W_WALL}"/>']
        for yy in (15, 30, 40):
            o.append(f'<line x1="{x}" y1="{y+yy}" x2="{x+w}" y2="{y+yy}" '
                     f'stroke="#000" stroke-width="{W_DIM}"/>')
        o.append(f'<line x1="{x+120}" y1="{y}" x2="{x+120}" y2="{y+h}" '
                 f'stroke="#000" stroke-width="{W_DIM}"/>')
        o.append(f'<text x="{x+3}" y="{y+9}" font-size="{F_DIM}">{self.obj}</text>')
        o.append(f'<text x="{x+3}" y="{y+24}" font-size="{F_NAME}" '
                 f'font-weight="bold">{self.title}</text>')
        o.append(f'<text x="{x+3}" y="{y+37}" font-size="{F_DIM}">'
                 f'Масштаб 1:{self.scale}</text>')
        o.append(f'<text x="{x+3}" y="{y+48}" font-size="{F_DIM}">{self.note}</text>')
        o.append(f'<text x="{x+123}" y="{y+9}" font-size="{F_DIM}">Стадия</text>')
        o.append(f'<text x="{x+123}" y="{y+24}" font-size="{F_NAME}">{self.stage}</text>')
        o.append(f'<text x="{x+123}" y="{y+37}" font-size="{F_DIM}">Разработал</text>')
        o.append(f'<text x="{x+123}" y="{y+48}" font-size="{F_DIM}">{self.author}</text>')
        return ''.join(o)
