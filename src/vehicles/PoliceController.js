import * as THREE from 'three';
import { PoliceSystem, pickCheckpoints, manned, speedLimit, POLICE, OFFENCE_LABEL } from '../sim/Police.js';
import { naira } from '../economy/Economy.js';
import { weekdayOf } from '../sim/Calendar.js';

/*
  Traffic police in the world: checkpoint props (drums, cones, a sign) and two officers at each post,
  watching for offences while you drive, the stop, the fine, running away, and held vehicles.
  Rules are in sim/Police.js.
*/
function signTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#1b2a4a'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(4, 4, 248, 88);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 34px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText('POLICE', 128, 36);
  g.font = '700 18px "DM Sans", system-ui, sans-serif'; g.fillText('CHECKPOINT · SLOW DOWN', 128, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class PoliceController {
  constructor(game) { this.g = game; this.speedT = 0; this.wrongT = 0; this.warnedPost = null; }

  setup() {
    const g = this.g;
    this.posts = pickCheckpoints(g.graph, g.world.landmarks);
    const grp = new THREE.Group(); grp.name = 'PoliceCheckpoints';
    const drumMat = new THREE.MeshStandardMaterial({ color: '#d9480f', roughness: 0.6 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#f1f3f5', roughness: 0.6 });
    const coneMat = new THREE.MeshStandardMaterial({ color: '#ff6b00', roughness: 0.5 });
    const drumGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12); drumGeo.translate(0, 0.45, 0);
    const stripeGeo = new THREE.CylinderGeometry(0.305, 0.305, 0.12, 12); stripeGeo.translate(0, 0.6, 0);
    const coneGeo = new THREE.ConeGeometry(0.17, 0.55, 10); coneGeo.translate(0, 0.275, 0);
    const signMat = new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.6, side: THREE.DoubleSide });
    for (const p of this.posts) {
      const ux = Math.sin(p.heading), uz = Math.cos(p.heading);
      const at=(along,lateral)=>({x:p.cx+ux*along+p.nx*lateral,z:p.cz+uz*along+p.nz*lateral});
      const edge=p.road.width/2;
      for(const along of[-7,7]){const q=at(along,edge+1);const d=new THREE.Mesh(drumGeo,drumMat),s=new THREE.Mesh(stripeGeo,stripeMat);d.position.set(q.x,0,q.z);s.position.copy(d.position);grp.add(d,s);g.world.collision.addCircle(q.x,q.z,.35);}
      // Both approaches: road-edge cones and advance warning, no solid barrier across either lane.
      for(const side of[-1,1])for(const along of[9,15,22]){const q=at(along*side,edge+.25+(22-along)*.025);const cone=new THREE.Mesh(coneGeo,coneMat);cone.position.set(q.x,0,q.z);grp.add(cone);}
      for(const side of[-1,1]){const q=at(29*side,edge+1.2);const board=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.68),signMat);board.position.set(q.x,1.4,q.z);board.rotation.y=p.heading+(side<0?Math.PI:0);grp.add(board);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.4,6),new THREE.MeshStandardMaterial({color:'#555'}));pole.position.set(q.x,.7,q.z);grp.add(pole);}
      for(const k of[-1,1]){const q=at(k*3,edge+.9);g.npcs.addAnchored({id:`police:${p.id}:${k}`,kind:'police',role:'police',name:k<0?'Sergeant':'Corporal',...q,nx:-p.nx,nz:-p.nz,schedule:[8,18],activity:'checkpoint'});}
      g.interactions.register({
        x: p.x, z: p.z, radius: 3.5,
        enabled: () => !!this.sys && !g.vehicles?.driving && Object.values(this.sys.state.held).some((h) => h.post === p.id),
        label: () => { const e = Object.entries(this.sys.state.held).find(([, h]) => h.post === p.id); return `Police: pay ${naira(e[1].amount)} to release your vehicle`; },
        onInteract: () => this.releaseHere(p),
      });
    }
    this.group=grp;g.renderer.scene.add(grp);
    g.traffic.policeControl=(v,want,dt)=>this.controlTraffic(v,want,dt);
  }

  start(saveData) {
    saveData.police ??= {};
    this.sys = new PoliceSystem(saveData.police, { economy: this.g.economy, posts: this.posts, bus: this.g.bus });
    this.stopShown = false;this.clearanceUntil=performance.now()/1000+Math.max(0,((this.sys.state.clearedUntil||0)-Date.now())/1000);
  }

  open() {
    const g = this.g;
    return manned(weekdayOf(g.clock.day), g.clock.minutes / 60, g.weather?.w.rain ?? 0);
  }

  /** Someone near the player says it (for the language pack's police expressions). */
  shout(line) {
    const g = this.g, p = g.player.position;
    const n = g.npcs.active.filter((a) => a.state !== 'ride' && a.identity.kind !== 'police').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (n && Math.hypot(n.x - p.x, n.z - p.z) < 40) g.npcs.say(n, line, 3);
  }

  /** Called every frame while you drive. */
  update(dt, v, car) {
    if (!this.sys) return;
    const g = this.g, now = performance.now() / 1000, open = this.open();
    const sys = this.sys;
    if(now<(this.clearanceUntil||0)||g.story?.s?.pending)return;
    const near=sys.watching(v.x,v.z,open);
    if(!sys.stop){
      if(!near)return;
      const dx=v.x-near.cx,dz=v.z-near.cz,along=dx*Math.sin(near.heading)+dz*Math.cos(near.heading),lateral=dx*near.nx+dz*near.nz;
      if(Math.abs(along)>32||Math.abs(lateral)>near.road.width/2+1.5)return;
      // A routine flag-down, whether or not the driver has committed a traffic offence.
      const s=sys.notice('checkpoint',v.x,v.z,{open,nowS:now});if(!s)return;
      this.stopShown=false;g.audio.horn?.(0,6);g.ui.toast('Police checkpoint — slow down and stop.');
      g.setWaypoint({x:near.cx,z:near.cz,name:near.name,radius:8,police:true});
    }
    const status=sys.progress(v.x,v.z,car.speed,now);
    if(status==='stopped'&&!this.stopShown){this.stopShown=true;g.openChoice(()=>this.stopView());}
    else if(status==='fled')this.runFromStop();
  }

  controlTraffic(v,want,dt){
    if(!this.sys||!this.open())return want;
    const p=this.sys.watching(v.x,v.z,true);if(!p)return want;
    v.checkpointPass??={};if((v.checkpointPass[p.id]||0)>this.g.traffic.time)return want;
    const dx=p.cx-v.x,dz=p.cz-v.z,ahead=dx*v.dx+dz*v.dz,lateral=Math.abs(dx*(-v.dz)+dz*v.dx);
    if(lateral>p.road.width/2+1||ahead<0||ahead>30)return want;
    const gap=Math.max(0,ahead-5-v.T.len*.5);
    if(gap<1.2&&v.speed<.8){v.checkpointDwell=(v.checkpointDwell||0)+dt;if(v.checkpointDwell>=2.5){v.checkpointDwell=0;v.checkpointPass[p.id]=this.g.traffic.time+100;return want;}v.speed=0;return 0;}
    return Math.min(want,Math.max(0,gap*.7));
  }

  runFromStop(){const g=this.g,sys=this.sys;if(!sys?.stop)return false;
    if(g.saveData.character.ageGroup==='child'){sys.stop=null;this.clearanceUntil=performance.now()/1000+POLICE.cooldownSeconds;sys.state.clearedUntil=Date.now()+POLICE.cooldownSeconds*1000;g.closeChoice();g.ui.toast('An officer gives you a warning. No payment.');return false;}
    if(!g.story?.s||g.story.s.pending||g.story.s.arrest)return false;
    const s=sys.flee();g.closeChoice();if(g.waypoint?.police)g.setWaypoint(null);
    this.clearanceUntil=performance.now()/1000+POLICE.cooldownSeconds;sys.state.clearedUntil=Date.now()+POLICE.cooldownSeconds*1000;
    if(g.vehicles.driving){g.vehicles.car.speed=0;g.vehicles.stopDriving({silent:true});}
    g.ui.toast('You leave the car and run — police pursuit!');
    const started=g.story.startChase('police','Checkpoint evasion');g.saveGame();return started;
  }

  /** You knocked someone down (from the driving collisions). */
  hitPerson() { this.hitT = 2; }

  statusLine(v) {
    const s = this.sys?.stop; if (!s) return this.sys?.state.wanted ? 'Wanted by the police — avoid the checkpoints or stop and pay' : null;
    const left = Math.max(0, Math.ceil(s.deadline - performance.now() / 1000));
    return `POLICE: stop at the ${s.post.name} (${Math.round(Math.hypot(s.post.x - v.x, s.post.z - v.z))} m · ${left} s)`;
  }

  stopView() {
    const g=this.g,sys=this.sys,s=sys.stop;if(!s)return null;
    const child=g.saveData.character.ageGroup==='child';
    return {title:s.post.name,kicker:'FICTIONAL CHECKPOINT ENCOUNTER',text:'An officer flags you down and demands ₦200. Give ₦200 or leave the car and run into the police chase mini-game.',note:'This is a fictional extortion encounter, not a lawful police fee. No payment is automatic. Running starts a 450 m escape game; being caught leads to the existing station/bail system.',options:[
      {label:'Give police ₦200',primary:true,disabled:!g.economy.canAfford(200),why:'Not enough money — choose Run',act:()=>{if(sys.stop!==s)return;const r=sys.pay();if(!r.ok){g.ui.toast('Not enough money.');return;}this.clearanceUntil=performance.now()/1000+POLICE.cooldownSeconds;sys.state.clearedUntil=Date.now()+POLICE.cooldownSeconds*1000;g.closeChoice();if(g.waypoint?.police)g.setWaypoint(null);g.ui.toast('₦200 paid. The officer waves you through.');g.saveGame();}},
      {label:'Run — start police chase',disabled:child,why:'Chase gameplay is unavailable for child characters',act:()=>this.runFromStop()},
      ...(child?[{label:'Ask for an adult / receive a warning · free',act:()=>{sys.stop=null;this.clearanceUntil=performance.now()/1000+POLICE.cooldownSeconds;sys.state.clearedUntil=Date.now()+POLICE.cooldownSeconds*1000;g.closeChoice();if(g.waypoint?.police)g.setWaypoint(null);g.saveGame();}}]:[])
    ]};
  }

  isHeld(vehicleId) { return this.sys?.state.held[vehicleId] ?? null; }

  releaseHere(post) {
    const g = this.g, e = Object.entries(this.sys.state.held).find(([, h]) => h.post === post.id); if (!e) return;
    const [vid, h] = e;
    g.openChoice(() => ({
      title: post.name, kicker: 'POLICE', text: `Officer: “Your vehicle dey here. Pay ${naira(h.amount)} and carry am go.”`,
      options: [
        { label: `Pay ${naira(h.amount)}`, primary: true, disabled: !g.economy.canAfford(h.amount), why: 'Not enough money', act: () => {
          const r = this.sys.release(vid);
          g.closeChoice(); g.ui.toast(r.ok ? 'Your vehicle is released. Drive carefully.' : 'Not enough money'); if (r.ok) g.saveGame();
        } },
        { label: 'Not now', ghost: true, act: () => g.closeChoice() },
      ],
    }));
  }
}
