# -*- coding: utf-8 -*-
"""Загрузка фотографий с Викисклада по списку тем.

    python3 scripts/photos/commons.py photos/deck            все темы
    python3 scripts/photos/commons.py photos/deck metro=3    для метро — третий кандидат
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

SHOTS = {
    'red-square':    ["Saint Basil's Cathedral Red Square evening",
                      'Red Square Moscow panorama', 'Red Square Moscow'],
    'st-basil':      ["Saint Basil's Cathedral domes",
                      "Saint Basil's Cathedral Moscow", 'Pokrovsky Cathedral Moscow'],
    'metro':         ['Komsomolskaya metro station Moscow',
                      'Mayakovskaya metro station Moscow',
                      'Moscow Metro station interior hall'],
    'baikal':        ['Lake Baikal ice winter', 'Lake Baikal landscape', 'Baikal lake'],
    'market':        ['Russian supermarket interior vegetables',
                      'grocery store produce shelves',
                      'farmers market vegetables stall'],
    'business':      ['Moscow International Business Center daytime',
                      'Moscow City skyscrapers', 'Moscow International Business Center'],
    'moscow-city':   ['Moscow International Business Center night',
                      'Moscow City skyline evening', 'Moscow skyscrapers night'],
    'village':       ['Russian village wooden house izba',
                      'Russian wooden house village', 'izba Russia village'],
    'dacha':         ['dacha Russia garden summer', 'dacha wooden house Russia',
                      'Russian country house garden'],
    'kremlin-night': ['Moscow Kremlin sunset Moskva River',
                      'Moscow Kremlin panorama evening', 'Moscow Kremlin river view'],
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


def search(query, limit=10):
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
        for slug, qs in SHOTS.items():
            print(f'{slug:<14} {qs[0]}')
        return
    out = pathlib.Path(args[0])
    out.mkdir(parents=True, exist_ok=True)
    alt = {}
    for a in args[1:]:
        if '=' in a:
            k, v = a.split('=', 1)
            alt[k] = int(v)

    credits, ok = [], 0
    for slug, queries in SHOTS.items():
        hits = []
        used = queries[0]
        for q in queries:
            hits = search(q, max(6, alt.get(slug, 1)))
            if hits:
                used = q
                break
        if not hits:
            print(f'{slug:<14} НЕ НАЙДЕНО')
            continue
        h = hits[min(alt.get(slug, 1), len(hits)) - 1]
        (out / f'{slug}.jpg').write_bytes(get(h['url'], binary=True))
        credits.append(f'{slug}.jpg — {h["author"]} · {h["licence"]} · {h["page"]}')
        ok += 1
        print(f'{slug:<14} {h["w"]}×{h["h"]}  «{used}»  {h["author"][:40]}')
    (out / 'CREDITS.txt').write_text('\n'.join(credits) + '\n', encoding='utf-8')
    print(f'\nскачано {ok} из {len(SHOTS)}, авторы в {out}/CREDITS.txt')
    if ok < len(SHOTS):
        sys.exit(1)


if __name__ == '__main__':
    main()
