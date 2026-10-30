// Loads the real OSM extract into the pure (no-WebGL) map systems for Node tests.
import { readFileSync } from 'node:fs';
import { MapData } from '../../src/world/MapData.js';
import { Landmarks } from '../../src/world/Landmarks.js';
import { markElevated } from '../../src/world/Bridges.js';
import { RoadGraph } from '../../src/sim/RoadGraph.js';
import { pointInPolygon } from '../../src/core/utils.js';

export function loadWorld() {
  const json = JSON.parse(readFileSync(new URL('../../public/data/onitsha_core.json', import.meta.url)));
  const map = new MapData(json);
  const isWater = (x, z) => map.water.some((w) => pointInPolygon(x, z, w.outer)) || map.land.some((l) => (l.holes ?? []).some((h) => pointInPolygon(x, z, h)));
  markElevated(map, isWater);
  const landmarks = new Landmarks(map);
  const graph = new RoadGraph(map);
  return { map, landmarks, graph, isWater };
}
