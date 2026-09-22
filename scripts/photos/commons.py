# -*- coding: utf-8 -*-
"""Загрузка фотографий с Викисклада по списку тем.

    python3 scripts/photos/commons.py photos/deck            все темы
    python3 scripts/photos/commons.py photos/deck metro=3    для метро — третий кандидат
    python3 scripts/photos/commons.py photos/deck --only village business
    python3 scripts/photos/commons.py --list

Викисклад выбран по двум причинам: не нужен ключ и все файлы под
свободными лицензиями, а для учебной презентации важно, что автора и
лицензию можно выписать на слайд. Авторы пишутся в CREDITS.txt рядом
с кадрами.

Запросы подобраны под названия файлов Викисклада, а не под обычный поиск
картинок: у него другой корпус, и общий запрос вроде «Moscow» отдаёт
карты и гербы.
"""
import json, pathlib, re, sys, time, urllib.parse, urllib.request

API = 'https://commons.wikimedia.org/w/api.php'
UA = 'propto-deck-photos/1.0 (https://github.com/arorlov93/ProID)'
MIN_W = 1500
MIN_RATIO = 1.25          # только горизонтальные: слайд 16:9

# Поиск Викисклада ранжирует по тексту описания, а не по содержанию кадра,
# поэтому на «Moscow International Business Center» первым приходит снимок
# пустого зала на 40-м этаже, а на «izba» — сарай изнутри. Дешевле всего
# это лечится отсевом по названию файла.
BAN = ('interior', 'inside', 'indoor', ' hall', 'floor', 'room', 'stairs',
       'plan', 'map', 'diagram', 'scheme', 'coat of arms', 'logo', 'sign',
       'construction', 'scaffold', 'under repair')

# slug → (запросы по убыванию точности, запрещённые слова в названии,
# обязательные слова). Обязательные нужны потому, что поиск ранжирует по
# всему описанию файла: на «Red Square Moscow night» первым пришёл трамвай
# на Тверской Заставе — в описании есть слово Moscow, и этого хватило.
SHOTS = {
    'red-square': (['Red Square Moscow panorama',
                    'Red Square Moscow night',
                    "Saint Basil's Cathedral Red Square"],
                   ('gum ', 'parade', 'mausoleum', 'tver'),
                   ('red square', 'krasnaya', 'basil', 'kremlin')),
    'st-basil': (["Saint Basil's Cathedral domes",
                  "Saint Basil's Cathedral Moscow",
                  'Pokrovsky Cathedral Moscow'],
                 (), ('basil', 'pokrov', 'vasil')),
    'metro': (['Komsomolskaya metro station Moscow',
               'Mayakovskaya metro station Moscow',
               'Moscow Metro station platform'],
              ('train', 'carriage'), ('metro',)),
    'baikal': (['Lake Baikal ice winter', 'Lake Baikal landscape', 'Baikal lake'],
               (), ('baikal',)),
    'market': (['Russian supermarket vegetables shelves',
                'grocery store produce shelves',
                'farmers market vegetables stall'],
               ('empty',),
               ('supermarket', 'superbazaro', 'market', 'bazar', 'magnit', 'grocery')),
    'business': (['Moscow City skyscrapers panorama day',
                  'Moscow International Business Center panorama',
                  'Moskva City towers'],
                 ('space', 'lobby', 'view from'),
                 ('moscow city', 'moskva city', 'business cent', 'federation',
                  'mercury', 'presnensk')),
    'moscow-city': (['Moscow City skyline evening',
                     'Moscow International Business Center night',
                     'Moscow skyscrapers night'],
                    ('space', 'lobby', 'view from'),
                    ('moscow city', 'moskva city', 'business cent', 'presnensk',
                     'federation')),
    'village': (['Russian village street wooden houses',
                 'village Russia wooden houses landscape',
                 'izba wooden house exterior'],
                ('yard', 'barn', 'stove', 'museum'),
                ('village', 'izba', 'derevnya')),
    'dacha': (['dacha Russia garden summer', 'dacha wooden house Russia',
               'Russian country house garden'],
              ('mansion', 'palace'), ()),
    # Локальная и переработанная еда — две половины вывода первой части:
    # дешевле то, что растёт рядом, дороже то, что прошло завод или границу.
    'local-food': (['potatoes onions vegetables market stall',
                    'vegetable market stall potatoes onions',
                    'potatoes harvest sack'],
                   ('field', 'flower', 'plant disease', 'blossom'),
                   ('potato', 'onion', 'vegetable', 'market')),
    'processed-food': (['roasted coffee beans heap',
                        'roasted coffee beans', 'ground coffee beans'],
                       ('plantation', 'tree', 'cherries'),
                       ('coffee',)),
    'kremlin-night': (['Moscow Kremlin sunset Moskva River',
                       'Moscow Kremlin panorama evening',
                       'Moscow Kremlin river view'],
                      (), ('kremlin',)),
}


def get(url, binary=False, tries=4):
    for a in range(tries):
        try:
            r = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(r, timeout=60) as f:
                return f.read() if binary else json.load(f)
        except Exception:
            if a == tries - 1:
                raise
            time.sleep(2 * 2 ** a)


def search(query, limit=10, ban=(), must=()):
    u = API + '?' + urllib.parse.urlencode({
        'action': 'query', 'format': 'json', 'generator': 'search',
        'gsrsearch': f'filetype:bitmap {query}', 'gsrnamespace': '6',
        'gsrlimit': str(limit * 4), 'prop': 'imageinfo',
        'iiprop': 'url|size|extmetadata', 'iiurlwidth': '2400',
    })
    pages = ((get(u).get('query') or {}).get('pages') or {}).values()
    hits = []
    for pg in pages:
        ii = (pg.get('imageinfo') or [{}])[0]
        w, h = ii.get('width', 0), ii.get('height', 0)
        url = ii.get('thumburl') or ii.get('url')
        if not url or w < MIN_W or not h or w / h < MIN_RATIO:
            continue
        if re.search(r'\.(svg|pdf|tiff?|gif)$', ii.get('url', ''), re.I):
            continue
        low = pg['title'].lower()
        if any(b in low for b in BAN) or any(b in low for b in ban):
            continue
        if must and not any(m in low for m in must):
            continue
        m = ii.get('extmetadata') or {}
        author = re.sub(r'<[^>]+>', '', (m.get('Artist') or {}).get('value', '')).strip()
        hits.append({
            'title': pg['title'], 'url': url, 'w': w, 'h': h,
            'author': author or '—',
            'licence': (m.get('LicenseShortName') or {}).get('value', '—'),
            'page': 'https://commons.wikimedia.org/wiki/'
                    + urllib.parse.quote(pg['title'].replace(' ', '_')),
        })
    hits.sort(key=lambda x: -x['w'])
    return hits[:limit]


def main():
    args = sys.argv[1:]
    if not args or '--list' in args:
        for slug, (qs, *_rest) in SHOTS.items():
            print(f'{slug:<14} {qs[0]}')
        return
    out = pathlib.Path(args[0])
    out.mkdir(parents=True, exist_ok=True)
    alt, only = {}, []
    rest = args[1:]
    if '--only' in rest:
        i = rest.index('--only')
        only = [x for x in rest[i + 1:] if not x.startswith('--') and '=' not in x]
        rest = rest[:i]
    for a in rest:
        if '=' in a:
            k, v = a.split('=', 1)
            alt[k] = int(v)

    credits, ok = [], 0
    todo = [s for s in SHOTS if not only or s in only]
    # При точечном перезапросе строки остальных кадров в CREDITS нужно сохранить.
    keep = {}
    cr = out / 'CREDITS.txt'
    if cr.exists():
        for line in cr.read_text(encoding='utf-8').splitlines():
            if ' — ' in line:
                keep[line.split('.jpg')[0]] = line
    for slug in todo:
        queries, ban, must = SHOTS[slug]
        hits = []
        used = queries[0]
        for q in queries:
            hits = search(q, max(6, alt.get(slug, 1)), ban, must)
            if hits:
                used = q
                break
        if not hits:
            print(f'{slug:<14} НЕ НАЙДЕНО')
            continue
        h = hits[min(alt.get(slug, 1), len(hits)) - 1]
        (out / f'{slug}.jpg').write_bytes(get(h['url'], binary=True))
        keep[slug] = f'{slug}.jpg — {h["author"]} · {h["licence"]} · {h["page"]}'
        ok += 1
        print(f'{slug:<14} {h["w"]}×{h["h"]}  «{used}»  {h["author"][:40]}')
    lines = [keep[s] for s in SHOTS if s in keep]
    (out / 'CREDITS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'\nскачано {ok} из {len(todo)}, авторы в {out}/CREDITS.txt')
    if ok < len(todo):
        sys.exit(1)


if __name__ == '__main__':
    main()
