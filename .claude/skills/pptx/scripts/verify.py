# -*- coding: utf-8 -*-
"""Проверка .pptx перед сдачей.

    python3 verify.py deck.pptx

Ловит то, что видно только на проекторе и уже поздно: холст не 16:9,
мелкий кегль, слайд без заголовка, текст за границей холста, слайд без
заметок докладчика и подозрительно длинный текст в узком блоке.

Рендер здесь не делается намеренно: LibreOffice в неинтерактивных средах
уходит в таймаут даже на трёх ячейках, поэтому проверки геометрические.
"""
import sys
from pptx import Presentation
from pptx.util import Emu

MIN_LABEL_PT = 10    # метки: 20 px кадра 1920×1080
MIN_PT = 12          # основной текст: 24 px кадра, как в скилле deck
# Средняя ширина знака в Arial — около 0,5 em, у полужирного чуть больше.
# Первая версия проверки считала по «знаков на дюйм при 14 pt» и ругалась
# на крупные числа: 0,5 em даёт ту же оценку для любого кегля.
EM_AVG, EM_BOLD = .50, .53


def main():
    prs = Presentation(sys.argv[1])
    W, H = prs.slide_width, prs.slide_height
    out = []
    if abs(W / H - 16 / 9) > .02:
        out.append((0, 'холст', f'{W/914400:.2f}×{H/914400:.2f}″ — не 16:9'))

    for i, s in enumerate(prs.slides, 1):
        texts = []
        biggest = 0
        for sh in s.shapes:
            if sh.left is None:
                continue
            if sh.left < -Emu(1) or sh.top < -Emu(1) or \
               sh.left + sh.width > W + Emu(9144) or sh.top + sh.height > H + Emu(9144):
                if sh.has_text_frame and sh.text_frame.text.strip():
                    out.append((i, 'за холстом',
                                sh.text_frame.text.strip()[:40]))
            if not sh.has_text_frame:
                continue
            is_label = sh.name == 'label'
            for p in sh.text_frame.paragraphs:
                for r in p.runs:
                    if not r.text.strip():
                        continue
                    pt = r.font.size.pt if r.font.size else 18
                    texts.append((pt, r.text.strip(), sh, bool(r.font.bold)))
                    if not is_label:
                        biggest = max(biggest, pt)
                    floor = MIN_LABEL_PT if is_label else MIN_PT
                    if pt < floor:
                        out.append((i, 'мелкий кегль',
                                    f'{pt:.0f} pt: {r.text.strip()[:40]}'))
        if not texts:
            out.append((i, 'пустой слайд', '—'))
            continue
        if biggest < 22:
            out.append((i, 'нет заголовка',
                        f'самый крупный текст {biggest:.0f} pt'))
        if not s.has_notes_slide or not s.notes_slide.notes_text_frame.text.strip():
            out.append((i, 'нет заметок', 'выступающему не на что опереться'))
        # Прикидка переполнения: сколько знаков влезает в блок при его кегле.
        for pt, txt, sh, bold in texts:
            w_in = sh.width / 914400
            h_in = sh.height / 914400
            if w_in < .3 or h_in < .1:
                continue
            adv = (EM_BOLD if bold else EM_AVG) * pt / 72      # дюймов на знак
            per_line = max(1, int(w_in / adv))
            lines = -(-len(txt) // per_line)
            need = lines * pt * 1.3 / 72
            if need > h_in * 1.35:
                out.append((i, 'текст не влезает',
                            f'{len(txt)} знаков в блок {w_in:.1f}×{h_in:.1f}″: '
                            + txt[:34]))

    print(f'слайдов: {len(prs.slides)}')
    print(f'холст: {W/914400:.2f}×{H/914400:.2f}″')
    print(f'время выступления при 1,5–2 мин на слайд: '
          f'{len(prs.slides)*1.5:.0f}–{len(prs.slides)*2:.0f} мин')
    if not out:
        print('\nзамечаний нет')
        return
    by = {}
    for n, kind, det in out:
        by.setdefault(kind, []).append((n, det))
    print(f'\nзамечаний: {len(out)}')
    for kind, lst in sorted(by.items(), key=lambda t: -len(t[1])):
        print(f'\n  {kind} — {len(lst)}')
        for n, det in lst[:8]:
            print(f'     слайд {n}: {det}')
        if len(lst) > 8:
            print(f'     … ещё {len(lst)-8}')


if __name__ == '__main__':
    main()
