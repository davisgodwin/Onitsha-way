import * as THREE from 'three';
import { Wholesale, WHOLESALE_LOTS, lotPrice } from './Wholesale.js';
import { ITEMS } from '../data/catalogue.js';
import { naira } from './Economy.js';
import { isOpen, hoursFor } from '../data/schedule.js';
import { weekdayOf } from '../sim/Calendar.js';
import { clockLabel } from '../jobs/JobSystem.js';

/*
  The wholesale depot by Main Market (a sign board and a counter you walk up to): bulk lots and the
  day's supply orders. Closed on Sunday with the market. Rules live in Wholesale.js.
*/
function boardTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#123c69'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#f2c200'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 148);
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 54px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText('WHOLESALE DEPOT', 256, 62);
  g.font = '700 24px "DM Sans", system-ui, sans-serif'; g.fillStyle = '#f2c200'; g.fillText('Bulk goods · Supply orders · Mon–Sat', 256, 118);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const hh = (x) => `${String(Math.floor(x)).padStart(2, '0')}:${x % 1 ? '30' : '00'}`;

export class WholesaleController {
  constructor(game) { this.g = game; }

  setup() {
    const g = this.g, mm = g.world.landmarks.get('main-market');
    const gate = mm?.gatePos ?? mm;
    if (!gate) return;
    const [x, z] = g.world.findFreeSpot(gate.x + 10, gate.z + 6, 1.6);
    this.spot = { x, z };
    const grp = new THREE.Group(); grp.name = 'WholesaleDepot';
    const post = new THREE.MeshStandardMaterial({ color: '#3b3b3b', roughness: 0.8 });
    for (const dx of [-1.6, 1.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), post); p.position.set(dx, 1.6, 0); grp.add(p); }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.6, side: THREE.DoubleSide }));
    board.position.set(0, 2.75, 0); grp.add(board);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.7), new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.85 }));
    counter.position.set(0, 0.5, 0.2); grp.add(counter);
    const cartons = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: '#c79a5b', roughness: 0.9 }));
    cartons.position.set(0.6, 1.25, 0.2); grp.add(cartons);
    // face the street: the direction in which the road is closest
    let best = 0, bd = Infinity;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, d = g.world.map.nearestRoad(x + Math.sin(a) * 6, z + Math.cos(a) * 6, { maxDist: 60 })?.dist ?? Infinity;
      if (d < bd) { bd = d; best = a; }
    }
    grp.position.set(x, 0, z); grp.rotation.y = best;
    g.renderer.scene.add(grp);
    g.world.collision.addCircle?.(x, z, 1.0);
    this.depot = { id: 'wholesale', kind: 'stall', schedule: [7, 19], x, z };
    g.interactions.register({
      x, z, radius: 3.2,
      enabled: () => !!this.sys && !g.vehicles?.driving,
      label: () => (this.open() ? 'Wholesale depot — bulk goods and supply orders' : 'Wholesale depot (closed)'),
      onInteract: () => g.openChoice(() => this.view()),
    });
  }

  start(saveData) {
    const g = this.g;
    saveData.wholesale ??= {};
    const traders = g.npcs.residents.filter((r) => r.role === 'trader');
    this.sys = new Wholesale(saveData.wholesale, { economy: g.economy, inventory: g.inventory, traders, bus: g.bus });
  }

  weekday() { return weekdayOf(this.g.clock.day); }
  open() { return isOpen(this.depot, this.weekday(), this.g.clock.minutes / 60); }

  /** Lapsed orders: the trader remembers you let them down. */
  update() {
    if (!this.sys) return;
    for (const o of this.sys.expire(this.g.nowAbs())) {
      const rel = this.g.npcs.rels[o.trader]; if (rel) rel.negative += 1;
      this.g.ui.toast(`Supply order lapsed: ${o.traderName} didn't get the ${o.itemName}.`);
    }
  }

  view(msg = null) {
    const g = this.g, day = g.clock.day;
    if (!this.open()) {
      const h = hoursFor(this.depot, this.weekday());
      return { title: 'Wholesale depot', kicker: 'CLOSED', text: h ? `Open ${hh(h[0])}–${hh(h[1])}.` : 'Closed on Sunday, like the market.', options: [{ label: 'Okay', ghost: true, act: () => g.closeChoice() }] };
    }
    const wd = this.weekday(), hour = g.clock.minutes / 60;
    const board = this.sys.board(day, (t) => isOpen(t, wd, Math.max(hour, 9)));
    const mine = this.sys.state.orders;
    const options = [
      ...WHOLESALE_LOTS.map((l) => {
        const it = ITEMS[l.item], price = lotPrice(l), left = this.sys.left(l, day);
        return { label: `${l.qty} × ${it.name} — ${naira(price)}`, sub: `${naira(Math.round(price / l.qty))} each (shop price ${naira(it.price)}) · ${left} left today`,
          disabled: left <= 0 || !g.economy.canAfford(price), why: left <= 0 ? 'Sold out for today' : 'Not enough money',
          act: () => { const r = this.sys.buy(l.id, day); g.ui.toast(r.ok ? `Bought ${l.qty} × ${it.name} for ${naira(r.price)}` : r.error === 'bag-full' ? 'Your bag is full' : 'Could not buy it'); if (r.ok) g.saveGame(); g.renderChoice(); } };
      }),
      ...board.map((o) => ({ label: `Order: ${o.qty} × ${o.itemName} for ${o.traderName}`, sub: `pays ${naira(o.total)} (${naira(o.unit)} each) · by ${clockLabel(o.due)}`, disabled: mine.length >= 3, why: 'You already have 3 orders',
        act: () => { const r = this.sys.accept(o); g.ui.toast(r.ok ? `Order taken — bring ${o.qty} × ${o.itemName} to ${o.traderName} by ${clockLabel(o.due)}` : 'Could not take it'); if (r.ok) { this.markTrader(o); g.saveGame(); } g.renderChoice(); } })),
      { label: 'Done', ghost: true, act: () => g.closeChoice() },
    ];
    return {
      title: 'Wholesale depot', kicker: 'MAIN MARKET',
      text: msg ?? 'Bulk lots at wholesale prices. Traders buy the pieces back off you, or fill a supply order for a better price.',
      note: mine.length ? `Your orders: ${mine.map((o) => `${o.qty} × ${o.itemName} → ${o.traderName} by ${clockLabel(o.due)}`).join(' · ')}` : 'Take an order, buy the goods, then talk to the trader to deliver.',
      options,
    };
  }

  /** Put the trader you're supplying on the map. */
  markTrader(o) {
    const g = this.g, t = g.npcs.residents.find((r) => r.id === o.trader); if (!t) return;
    if (!g.waypoint) g.setWaypoint({ x: t.x, z: t.z, name: `${o.traderName} (supply order)`, radius: 6 });
  }
}
