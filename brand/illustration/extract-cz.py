"""Vytáhne hranici ČR z world-atlas (Natural Earth 1:10m, TopoJSON) do cz-border.json.
Použití: curl -sL -o countries.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-10m.json
         python3 -I extract-cz.py countries.json cz-border.json"""
import json, sys
src, out = sys.argv[1], sys.argv[2]
t = json.load(open(src))
sx, sy = t['transform']['scale']; tx, ty = t['transform']['translate']
arcs = []
for a in t['arcs']:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)
geo = next(g for g in t['objects']['countries']['geometries'] if str(g.get('id')) == '203')
polys = geo['arcs'] if geo['type'] == 'MultiPolygon' else [geo['arcs']]
rings = []
for poly in polys:
    for ring in poly[:1]:
        pts = []
        for i in ring:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(seg if not pts else seg[1:])
        rings.append([[round(x, 4), round(y, 4)] for x, y in pts])
rings.sort(key=len, reverse=True)
json.dump({'source': 'Natural Earth 1:10m via world-atlas@2.0.2', 'ring': rings[0]}, open(out, 'w'))
print(geo.get('properties'), len(rings), [len(r) for r in rings])
