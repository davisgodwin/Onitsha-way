import { LANDMARKS } from '../data/landmarks.js';

/** Landmarks projected into world metres with the map's own projection. */
export class Landmarks {
  constructor(map) {
    const { origin, metresPerDegree } = map.meta;
    this.list = LANDMARKS.map((l) => ({
      ...l,
      x: (l.lon - origin.lon) * metresPerDegree.lon,
      z: -(l.lat - origin.lat) * metresPerDegree.lat,
    }));
    const oldPois=map.meta?.extensions?.[0]?.before?.pois??Infinity;for(const [pi,p] of (map.pois??[]).entries()){if(!['school','university','hospital','townhall'].includes(p.kind))continue;if(this.list.some(l=>Math.hypot(l.x-p.x,l.z-p.z)<100))continue;this.list.push({ext:pi>=oldPois||undefined,id:`osm:${p.osm}`,name:p.name,kind:['school','university'].includes(p.kind)?'school':'public',x:p.x,z:p.z,radius:50,confidence:'osm',blurb:`${p.name} — ${p.kind}, from the bundled OpenStreetMap export. Visitor entrances are approximate; interiors are not surveyed.`,source:`https://www.openstreetmap.org/node/${p.osm}`});}
    // smallest radius first so specific places win over districts
    this.byRadius = [...this.list].sort((a, b) => a.radius - b.radius);
  }
  /** The most specific landmark containing (x, z), or null. */
  at(x, z) {
    for (const l of this.byRadius) if (Math.hypot(x - l.x, z - l.z) <= l.radius) return l;
    return null;
  }
  get(id) { return this.list.find((l) => l.id === id); }
}
