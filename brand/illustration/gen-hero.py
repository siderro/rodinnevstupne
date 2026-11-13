"""Hero ilustrace „jako by ji nakreslilo dítě“: obrys ČR, pár výletních cílů a rodina s mnoha dětmi.

Spuštění (z kořene repa):  python3 -I brand/illustration/gen-hero.py
Výstup: brand/illustration/hero-cr.svg + kopie public/hero-cr.svg
Hranice ČR: brand/illustration/cz-border.json (Natural Earth 1:10m, viz extract-cz.py).
Vše je čára v currentColor (funguje ve světlém i tmavém režimu), žádné výplně.
Náhoda má pevné semínko, takže každý běh dá stejný obrázek; jiný „rukopis“ = změň SEED.
"""
import json, math, os, random, shutil

SEED = 7
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
W, H = 640, 470
rnd = random.Random(SEED)


# ── pomocné funkce ────────────────────────────────────────────────────────
def f(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s


def smooth_noise(n, amp, freq):
    """Pomalu se měnící šum (součet pár sinusovek s náhodnou fází) pro n bodů."""
    waves = [(rnd.uniform(0.6, 1.4) * freq, rnd.uniform(0, 6.28), rnd.uniform(0.5, 1)) for _ in range(3)]
    tot = sum(w[2] for w in waves)
    return [amp * sum(a * math.sin(k * i + ph) for k, ph, a in waves) / tot for i in range(n)]


def resample(pts, step):
    """Rozdělí lomenou čáru na body po zhruba `step` px."""
    out = [pts[0]]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        d = math.hypot(x1 - x0, y1 - y0)
        k = max(1, int(d / step))
        for i in range(1, k + 1):
            out.append((x0 + (x1 - x0) * i / k, y0 + (y1 - y0) * i / k))
    return out


def wobble(pts, amp=1.2, freq=0.35, step=6):
    """Roztřese čáru kolmo na směr – ruka, která nejde úplně rovně."""
    pts = resample(pts, step) if len(pts) > 1 else pts
    nz = smooth_noise(len(pts), amp, freq)
    out = []
    for i, (x, y) in enumerate(pts):
        a = pts[max(0, i - 1)]; b = pts[min(len(pts) - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        out.append((x - dy / L * nz[i], y + dx / L * nz[i]))
    return out


def catmull(pts):
    """Hladká křivka přes body (Catmull-Rom → kubické Béziery), relativní příkazy kvůli velikosti."""
    pts = [(round(x, 1), round(y, 1)) for x, y in pts]
    d = [f'M{f(pts[0][0])} {f(pts[0][1])}']
    if len(pts) < 3:
        return d[0] + ''.join(f'l{f(b[0] - a[0])} {f(b[1] - a[1])}' for a, b in zip(pts, pts[1:]))
    p = [pts[0]] + pts + [pts[-1]]
    def n(v):
        s = f(v)
        return s.replace('0.', '.', 1) if s.startswith(('0.', '-0.')) else s
    def pair(x, y):
        return f'{n(x)}{"" if n(y).startswith("-") else " "}{n(y)}'
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        c1 = ((p2[0] - p0[0]) / 6, (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - p1[0] - (p3[0] - p1[0]) / 6, p2[1] - p1[1] - (p3[1] - p1[1]) / 6)
        e = (p2[0] - p1[0], p2[1] - p1[1])
        d.append('c' + ' '.join(pair(*q) for q in (c1, c2, e)))
    return ''.join(d)


paths = []  # (d, šířka, průhlednost)


def stroke(pts, w=3.0, amp=1.0, step=8, op=None):
    paths.append((catmull(wobble(pts, amp=amp, step=step)), w, op))


def line(x0, y0, x1, y1, w=3.0, amp=0.8):
    stroke([(x0, y0), (x1, y1)], w, amp, step=9)


def loop(cx, cy, rx, ry=None, w=3.0, amp=0.6, over=0.35, start=None):
    """Ručně kreslený kruh: nedotažený, s přetahem přes začátek."""
    ry = ry or rx
    start = rnd.uniform(0, 6.28) if start is None else start
    n = max(10, int((rx + ry) * 0.9))
    tot = 2 * math.pi * (1 + over)
    pts = []
    for i in range(n + 1):
        t = start + tot * i / n
        grow = 1 + 0.08 * i / n  # konec trochu ujede ven
        pts.append((cx + math.cos(t) * rx * grow, cy + math.sin(t) * ry * grow))
    stroke(pts, w, amp, step=max(3, (rx + ry) / 4))


def arc(cx, cy, r, a0, a1, w=2.4, ry=None):
    ry = ry or r
    n = 10
    pts = [(cx + math.cos(a0 + (a1 - a0) * i / n) * r, cy + math.sin(a0 + (a1 - a0) * i / n) * ry) for i in range(n + 1)]
    stroke(pts, w, 0.3, step=3)


# ── mapa ČR ───────────────────────────────────────────────────────────────
ring = json.load(open(os.path.join(HERE, 'cz-border.json')))['ring']
lat0 = 49.8
k = math.cos(math.radians(lat0))
xs = [p[0] * k for p in ring]; ys = [-p[1] for p in ring]
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
MAP_X, MAP_Y, MAP_W = 26, 22, 500
sc = MAP_W / (maxx - minx)


def proj(lon, lat):
    return (MAP_X + (lon * k - minx) * sc, MAP_Y + (-lat - miny) * sc)


border = [proj(*p) for p in ring]


def simplify(pts, eps):
    """Douglas–Peucker."""
    if len(pts) < 3:
        return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x1 * y0 - y1 * x0) / L
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return simplify(pts[:idx + 1], eps)[:-1] + simplify(pts[idx:], eps)
    return [pts[0], pts[-1]]


# začneme kreslit „nahoře vlevo“ (Šluknovsko), jako dítě
start = min(range(len(border)), key=lambda i: border[i][0] * 0.3 + border[i][1])
border = border[start:-1] + border[:start + 1]
half = len(border) // 2  # uzavřený kruh → zjednodušit po polovinách
simple = simplify(border[:half + 1], 3.6)[:-1] + simplify(border[half:], 3.6)
# hlavní tah: celý obrys + kousek přes začátek (nedotažené, přetažené)
main = simple + simple[1:4]
stroke(main, 3.4, amp=1.8, step=10)
# druhý, slabší a rozostřený tah jen po části obrysu – „obtahování“
seg = simple[int(len(simple) * 0.05):int(len(simple) * 0.42)]
stroke([(x + 1.6, y - 1.2) for x, y in seg], 1.3, amp=2.2, step=8, op=0.55)
seg = simple[int(len(simple) * 0.62):int(len(simple) * 0.86)]
stroke([(x - 1.4, y + 1.5) for x, y in seg], 1.3, amp=2.0, step=8, op=0.55)

# ── výletní cíle (špendlíky = malé kresbičky) ──────────────────────────────
def pin(x, y, w=2.6):
    """Kapka s tečkou – špendlík na mapě, hrot v (x, y)."""
    r = 9
    pts = [(x, y)]
    for i in range(0, 17):
        t = math.radians(150 - i * (300 / 16))  # oblouk shora
        pts.append((x + math.cos(t) * r, y - 22 + -math.sin(t) * r))
    pts.append((x + 0.6, y + 0.4))
    stroke(pts, w, 0.5, step=3)
    loop(x, y - 22, 2.6, w=2.2, amp=0.2, over=0.1)


def castle(x, y):
    """Hrad: dvě věže s cimbuřím, brána, praporek. (x, y) = střed spodku."""
    b = y
    # pravá i levá věž + zeď s cimbuřím jedním tahem
    pts = [(x - 26, b), (x - 26, b - 40), (x - 20, b - 40), (x - 20, b - 35), (x - 15, b - 35), (x - 15, b - 40),
           (x - 9, b - 40), (x - 9, b - 26), (x - 4, b - 26), (x - 4, b - 31), (x + 1, b - 31), (x + 1, b - 26),
           (x + 9, b - 26), (x + 9, b - 40), (x + 15, b - 40), (x + 15, b - 35), (x + 20, b - 35), (x + 20, b - 40),
           (x + 26, b - 40), (x + 26, b)]
    stroke(pts, 2.6, 0.5, step=4)
    line(x - 29, b + 1, x + 29, b - 1, 2.6)
    # brána
    stroke([(x - 6, b), (x - 6, b - 10)] + [(x + math.cos(math.pi + t * math.pi / 8) * 6, b - 10 + math.sin(math.pi + t * math.pi / 8) * 6) for t in range(9)] + [(x + 6, b)], 2.4, 0.3, step=3)
    # okénka
    line(x - 18, b - 27, x - 18, b - 22, 2.4, 0.2)
    line(x + 18, b - 27, x + 18, b - 22, 2.4, 0.2)
    # praporek
    line(x + 20, b - 40, x + 20, b - 58, 2.2)
    stroke([(x + 20, b - 58), (x + 32, b - 54), (x + 20, b - 50)], 2.2, 0.3, step=3)


def giraffe(x, y):
    """Žirafa (zoo). (x, y) = mezi předníma nohama na zemi."""
    # tělo
    loop(x - 12, y - 24, 16, 8, w=2.6, amp=0.5, over=0.15, start=3.5)
    # nohy
    for dx in (-24, -18, -4, 2):
        line(x + dx, y - 18, x + dx + rnd.uniform(-1.5, 1.5), y, 2.4, 0.4)
    # krk
    stroke([(x - 2, y - 30), (x + 4, y - 48), (x + 8, y - 62)], 2.6, 0.4, step=4)
    stroke([(x + 3, y - 28), (x + 10, y - 46), (x + 14, y - 60)], 2.6, 0.4, step=4)
    # hlava
    loop(x + 15, y - 65, 7, 4.5, w=2.6, amp=0.3, over=0.2)
    # růžky
    line(x + 11, y - 69, x + 10, y - 75, 2.2, 0.2)
    line(x + 15, y - 69, x + 16, y - 75, 2.2, 0.2)
    # oko
    loop(x + 17, y - 66, 0.9, w=2, amp=0.05, over=0)
    # skvrny
    for sx, sy in ((-18, -26), (-8, -22), (-14, -20), (3, -40)):
        loop(x + sx, y + sy, 1.6, w=2, amp=0.1, over=0.1)
    # ocásek
    stroke([(x - 28, y - 26), (x - 33, y - 18), (x - 34, y - 14)], 2.2, 0.3, step=3)


def waves(x, y):
    """Aquapark: tobogán s vlnkami. (x, y) = střed hladiny."""
    for row in range(3):
        yy = y + row * 9
        x0 = x - 30 + row * 4
        pts = [(x0 + i * 3, yy + math.sin(i * 0.9) * 3.2) for i in range(0, 19 - row * 3)]
        stroke(pts, 2.6 if row == 0 else 2.2, 0.3, step=3)
    # tobogán: věž + klikatá skluzavka do vody
    line(x + 26, y - 2, x + 26, y - 44, 2.6)
    line(x + 36, y - 2, x + 36, y - 44, 2.6)
    for yy in (-14, -26, -38):
        line(x + 26, y + yy, x + 36, y + yy - 2, 2.0, 0.3)
    stroke([(x + 26, y - 44), (x + 12, y - 38), (x + 18, y - 28), (x + 4, y - 20), (x - 6, y - 6)], 2.6, 0.5, step=4)
    stroke([(x + 31, y - 46), (x + 18, y - 42), (x + 24, y - 32), (x + 10, y - 24), (x + 2, y - 8)], 2.0, 0.5, step=4, op=0.8)


def tree(x, y):
    line(x, y, x, y - 18, 2.6)
    loop(x, y - 28, 11, 12, w=2.6, amp=1.2, over=0.2)


# výletní cíle (zeměpisně zhruba sedí): hrad na jihu Čech, zoo na severovýchodě, aquapark na Moravě
cx, cy = proj(14.35, 49.1); castle(cx, cy)
gx, gy = proj(15.55, 49.98); giraffe(gx, gy)
ax, ay = proj(16.75, 49.33); waves(ax, ay)
tx, ty = proj(13.25, 50.0); tree(tx, ty); tree(tx + 18, ty + 6)
# Praha jako špendlík
px, py = proj(14.42, 50.08); pin(px, py)
# čárkovaná cesta (výlet) Praha → hrad
route = [(px, py + 4), (px - 6, py + 28), (px + 4, py + 52), (cx - 4, cy - 66), (cx - 2, cy - 52)]
rr = wobble(route, amp=2, step=4)
for i in range(0, len(rr) - 2, 3):
    stroke(rr[i:i + 2], 2.2, 0.1, step=50)

# ── sluníčko vpravo nahoře ─────────────────────────────────────────────────
sx, sy = W - 52, 52
loop(sx, sy, 20, w=3, amp=0.8, over=0.25)
for i in range(9):
    a = i * 2 * math.pi / 9 + rnd.uniform(-0.12, 0.12)
    r0, r1 = 28, 28 + rnd.uniform(9, 14)
    line(sx + math.cos(a) * r0, sy + math.sin(a) * r0, sx + math.cos(a) * r1, sy + math.sin(a) * r1, 2.6, 0.3)

# ── rodina: dva velcí a sedm malých, drží se za ruce ───────────────────────
GROUND = 448
# (x, výška, typ, vlasy)   typ: 'pa' tatínek, 'ma' maminka (sukně), 'b' kluk, 'g' holka
family = [
    (92, 128, 'pa', 'flat'),
    (144, 58, 'b', 'spiky'),
    (185, 76, 'g', 'tails'),
    (226, 50, 'b', 'curl'),
    (264, 84, 'b', 'spiky'),
    (304, 44, 'g', 'bow'),
    (340, 66, 'g', 'tails'),
    (378, 38, 'b', 'curl'),
    (436, 120, 'ma', 'long'),
]
# (Velikost hlavy roste s výškou pomaleji – děti mají velké hlavy.)
hands = []
for i, (x, h, kind, hair) in enumerate(family):
    x += rnd.uniform(-2, 2)
    top = GROUND - h
    r = 7 + h * 0.07
    hy = top + r
    neck = hy + r
    hip = GROUND - h * 0.42
    shoulder = neck + h * 0.08
    arm = h * 0.32 + 10
    loop(x, hy, r, r * 1.05, w=2.8, amp=0.4, over=0.25)
    # oči a úsměv
    loop(x - r * 0.38, hy - r * 0.15, 0.8, w=2.2, amp=0, over=0)
    loop(x + r * 0.38, hy - r * 0.15, 0.8, w=2.2, amp=0, over=0)
    arc(x, hy + r * 0.12, r * 0.45, 0.4, math.pi - 0.4, w=2)
    # vlasy
    if hair == 'spiky':
        for a in (-2.2, -1.75, -1.35, -0.95):
            line(x + math.cos(a) * r, hy + math.sin(a) * r, x + math.cos(a) * (r + 6), hy + math.sin(a) * (r + 6), 2.2, 0.1)
    elif hair == 'tails':
        for s in (-1, 1):
            stroke([(x + s * r * 0.9, hy - r * 0.4), (x + s * (r + 7), hy - r * 0.2), (x + s * (r + 9), hy + 4)], 2.2, 0.3, step=3)
    elif hair == 'curl':
        stroke([(x - 1, hy - r), (x + 2, hy - r - 5), (x + 6, hy - r - 4), (x + 4, hy - r - 1)], 2.2, 0.2, step=2)
    elif hair == 'bow':
        bx, by = x + r * 0.7, hy - r * 0.8
        stroke([(bx, by), (bx - 5, by - 5), (bx - 5, by + 3), (bx, by), (bx + 6, by - 4), (bx + 5, by + 4), (bx, by)], 2.0, 0.2, step=2)
    elif hair == 'long':
        stroke([(x - r * 0.95, hy - r * 0.35), (x - r - 3, hy + r * 0.8), (x - r - 1, hy + r * 1.6)], 2.4, 0.4, step=3)
        stroke([(x + r * 0.95, hy - r * 0.35), (x + r + 3, hy + r * 0.8), (x + r + 1, hy + r * 1.6)], 2.4, 0.4, step=3)
    elif hair == 'flat':
        stroke([(x - r * 0.9, hy - r * 0.5), (x - r * 0.3, hy - r * 1.15), (x + r * 0.5, hy - r * 1.1), (x + r * 0.95, hy - r * 0.4)], 2.4, 0.3, step=3)
    if kind in ('ma', 'g'):
        # trojúhelníkové šaty, nohy pod nimi
        skirt = GROUND - h * 0.3
        sw = h * 0.2 + 4
        stroke([(x, neck), (x - sw, skirt), (x + sw, skirt + 1), (x + 1, neck - 1)], 2.8, 0.5, step=4)
        line(x - sw * 0.4, skirt, x - sw * 0.45, GROUND, 2.6, 0.3)
        line(x + sw * 0.4, skirt, x + sw * 0.45, GROUND, 2.6, 0.3)
        stroke([(x - sw * 0.45, GROUND), (x - sw * 0.45 - 5, GROUND + 0.5)], 2.6, 0.1, step=9)
        stroke([(x + sw * 0.45, GROUND), (x + sw * 0.45 + 5, GROUND + 0.5)], 2.6, 0.1, step=9)
    else:
        line(x, neck, x, hip, 2.8, 0.5)
        lw = h * 0.16 + 3
        line(x, hip, x - lw, GROUND, 2.8, 0.4)
        line(x, hip, x + lw, GROUND, 2.8, 0.4)
        stroke([(x - lw, GROUND), (x - lw - 5, GROUND + 0.5)], 2.6, 0.1, step=9)
        stroke([(x + lw, GROUND), (x + lw + 5, GROUND + 0.5)], 2.6, 0.1, step=9)
    hands.append((x, shoulder, arm, h))

# ruce: každá dvojice sousedů se drží – paže jdou od ramene k společnému bodu „ruka v ruce“
for (x0, s0, a0, h0), (x1, s1, a1, h1) in zip(hands, hands[1:]):
    mx = (x0 + x1) / 2 + rnd.uniform(-3, 3)
    my = max(s0, s1) + min(h0, h1) * 0.12 + 6
    stroke([(x0, s0), ((x0 + mx) / 2, (s0 + my) / 2 + 3), (mx, my)], 2.6, 0.4, step=4)
    stroke([(x1, s1), ((x1 + mx) / 2, (s1 + my) / 2 + 3), (mx, my)], 2.6, 0.4, step=4)
    loop(mx, my, 2.2, w=2.2, amp=0.1, over=0.1)
# volné ruce na krajích mávají
x0, s0, a0, h0 = hands[0]
stroke([(x0, s0), (x0 - 18, s0 - 10), (x0 - 26, s0 - 28)], 2.6, 0.4, step=4)
x1, s1, a1, h1 = hands[-1]
stroke([(x1, s1), (x1 + 18, s1 + 8), (x1 + 28, s1 + 18)], 2.6, 0.4, step=4)

# ── autíčko vpravo dole ────────────────────────────────────────────────────
def car(x, y):
    """Auto (x, y) = levý spodní roh karoserie."""
    stroke([(x, y), (x, y - 16), (x + 14, y - 18), (x + 22, y - 32), (x + 52, y - 32), (x + 62, y - 18),
            (x + 76, y - 16), (x + 78, y), (x + 66, y)], 2.8, 0.5, step=4)
    line(x + 46, y, x + 30, y, 2.8, 0.3)
    stroke([(x + 12, y), (x + 3, y + 0.5)], 2.8, 0.1, step=20)
    loop(x + 21, y + 1, 8, w=2.8, amp=0.3, over=0.2)
    loop(x + 56, y + 1, 8, w=2.8, amp=0.3, over=0.2)
    # okna
    stroke([(x + 20, y - 18), (x + 26, y - 28), (x + 36, y - 28), (x + 36, y - 18), (x + 20, y - 18)], 2.2, 0.3, step=3)
    stroke([(x + 41, y - 18), (x + 41, y - 28), (x + 50, y - 28), (x + 56, y - 18), (x + 41, y - 18)], 2.2, 0.3, step=3)
    # obláček z výfuku
    loop(x - 8, y - 6, 4, w=1.8, amp=0.2, over=0.15)
    loop(x - 17, y - 10, 5, w=1.8, amp=0.2, over=0.15)


car(522, GROUND - 6)

# zem: kus čáry pod rodinou a autem
stroke([(40, GROUND + 4), (220, GROUND + 6), (420, GROUND + 3), (612, GROUND + 6)], 2.0, 1.2, step=10, op=0.6)

# ── zápis SVG ──────────────────────────────────────────────────────────────
groups = {}
for d, w, op in paths:
    groups.setdefault((w, op), []).append(d)
body = []
for (w, op), ds in sorted(groups.items(), key=lambda kv: (kv[0][1] or 1, kv[0][0])):
    attrs = f' stroke-width="{f(w)}"' + (f' opacity="{op}"' if op else '')
    body.append(f'<g{attrs}><path d="{"".join(ds)}"/></g>')

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
       f'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">'
       + ''.join(body) + '</svg>\n')
out = os.path.join(HERE, 'hero-cr.svg')
open(out, 'w').write(svg)
shutil.copyfile(out, os.path.join(ROOT, 'public', 'hero-cr.svg'))
print(out, len(svg.encode()), 'B')
