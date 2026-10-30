#!/usr/bin/env python3
"""
Onitsha Way: extend the map from a new OpenStreetMap export WITHOUT touching what is already there (v0.48).

    python tools/osm_append.py <new.osm> [--base public/data/onitsha_core.json] [--out same] [--bbox S N W E]
                               [--lga "Onitsha North,Onitsha South"]

Everything in the current map keeps its index, position and id (saves, homes, residents and businesses depend on
that order). From the new export it APPENDS only what lies outside the current play area and inside --bbox:
roads (joined to the existing network where they cross the old edge), buildings (cleaned against roads and
classified exactly like osm_extract.py), parks/car parks, water areas, named places (GRA Phase I and II...) and,
when the export has them, the LGA boundary polygons named in --lga: the game then treats everything outside them
as COMING SOON. The default --bbox is the whole export.

Map data © OpenStreetMap contributors, ODbL.
"""
import sys, json, math
import xml.etree.ElementTree as ET
from shapely.geometry import Polygon, LineString, box, Point
from shapely.ops import unary_union, linemerge, polygonize
from shapely.strtree import STRtree
from shapely.geometry.polygon import orient
sys.path.insert(0, __import__('os').path.dirname(__file__))
from osm_extract import ROAD_WIDTH, MAJOR, NO_CLEAR, h01


def opt(args, name, n=1, default=None):
    if name not in args: return default
    i = args.index(name); v = args[i + 1:i + 1 + n]; del args[i:i + 1 + n]
    return v if n > 1 else v[0]


def main():
    args = sys.argv[1:]
    base_path = opt(args, '--base', default='public/data/onitsha_core.json')
    out_path = opt(args, '--out', default=base_path)
    bbox = opt(args, '--bbox', 4)
    lga_names = [s.strip().lower() for s in (opt(args, '--lga', default='Onitsha North,Onitsha South')).split(',') if s.strip()]
    src = args[0]
    base = json.load(open(base_path))
    meta = base['meta']
    lat0, lon0 = meta['origin']['lat'], meta['origin']['lon']
    klat, klon = meta['metresPerDegree']['lat'], meta['metresPerDegree']['lon']
    P = lambda la, lo: ((lo - lon0) * klon, -(la - lat0) * klat)
    ob = meta['playBounds']
    old_rect = box(ob['minX'], ob['minZ'], ob['maxX'], ob['maxZ'])

    print('parsing', src)
    root = ET.parse(src).getroot()
    nodes, node_tags = {}, {}
    for n in root.iter('node'):
        nodes[n.get('id')] = (float(n.get('lat')), float(n.get('lon')))
        t = n.findall('tag')
        if t: node_tags[n.get('id')] = {x.get('k'): x.get('v') for x in t}
    if bbox: S, N, W, E = map(float, bbox)
    else:
        b = root.find('bounds')
        if b is not None: S, N, W, E = float(b.get('minlat')), float(b.get('maxlat')), float(b.get('minlon')), float(b.get('maxlon'))
        else:
            las = [v[0] for v in nodes.values()]; los = [v[1] for v in nodes.values()]; S, N, W, E = min(las), max(las), min(los), max(los)
    x0, z1 = P(S, W); x1, z0 = P(N, E)
    new_rect = box(min(x0, x1), min(z0, z1), max(x0, x1), max(z0, z1))
    region = new_rect.difference(old_rect)          # where new things may go
    print('new area: %.1f km² (old map %.1f km²)' % (region.area / 1e6, old_rect.area / 1e6))
    ways = {}
    for w in root.iter('way'):
        ways[w.get('id')] = (w, [n.get('ref') for n in w.findall('nd') if n.get('ref') in nodes])
    XY = {r: P(*nodes[r]) for r in nodes}
    lgas = []
    for rel in root.iter('relation'):
        tags = {t.get('k'): t.get('v') for t in rel.findall('tag')}
        if tags.get('boundary') != 'administrative' or (tags.get('name', '').lower() not in lga_names): continue
        outer = [LineString([XY[r] for r in ways[m.get('ref')][1]]) for m in rel.findall('member') if m.get('type') == 'way' and m.get('ref') in ways and m.get('role') in ('outer', '') and len(ways[m.get('ref')][1]) > 1]
        polys = list(polygonize(linemerge(outer))) if outer else []
        if polys:
            g = unary_union(polys).simplify(5)
            for gg in getattr(g, 'geoms', [g]):
                lgas.append({'name': tags['name'], 'pts': [[round(x, 1), round(z, 1)] for x, z in list(gg.exterior.coords)[:-1]]})
    if lgas:
        lga_union = unary_union([Polygon(l['pts']).buffer(0) for l in lgas])
        region = region.intersection(lga_union.buffer(40))   # only Onitsha is added; what lies beyond stays COMING SOON
        print('new area inside Onitsha (LGA lines): %.1f km²' % (region.area / 1e6))
    in_new = lambda r: region.contains(Point(XY[r]))
    in_old = lambda r: old_rect.contains(Point(XY[r]))

    # ---------------------------------------------------------------- existing graph: for joining roads at the old edge
    gnodes = base['graph']['nodes']; n_old_nodes = len(gnodes)
    old_tree = STRtree([Point(p) for p in gnodes])
    junctions = set(base['graph']['junctions'])
    def nearest_old(xy, maxd=30):
        i = old_tree.nearest(Point(xy))
        return int(i) if i is not None and math.dist(gnodes[int(i)], xy) <= maxd else None
    gidx = {}
    def gid(ref):
        if ref not in gidx:
            gidx[ref] = len(gnodes); x, z = XY[ref]; gnodes.append([round(x, 2), round(z, 2)])
        return gidx[ref]

    # ---------------------------------------------------------------- roads
    new_roads, joins, use = [], 0, {}
    for wid, (w, refs) in ways.items():
        tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
        hw = tags.get('highway')
        if hw not in ROAD_WIDTH or hw == 'construction' or len(refs) < 2: continue
        run = []
        def flush(run, prev_old, next_old):
            nonlocal joins
            if len(run) < 2 and not (run and (prev_old or next_old)): return
            ids = [gid(r) for r in run]
            # join to the old network where the way continues into the old map
            if prev_old is not None:
                j = nearest_old(XY[prev_old]);
                if j is not None: ids.insert(0, j); joins += 1   # the old node's junction flag stays as it was (placements depend on it)
            if next_old is not None:
                j = nearest_old(XY[next_old]);
                if j is not None: ids.append(j); joins += 1
            if len(ids) < 2: return
            for r in run: use[r] = use.get(r, 0) + 1
            width = ROAD_WIDTH[hw]
            try:
                if 'width' in tags: width = max(2.0, min(20.0, float(tags['width'].replace('m', '').strip())))
            except ValueError: pass
            surface = tags.get('surface') or ('asphalt' if hw in MAJOR or (hw == 'residential' and h01(wid) > 0.28) else 'dirt' if hw in ('residential', 'track', 'path') else 'asphalt')
            if surface in ('unpaved', 'dirt', 'ground', 'earth', 'gravel', 'compacted', 'sand'): surface = 'dirt'
            road = {'id': wid, 'name': tags.get('name', ''), 'type': hw, 'width': width, 'surface': surface, 'oneway': tags.get('oneway') == 'yes', 'nodes': ids}
            if tags.get('bridge') == 'yes': road['bridge'] = True; road['layer'] = int(tags.get('layer', '1') or 1)
            new_roads.append(road)
        prev_old = None
        for i, r in enumerate(refs):
            if in_new(r): run.append(r); continue
            if run: flush(run, prev_old, r if in_old(r) else None); run = []
            prev_old = r if in_old(r) else None
        if run: flush(run, prev_old, None)
    for r, c in use.items():
        if c >= 2 and r in gidx: junctions.add(gidx[r])
    print('new roads:', len(new_roads), '· joined to the old network at', joins, 'points')

    # ---------------------------------------------------------------- buildings (same clean-up and classification as osm_extract.py)
    road_geoms, road_info = [], []
    for r in base['roads'] + new_roads:
        if r['type'] in NO_CLEAR or r.get('bridge'): continue
        pts = [gnodes[i] for i in r['nodes']]
        if len(pts) < 2: continue
        line = LineString(pts)
        if not line.intersects(region.buffer(60)): continue
        road_geoms.append(line.buffer(r['width'] / 2 + (0.7 if r['type'] in MAJOR else 0.25), cap_style=2, join_style=2)); road_info.append(r)
    tree = STRtree(road_geoms) if road_geoms else None
    lines = [LineString([gnodes[i] for i in r['nodes']]) for r in road_info]
    ltree = STRtree(lines) if lines else None
    old_ids = {str(b['id']) for b in base['buildings']}
    new_b, stats = [], {'kept': 0, 'trimmed': 0, 'dropped': 0}
    for wid, (w, refs) in ways.items():
        tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
        if 'building' not in tags or len(refs) < 4 or refs[0] != refs[-1] or wid in old_ids: continue
        poly = Polygon([XY[r] for r in refs])
        if not poly.is_valid: poly = poly.buffer(0)
        if poly.is_empty or poly.area < 6 or not region.contains(poly.centroid): continue
        hits = [road_geoms[i] for i in tree.query(poly) if road_geoms[i].intersects(poly)] if tree else []
        if hits:
            cut = poly.difference(unary_union(hits))
            if cut.is_empty or cut.area < max(12, poly.area * 0.45): stats['dropped'] += 1; continue
            if cut.geom_type == 'MultiPolygon': cut = max(cut.geoms, key=lambda g: g.area)
            if cut.geom_type != 'Polygon': stats['dropped'] += 1; continue
            if cut.area < poly.area - 0.5: stats['trimmed'] += 1
            poly = cut
        poly = orient(poly.simplify(0.3), 1.0)
        pts = [[round(x, 2), round(z, 2)] for x, z in list(poly.exterior.coords)[:-1]]
        if len(pts) < 3 or poly.area < 6: stats['dropped'] += 1; continue
        front, fdist, ftype = -1, 1e9, None
        cands = list(ltree.query(poly.buffer(25))) if ltree else []
        for i in range(len(pts)):
            mid = LineString([pts[i], pts[(i + 1) % len(pts)]]).interpolate(0.5, normalized=True)
            for ci in cands:
                d = lines[ci].distance(mid) - road_info[ci]['width'] / 2
                if d < fdist: front, fdist, ftype = i, d, road_info[ci]['type']
        hr = h01(wid); btag = tags.get('building', 'yes'); area = poly.area
        commercial = btag in ('commercial', 'retail') or (ftype in MAJOR and fdist < 14) or area > 420
        if btag in ('church', 'mosque', 'cathedral') or tags.get('amenity') == 'place_of_worship': kind = 'worship'
        elif commercial: kind = 'commercial'
        elif area < 40 or btag in ('garage', 'shed', 'construction'): kind = 'shed'
        else: kind = 'residential'
        lv = tags.get('building:levels')
        if lv and lv.isdigit(): levels = int(lv)
        elif kind == 'commercial': levels = 2 + int(hr * 3.2) if area > 60 else 1 + int(hr * 2)
        elif kind in ('shed', 'worship'): levels = 1
        else: levels = 1 if hr < 0.55 else 2 if hr < 0.9 else 3
        rec = {'id': wid, 'kind': kind, 'levels': levels, 'front': front if fdist < 12 else -1, 'pts': pts, 'seed': round(hr, 4)}
        if tags.get('name'): rec['name'] = tags['name']
        new_b.append(rec); stats['kept'] += 1
    print('new buildings:', stats)

    # ---------------------------------------------------------------- areas, water, places, LGA boundaries
    new_areas = []
    for wid, (w, refs) in ways.items():
        tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
        if len(refs) < 4 or refs[0] != refs[-1]: continue
        kind = tags.get('leisure') or tags.get('natural') or tags.get('amenity') or tags.get('landuse')
        if kind not in ('park', 'wood', 'pitch', 'parking', 'marketplace', 'garden', 'commercial', 'retail', 'residential'): continue
        if kind == 'residential' and not tags.get('name'): continue   # only named estates (e.g. "GRA Phase II")
        poly = Polygon([XY[r] for r in refs])
        if not poly.is_valid: poly = poly.buffer(0)
        g = poly.intersection(region)
        for gg in getattr(g, 'geoms', [g]):
            if gg.is_empty or gg.geom_type != 'Polygon' or gg.area < 50: continue
            new_areas.append({'kind': kind, 'name': tags.get('name', ''), 'pts': [[round(x, 1), round(z, 1)] for x, z in list(orient(gg, 1.0).exterior.coords)[:-1]]})
    new_water = []
    for wid, (w, refs) in ways.items():
        tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
        if tags.get('natural') == 'water' and len(refs) > 3 and refs[0] == refs[-1]:
            g = Polygon([XY[r] for r in refs]).buffer(0).intersection(region)
            for gg in getattr(g, 'geoms', [g]):
                if gg.geom_type == 'Polygon' and gg.area > 200:
                    new_water.append({'kind': 'lake', 'name': tags.get('name', ''), 'outer': [[round(x, 1), round(z, 1)] for x, z in list(orient(gg, 1.0).exterior.coords)[:-1]], 'holes': []})
    new_pois = []
    old_poi = {str(p.get('osm')) for p in base['pois']}
    for nid, tags in node_tags.items():
        if nid in old_poi or not in_new(nid): continue
        kind = tags.get('amenity') or tags.get('shop') or tags.get('place') or tags.get('tourism') or tags.get('public_transport')
        if kind and tags.get('name'):
            x, z = XY[nid]; new_pois.append({'name': tags['name'], 'kind': kind, 'x': round(x, 1), 'z': round(z, 1), 'osm': nid})
    print('LGA boundaries found:', [l['name'] for l in lgas] or 'none (the river line stays the only boundary)')

    # ---------------------------------------------------------------- append (never reorder)
    ext = {'bbox': {'S': S, 'N': N, 'W': W, 'E': E}, 'before': {'playBounds': dict(ob), 'roads': len(base['roads']), 'buildings': len(base['buildings']), 'areas': len(base['areas']), 'pois': len(base['pois']), 'nodes': n_old_nodes},
           'added': {'roads': len(new_roads), 'buildings': len(new_b), 'areas': len(new_areas), 'pois': len(new_pois), 'water': len(new_water)}}
    base['roads'] += new_roads; base['buildings'] += new_b; base['areas'] += new_areas; base['pois'] += new_pois; base['water'] += new_water
    base['graph']['junctions'] = sorted(junctions)
    nb = new_rect.union(old_rect).bounds
    meta['playBounds'] = {'minX': round(nb[0], 1), 'minZ': round(nb[1], 1), 'maxX': round(nb[2], 1), 'maxZ': round(nb[3], 1)}
    meta['bbox'] = {'S': min(S, meta['bbox']['S']), 'N': max(N, meta['bbox']['N']), 'W': min(W, meta['bbox']['W']), 'E': max(E, meta['bbox']['E'])}
    meta.setdefault('extensions', []).append(ext)
    if lgas: meta['playPolygons'] = lgas; meta['playPolygonsOutside'] = ob   # the LGA lines only lock land outside the old map
    # the ground: add the new area to the land (rivers in it stay water)
    land = unary_union([Polygon(l['outer'], l['holes']).buffer(0) for l in base['land']] + [region.buffer(500, join_style=2)])
    water_union = unary_union([Polygon(w['outer'], w['holes']).buffer(0) for w in base['water']])
    land = land.difference(water_union)
    base['land'] = [{'outer': [[round(x, 1), round(z, 1)] for x, z in list(orient(g.simplify(1.5), 1.0).exterior.coords)[:-1]], 'holes': [[[round(x, 1), round(z, 1)] for x, z in list(h.coords)[:-1]] for h in g.interiors if Polygon(h).area > 200]} for g in getattr(land, 'geoms', [land]) if g.geom_type == 'Polygon' and g.area > 2000]
    meta['name'] = 'Onitsha (extended v0.48), and the Asaba bank of the Niger Bridge'
    with open(out_path, 'w') as f: json.dump(base, f, separators=(',', ':'))
    print('written', out_path, json.dumps(ext['added']))


if __name__ == '__main__':
    main()
