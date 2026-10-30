#!/usr/bin/env python3
"""
Onitsha Way — OSM extractor (v2, Milestone 2).

Reads an OpenStreetMap XML export and writes the game map JSON (public/data/onitsha_core.json).

    pip install shapely
    python tools/osm_extract.py <osm-file> [out.json] [--bbox S N W E]

What it does
- Roads: type, width, surface, name, bridge/layer, plus a routable node graph with junctions.
- Buildings: footprints cleaned against the road network. Where an OSM footprint overlaps the
  carriageway (common mapping offset), the overlapping part is cut away; footprints that are mostly
  inside a road are dropped. Each building also gets a deterministic seed, the edge facing the
  nearest road and a commercial/residential guess.
- Water: River Niger multipolygon clipped to the play area (not walkable).
- Areas: parks, woods, pitches, parking, marketplaces.
- POIs: named OSM nodes (fuel stations, transit parks, banks, shops...).

Coordinates are projected to local metres around the bbox centre: x = east, z = south.
Map data © OpenStreetMap contributors, ODbL.
"""
import sys, json, math, hashlib
import xml.etree.ElementTree as ET

try:
    from shapely.geometry import Polygon, LineString, MultiPolygon, box
    from shapely.ops import unary_union, linemerge, polygonize
    from shapely.strtree import STRtree
    from shapely.geometry.polygon import orient
except ImportError:
    sys.exit('This extractor needs shapely:  pip install shapely')

# Main Market, Holy Trinity Basilica, ShopRite (Onitsha Mall), Upper Iweka flyover, Bridgehead, the Niger Bridge
# and (from Milestone 6) the Asaba bank at the far end of the bridge, plus a strip to the south where the
# Bridgehead dual carriageway turns back into town (without it nothing could drive back off the bridge).
DEFAULT_BBOX = (6.1260, 6.1630, 6.7480, 6.7985)
# The Milestone 2–5 area. Its centre stays the projection origin, and everything inside it keeps its order in the
# output (new features are appended), so positions, resident ids and saves from earlier builds stay valid.
LEGACY_BBOX = (6.1295, 6.1630, 6.7610, 6.7985)

ROAD_WIDTH = {
    'trunk': 12, 'primary': 11, 'secondary': 9, 'tertiary': 7.5, 'unclassified': 6,
    'residential': 5.5, 'living_street': 5, 'service': 3.5, 'construction': 8,
    'footway': 2, 'path': 1.6, 'steps': 2, 'pedestrian': 4, 'track': 3.5,
    'trunk_link': 8, 'primary_link': 8, 'secondary_link': 7, 'tertiary_link': 6,
}
MAJOR = {'trunk', 'primary', 'secondary', 'tertiary', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}
NO_CLEAR = {'footway', 'path', 'steps', 'track', 'construction'}  # these don't cut buildings


def h01(s):
    return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def main():
    args = sys.argv[1:]
    bbox = DEFAULT_BBOX
    if '--bbox' in args:
        i = args.index('--bbox'); bbox = tuple(map(float, args[i + 1:i + 5])); del args[i:i + 5]
    origin = ((LEGACY_BBOX[0] + LEGACY_BBOX[1]) / 2, (LEGACY_BBOX[2] + LEGACY_BBOX[3]) / 2)
    if '--origin' in args:
        i = args.index('--origin'); origin = (float(args[i + 1]), float(args[i + 2])); del args[i:i + 3]
    src = args[0]
    out_path = args[1] if len(args) > 1 else 'public/data/onitsha_core.json'
    S, N, W, E = bbox
    lat0, lon0 = origin
    LS, LN, LW, LE = LEGACY_BBOX

    klat = 110574.0
    klon = 111320.0 * math.cos(math.radians(lat0))
    P = lambda la, lo: ((lo - lon0) * klon, -(la - lat0) * klat)
    pad = 0.0008
    inside = lambda la, lo: S - pad < la < N + pad and W - pad < lo < E + pad
    legacy_inside = lambda la, lo: LS - pad < la < LN + pad and LW - pad < lo < LE + pad
    pb = {'minX': (W - lon0) * klon, 'maxX': (E - lon0) * klon, 'minZ': -(N - lat0) * klat, 'maxZ': -(S - lat0) * klat}
    play = box(pb['minX'], pb['minZ'], pb['maxX'], pb['maxZ'])

    print('parsing', src)
    root = ET.parse(src).getroot()
    nodes, node_tags = {}, {}
    for n in root.iter('node'):
        nodes[n.get('id')] = (float(n.get('lat')), float(n.get('lon')))
        t = n.findall('tag')
        if t: node_tags[n.get('id')] = {x.get('k'): x.get('v') for x in t}
    ways = {}
    for w in root.iter('way'):
        ways[w.get('id')] = (w, [n.get('ref') for n in w.findall('nd') if n.get('ref') in nodes])

    def road_runs(refs, tags, wid, inside_fn):
        if tags.get('bridge') == 'yes' and any(inside_fn(*nodes[r]) for r in refs):
            return [{'osm': wid, 'refs': refs, 'tags': tags}]  # keep whole bridges (river crossings)
        out, run = [], []
        for r in refs + [None]:
            if r is not None and inside_fn(*nodes[r]):
                run.append(r); continue
            if len(run) >= 2:
                out.append({'osm': wid, 'refs': run, 'tags': tags})
            run = []
        return out

    roads, legacy_roads, buildings, areas = [], [], [], []
    for wid, (w, refs) in ways.items():
        tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
        if len(refs) < 2:
            continue
        if 'highway' in tags and tags['highway'] in ROAD_WIDTH and tags['highway'] != 'construction':
            roads += road_runs(refs, tags, wid, inside)
            legacy_roads += road_runs(refs, tags, wid, legacy_inside)
        elif 'building' in tags and refs[0] == refs[-1]:
            pts = [nodes[r] for r in refs]
            cla = sum(p[0] for p in pts) / len(pts); clo = sum(p[1] for p in pts) / len(pts)
            if S < cla < N and W < clo < E:
                buildings.append({'osm': wid, 'pts': pts, 'tags': tags})
        elif refs[0] == refs[-1] and any(k in tags for k in ('leisure', 'natural', 'landuse', 'amenity')):
            kind = tags.get('leisure') or tags.get('natural') or tags.get('amenity') or tags.get('landuse')
            if kind in ('park', 'wood', 'pitch', 'parking', 'marketplace', 'garden', 'water', 'commercial', 'retail'):
                poly = Polygon([P(*nodes[r]) for r in refs])
                legacy_play = box((LW - lon0) * klon, -(LN - lat0) * klat, (LE - lon0) * klon, -(LS - lat0) * klat)
                if poly.is_valid and poly.intersects(play):
                    g = poly.intersection(legacy_play if poly.intersects(legacy_play) else play)
                    if not g.is_empty and g.geom_type == 'Polygon':
                        areas.append({'kind': kind, 'name': tags.get('name', ''), 'pts': [[round(x, 1), round(z, 1)] for x, z in list(g.exterior.coords)[:-1]]})

    # legacy-first order: everything the earlier map had keeps its place; the new area is appended
    # A road that crosses the old boundary keeps its old piece unchanged; the part beyond it becomes an
    # extra piece appended at the end, sharing the boundary node so the network stays connected.
    key = lambda r: (r['osm'], tuple(r['refs']))
    legacy_keys = {key(r) for r in legacy_roads}
    legacy_by_way = {}
    for r in legacy_roads:
        legacy_by_way.setdefault(r['osm'], []).append(r['refs'])
    extra, changed = [], 0
    for r in roads:
        if key(r) in legacy_keys:
            continue
        olds = legacy_by_way.get(r['osm'], [])
        if not olds:
            extra.append(r); continue
        changed += 1
        refs = r['refs']
        covered = [False] * len(refs)
        for o in olds:
            for i in range(len(refs) - len(o) + 1):
                if refs[i:i + len(o)] == o:
                    for k in range(i + 1, i + len(o) - 1):
                        covered[k] = True   # interior of an old piece (its end nodes stay shared)
                    if len(o) == 2:
                        covered[i] = covered[i] or False
                    break
        # walk the refs and cut out the old pieces' edges; keep the rest as new pieces
        old_edges = set()
        for o in olds:
            for i in range(len(o) - 1):
                old_edges.add((o[i], o[i + 1]))
        piece = [refs[0]]
        for i in range(len(refs) - 1):
            if (refs[i], refs[i + 1]) in old_edges:
                if len(piece) >= 2:
                    extra.append({'osm': r['osm'], 'refs': piece, 'tags': r['tags']})
                piece = [refs[i + 1]]
            else:
                piece.append(refs[i + 1])
        if len(piece) >= 2:
            extra.append({'osm': r['osm'], 'refs': piece, 'tags': r['tags']})
    roads = list(legacy_roads) + extra
    centroid_legacy = lambda pts: LS < sum(p[0] for p in pts) / len(pts) < LN and LW < sum(p[1] for p in pts) / len(pts) < LE
    buildings.sort(key=lambda b: 0 if centroid_legacy(b['pts']) else 1)
    print('legacy roads extended beyond the old boundary (old piece kept, extension appended):', changed)
    legacy_minx = (LW - lon0) * klon
    areas.sort(key=lambda a: 0 if min(x for x, z in a['pts']) >= legacy_minx - 1 else 1)

    # ---------------------------------------------------------------- water (multipolygon relations)
    water = []
    for rel in root.iter('relation'):
        tags = {t.get('k'): t.get('v') for t in rel.findall('tag')}
        if tags.get('natural') != 'water' and tags.get('landuse') not in ('reservoir',):
            continue
        outer, inner = [], []
        for m in rel.findall('member'):
            if m.get('type') != 'way' or m.get('ref') not in ways:
                continue
            refs = ways[m.get('ref')][1]
            line = LineString([P(*nodes[r]) for r in refs])
            (inner if m.get('role') == 'inner' else outer).append(line)
        polys = list(polygonize(linemerge(outer))) if outer else []
        holes = list(polygonize(linemerge(inner))) if inner else []
        geom = unary_union(polys)
        if holes:
            geom = geom.difference(unary_union(holes))
        geom = geom.intersection(play.buffer(400))
        for g in getattr(geom, 'geoms', [geom]):
            if g.is_empty or g.geom_type != 'Polygon' or g.area < 500:
                continue
            g = orient(g.simplify(2.0), 1.0)
            water.append({'kind': 'river', 'name': tags.get('name', 'River Niger'),
                          'outer': [[round(x, 1), round(z, 1)] for x, z in list(g.exterior.coords)[:-1]],
                          'holes': [[[round(x, 1), round(z, 1)] for x, z in list(h.coords)[:-1]] for h in g.interiors]})
    # land = generous play area minus water (ground mesh is built from this so the river shows through)
    water_union = unary_union([Polygon(w['outer'], w['holes']).buffer(0) for w in water]) if water else None
    land_geom = play.buffer(500, join_style=2)
    if water_union is not None:
        land_geom = land_geom.difference(water_union)
    land = []
    for g in getattr(land_geom, 'geoms', [land_geom]):
        if g.geom_type == 'Polygon' and g.area > 2000:
            g = orient(g.simplify(1.5), 1.0)
            land.append({'outer': [[round(x, 1), round(z, 1)] for x, z in list(g.exterior.coords)[:-1]],
                         'holes': [[[round(x, 1), round(z, 1)] for x, z in list(h.coords)[:-1]] for h in g.interiors if Polygon(h).area > 200]})

    for wid, (w, refs) in ways.items():  # simple water ways
        tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
        if tags.get('natural') == 'water' and refs and refs[0] == refs[-1]:
            g = Polygon([P(*nodes[r]) for r in refs])
            if g.is_valid and g.intersects(play):
                g = orient(g.intersection(play.buffer(400)), 1.0) if g.intersection(play.buffer(400)).geom_type == 'Polygon' else None
                if g is not None and not g.is_empty:
                    water.append({'kind': 'lake', 'name': tags.get('name', ''), 'outer': [[round(x, 1), round(z, 1)] for x, z in list(g.exterior.coords)[:-1]], 'holes': []})

    # ---------------------------------------------------------------- road graph
    gnodes, gidx, node_use = [], {}, {}
    def gid(ref):
        if ref not in gidx:
            gidx[ref] = len(gnodes); x, z = P(*nodes[ref]); gnodes.append([round(x, 2), round(z, 2)])
        return gidx[ref]
    out_roads = []
    for r in roads:
        t = r['tags']; hw = t['highway']
        ids = [gid(x) for x in r['refs']]
        for x in r['refs']:
            node_use[x] = node_use.get(x, 0) + 1
        width = ROAD_WIDTH[hw]
        try:
            if 'width' in t: width = max(2.0, min(20.0, float(t['width'].replace('m', '').strip())))
        except ValueError:
            pass
        surface = t.get('surface') or ('asphalt' if hw in MAJOR or (hw == 'residential' and h01(r['osm']) > 0.28) else 'dirt' if hw in ('residential', 'track', 'path') else 'asphalt')
        if surface in ('unpaved', 'dirt', 'ground', 'earth', 'gravel', 'compacted', 'sand'):
            surface = 'dirt'
        road = {'id': r['osm'], 'name': t.get('name', ''), 'type': hw, 'width': width, 'surface': surface,
                'oneway': t.get('oneway') == 'yes', 'nodes': ids}
        if t.get('bridge') == 'yes':
            road['bridge'] = True; road['layer'] = int(t.get('layer', '1') or 1)
        out_roads.append(road)
    junctions = sorted({gidx[ref] for ref, c in node_use.items() if c >= 2 and ref in gidx})

    # ---------------------------------------------------------------- building clean-up against roads
    clear_geoms, seg_info = [], []
    for ri, r in enumerate(out_roads):
        if r['type'] in NO_CLEAR or r.get('bridge'):
            continue
        line = LineString([gnodes[i] for i in r['nodes']])
        margin = 0.7 if r['type'] in MAJOR else 0.25   # major roads keep room for the open drain
        clear_geoms.append(line.buffer(r['width'] / 2 + margin, cap_style=2, join_style=2))
        seg_info.append(ri)
    tree = STRtree(clear_geoms)
    line_tree_geoms = [LineString([gnodes[i] for i in r['nodes']]) for r in out_roads]
    line_tree = STRtree(line_tree_geoms)

    stats = {'kept': 0, 'trimmed': 0, 'dropped': 0}
    out_b = []
    legacy_n = len(legacy_roads)
    for b in buildings:
        # buildings of the earlier map are cut and classified against the earlier roads only, so they come out
        # exactly as before; new buildings see every road
        old = centroid_legacy(b['pts'])
        poly = Polygon([P(*p) for p in b['pts']])
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.is_empty or poly.area < 6:
            continue
        hits = [clear_geoms[i] for i in tree.query(poly) if (not old or seg_info[i] < legacy_n) and clear_geoms[i].intersects(poly)]
        if hits:
            cut = poly.difference(unary_union(hits))
            if cut.is_empty or cut.area < max(12, poly.area * 0.45):
                stats['dropped'] += 1; continue
            if cut.geom_type == 'MultiPolygon':
                cut = max(cut.geoms, key=lambda g: g.area)
            if cut.geom_type != 'Polygon':
                stats['dropped'] += 1; continue
            if cut.area < poly.area - 0.5:
                stats['trimmed'] += 1
            poly = cut
        poly = orient(poly.simplify(0.3), 1.0)
        pts = [[round(x, 2), round(z, 2)] for x, z in list(poly.exterior.coords)[:-1]]
        if len(pts) < 3 or poly.area < 6:
            stats['dropped'] += 1; continue
        # front edge = edge closest to a road
        front, fdist, ftype = -1, 1e9, None
        cands = [ci for ci in line_tree.query(poly.buffer(25)) if not old or ci < legacy_n]
        for i in range(len(pts)):
            a, c = pts[i], pts[(i + 1) % len(pts)]
            mid = LineString([a, c]).interpolate(0.5, normalized=True)
            for ci in cands:
                rd = out_roads[ci]
                d = line_tree_geoms[ci].distance(mid) - rd['width'] / 2
                if d < fdist:
                    front, fdist, ftype = i, d, rd['type']
        hr = h01(b['osm'])
        btag = b['tags'].get('building', 'yes')
        area = poly.area
        commercial = btag in ('commercial', 'retail') or (ftype in MAJOR and fdist < 14) or area > 420
        if btag in ('church', 'mosque', 'cathedral') or b['tags'].get('amenity') == 'place_of_worship':
            kind = 'worship'
        elif commercial:
            kind = 'commercial'
        elif area < 40 or btag in ('garage', 'shed', 'construction'):
            kind = 'shed'
        else:
            kind = 'residential'
        lv = b['tags'].get('building:levels')
        if lv and lv.isdigit():
            levels = int(lv)
        elif kind == 'commercial':
            levels = 2 + int(hr * 3.2) if area > 60 else 1 + int(hr * 2)
        elif kind in ('shed', 'worship'):
            levels = 1
        else:
            levels = 1 if hr < 0.55 else 2 if hr < 0.9 else 3
        rec = {'id': b['osm'], 'kind': kind, 'levels': levels, 'front': front if fdist < 12 else -1, 'pts': pts, 'seed': round(hr, 4)}
        if old:
            rec['_old'] = True
        if b['tags'].get('name'):
            rec['name'] = b['tags']['name']
        out_b.append(rec)
        stats['kept'] += 1

    # ---------------------------------------------------------------- named POIs
    pois = []
    for nid, tags in node_tags.items():
        la, lo = nodes[nid]
        if not (S < la < N and W < lo < E):
            continue
        kind = tags.get('amenity') or tags.get('shop') or tags.get('place') or tags.get('tourism') or tags.get('public_transport')
        if kind and tags.get('name'):
            x, z = P(la, lo)
            pois.append({'name': tags['name'], 'kind': kind, 'x': round(x, 1), 'z': round(z, 1), 'osm': nid, '_new': not (LS < la < LN and LW < lo < LE)})
    pois.sort(key=lambda p: p.pop('_new'))

    spawn = [0, 0]
    for r in out_roads:
        if r['name'] == 'Old Market Road':
            spawn = gnodes[r['nodes'][len(r['nodes']) // 2]]; break

    data = {
        'meta': {
            'version': 3,
            'name': 'Onitsha — Main Market to Upper Iweka, and the Asaba bank of the Niger Bridge',
            'source': 'OpenStreetMap (Overpass export supplied by the developer)',
            'license': 'Map data © OpenStreetMap contributors, ODbL 1.0',
            'bbox': {'S': S, 'N': N, 'W': W, 'E': E}, 'origin': {'lat': lat0, 'lon': lon0},
            'metresPerDegree': {'lat': klat, 'lon': round(klon, 3)},
            'playBounds': {k: round(v, 1) for k, v in pb.items()},
            'cleanup': stats,
            # features of the Milestone 2–5 area come first, unchanged; anything after these counts is new
            'legacy': {'roads': len(legacy_roads), 'buildings': sum(1 for b in out_b if b.get('_old')), 'bbox': {'S': LS, 'N': LN, 'W': LW, 'E': LE},
                       'playBounds': {'minX': round((LW - lon0) * klon, 1), 'maxX': round((LE - lon0) * klon, 1), 'minZ': round(-(LN - lat0) * klat, 1), 'maxZ': round(-(LS - lat0) * klat, 1)}},
        },
        'spawn': spawn,
        'graph': {'nodes': gnodes, 'junctions': junctions},
        'roads': out_roads,
        'buildings': out_b,
        'water': water,
        'land': land,
        'areas': areas,
        'pois': pois,
    }
    for b in out_b:
        b.pop('_old', None)
    with open(out_path, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    kinds = {}
    for b in out_b:
        kinds[b['kind']] = kinds.get(b['kind'], 0) + 1
    print(f"roads {len(out_roads)} (bridges {sum(1 for r in out_roads if r.get('bridge'))})  nodes {len(gnodes)}  buildings {len(out_b)} {kinds}")
    print('cleanup', stats, ' water', len(water), ' areas', len(areas), ' pois', len(pois))
    print('play bounds', data['meta']['playBounds'])


if __name__ == '__main__':
    main()
