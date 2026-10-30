import {uiIcon} from './UIIcons.js';
import { SKIN_TONES, HAIR_STYLES, OUTFITS, OUTFIT_COLORS, SHOE_COLORS, OUTFIT_CATEGORIES } from '../characters/HumanRig.js';
import { ANKARA_PALETTES } from '../characters/ClothingTextures.js';
import { EXPR, EXPRESSIONS, CATEGORY_NAMES } from '../data/onitshaExpressions.js';
import { PHONE_MODELS } from '../phone/PhoneController.js';
import { NEED_LABELS } from '../player/Needs.js';
import { outfitInfo } from '../characters/Wardrobe.js';
import { naira } from '../economy/Economy.js';

import {AGE_GROUPS,BODY_TYPES} from '../data/careers.js';
const $ = (sel, root = document) => root.querySelector(sel);
const SCREENS = ['loading', 'menu', 'creator', 'hud', 'pause', 'settings', 'map', 'credits', 'confirm', 'dialogue', 'phrasebook', 'shop', 'bag', 'jobs', 'stop', 'choice', 'homes', 'phone', 'chase', 'activity'];

/** All DOM UI. Game logic never touches the DOM directly — it calls these methods. */
export class UIManager {
  constructor(bus) {
    this.bus = bus;
    this.el = Object.fromEntries(SCREENS.map((s) => [s, $(`#screen-${s}`)]));
    this.hud = {
      location: $('[data-slot=location]', this.el.hud), place: $('[data-slot=place]', this.el.hud), time: $('[data-slot=time]', this.el.hud),
      period: $('[data-slot=period]', this.el.hud), day: $('[data-slot=day]', this.el.hud),
      fps: $('.hud-fps', this.el.hud), hints: $('.hud-hints', this.el.hud), toasts: $('.toasts', this.el.hud),
      north: $('.minimap-n', this.el.hud), weather: $('[data-slot=weather]', this.el.hud), power: $('[data-slot=power]', this.el.hud),
    };
    this.miniCanvas = $('.minimap', this.el.hud);
    this.bigCanvas = $('.bigmap', this.el.map);
    this._lastHud = {};

    // generic action routing: data-action buttons emit ui:<screen>:<action>
    for (const [name, el] of Object.entries(this.el)) {
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-action]');
        if (!t || !el.contains(t)) return;
        this.bus.emit(`ui:${name}:${t.dataset.action}`, t);
      });
    }
  }

  show(name, on = true) { this.el[name].hidden = !on; }
  only(...names) { for (const s of SCREENS) if (s !== 'loading') this.el[s].hidden = !names.includes(s); }
  isOpen(name) { return !this.el[name].hidden; }

  setLoading(p, text) {
    const percent = Math.max(0, Math.min(100, Math.round(p * 100)));
    $('.loadbar-fill', this.el.loading).style.width = `${percent}%`;
    $('.loadbar', this.el.loading).setAttribute('aria-valuenow', String(percent));
    if (text) $('.load-status', this.el.loading).textContent = text;
  }
  hideLoading() { this.el.loading.hidden = true; }

  /** A small dismissible bar for a recovered error, with the details ready to copy for a bug report. */
  errorBar(message) {
    let el = document.getElementById('errbar');
    if (!el) {
      el = document.createElement('div'); el.id = 'errbar'; el.setAttribute('role', 'alert');
      el.innerHTML = '<span data-slot="err"></span><button type="button" data-err="copy">Copy details</button><button type="button" data-err="close" aria-label="Dismiss">✕</button>';
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-err]'); if (!b) return;
        if (b.dataset.err === 'close') el.hidden = true;
        else {
          const text = JSON.stringify({ build: document.querySelector('.menu-foot')?.textContent, ua: navigator.userAgent, errors: window.__onitshaErrors ?? [] }, null, 1);
          navigator.clipboard?.writeText(text).then(() => { b.textContent = 'Copied'; }, () => { window.prompt('Copy this and send it to the developer:', text); });
        }
      });
      document.getElementById('app')?.appendChild(el);
    }
    el.hidden = false;
    el.querySelector('[data-slot=err]').textContent = `Something went wrong (${message}). The game kept running.`;
  }

  /** The main menu while a save loads. */
  setMenuBusy(busy, text = '') {
    const btn = $('[data-action=continue]', this.el.menu);
    if (!btn) return;
    btn.disabled = busy; btn.classList.toggle('busy', busy);
    const sub = $('[data-slot=save-summary]', btn);
    if (busy) { this._menuSub = sub.textContent; sub.textContent = text; } else if (this._menuSub != null) { sub.textContent = this._menuSub; this._menuSub = null; }
  }

  fatal(msg) {
    const f = $('#fatal'); f.hidden = false;
    f.innerHTML = `<div><h2 style="font-family:var(--font-display)">Something went wrong</h2><p style="color:var(--cream-dim);max-width:46ch">${msg}</p></div>`;
  }

  setMenuSave(summary) {
    const btn = $('[data-action=continue]', this.el.menu);
    btn.hidden = !summary;
    if (summary) $('[data-slot=save-summary]', btn).textContent = `${summary.name} · Saved ${new Date(summary.updatedAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })} WAT`;
  }

  // ------------------------------------------------------------- creator
  buildCreator(app, onChange) {
    const root = this.el.creator;
    const state = { ...app };
    const fire = () => onChange({ ...state });
    const name = $('[data-field=name]', root);
    name.value = state.name ?? '';
    name.oninput = () => { state.name = name.value.trim(); onChange({ ...state }, { nameOnly: true }); };

    state.phone ??= 'osha';
    let outfitCategory = 'all';
    const renderButtons = () => {
      this._chips($('[data-field=phone]', root), PHONE_MODELS, state.phone, (v) => { state.phone = v; renderButtons(); fire(); });
      this._chips($('[data-field=ageGroup]',root),this.accountMode?AGE_GROUPS.filter(([id])=>id!=='child'):AGE_GROUPS,state.ageGroup??'adult',v=>{state.ageGroup=v;renderButtons();fire();});
      this._chips($('[data-field=bodyType]',root),BODY_TYPES,state.bodyType??'average',v=>{state.bodyType=v;renderButtons();fire();});
      delete state.career; // v0.40: no job is chosen at creation; you find work in the city
      const g = state.gender;
      this._seg($('[data-field=gender]', root), [['male', 'Male'], ['female', 'Female']], g, (v) => {
        state.gender = v; state.hair = HAIR_STYLES[v][0].id; state.outfit = OUTFITS[v][0].id; outfitCategory='all'; renderButtons(); fire();
      });
      this._swatches($('[data-field=skin]', root), SKIN_TONES.map((c, i) => [i, c, `Skin tone ${i + 1}`]), state.skin, (v) => { state.skin = v; renderButtons(); fire(); });
      this._chips($('[data-field=hair]', root), HAIR_STYLES[g].map((h) => [h.id, h.label]), state.hair, (v) => { state.hair = v; renderButtons(); fire(); });
      this._chips($('[data-field=outfit-category]',root),OUTFIT_CATEGORIES,outfitCategory,v=>{outfitCategory=v;renderButtons();});
      this._chips($('[data-field=outfit]', root), OUTFITS[g].filter(o=>outfitCategory==='all'||o.category===outfitCategory).map((o) => [o.id, o.label]), state.outfit, (v) => { state.outfit = v; renderButtons(); fire(); });
      this._swatches($('[data-field=palette]', root), ANKARA_PALETTES.map((p, i) => [i, `linear-gradient(135deg, ${p[0]} 0 40%, ${p[1]} 40% 60%, ${p[2]} 60% 80%, ${p[3]} 80%)`, `Ankara print ${i + 1}`]), state.palette, (v) => { state.palette = v; renderButtons(); fire(); });
      this._swatches($('[data-field=color]', root), OUTFIT_COLORS.map((c, i) => [i, c, `Colour ${i + 1}`]), state.color, (v) => { state.color = v; renderButtons(); fire(); });
      const look=outfitInfo(g,state.outfit);
      const hairField=$('[data-field=hair]',root);hairField.closest('.field').classList.remove('disabled');hairField.title='';
      const usesPrint = !!look.print;
      const usesPlain = state.outfit==='model_dress'||look.kind!=='gown'&&state.outfit!=='ankara_jeans'&&state.outfit!=='ankara_top_jeans';
      this._swatches($('[data-field=bottomColor]',root),[[null,'linear-gradient(135deg,#c7b99d,#2d3e59)','Outfit default'],...OUTFIT_COLORS.map((c,i)=>[i,c,`Trouser / shorts colour ${i+1}`])],state.bottomColor??null,v=>{state.bottomColor=v;renderButtons();fire();});
      this._swatches($('[data-field=shoeColor]',root),[[null,'linear-gradient(135deg,#f0ede5,#181a1e)','Outfit default'],...SHOE_COLORS.map((c,i)=>[i,c,`Shoe colour ${i+1}`])],state.shoeColor??null,v=>{state.shoeColor=v;renderButtons();fire();});
      $('[data-field=bottomColor]',root).closest('.field').classList.toggle('disabled',['gown','blouse'].includes(look.kind));
      $('[data-field=palette]', root).closest('.field').classList.toggle('disabled', !usesPrint);
      $('[data-field=color]', root).closest('.field').classList.toggle('disabled', !usesPlain);
    };
    renderButtons();
    return state;
  }

  bindCreatorStart(background, listings, onHome) {
    const root = this.el.creator;
    $('[data-slot=creator-background]', root).textContent = `${background.label} · ${background.alias}`;
    $('[data-slot=creator-funds]', root).textContent = `${naira(background.balance)} starting balance · game money`;
    const select = $('[data-field=starting-home]', root); select.replaceChildren();
    const street = document.createElement('option'); street.value = ''; street.textContent = 'No home yet · Old Market Road (free)'; select.append(street);
    const groups = new Map();
    for (const home of [...listings].sort((a,b) => a.rent - b.rent || a.id.localeCompare(b.id))) {
      let group = groups.get(home.type);
      if (!group) { group = document.createElement('optgroup'); group.label = home.label; groups.set(home.type, group); select.append(group); }
      const option = document.createElement('option'); option.value = home.id;
      option.textContent = `${home.street ?? 'Onitsha residential street'} · ${naira(home.rent)} / ${home.days} days · ${home.area} m² · ${home.buildingId}`;
      option.disabled = home.rent > background.balance; group.append(option);
    }
    const update = () => {
      const home = listings.find(h => h.id === select.value);
      onHome(home?.id ?? null);
      $('[data-slot=creator-home-detail]', root).textContent = home ? `${home.label}. ${home.blurb} Rent is paid now for ${home.days} days. You start inside this home; normal renewal rules apply.` : 'Start on the street with your full balance. You can rent a home later at a TO LET door.';
      $('[data-slot=creator-remaining]', root).textContent = `Balance after starting: ${naira(background.balance - (home?.rent ?? 0))}`;
      $('[data-action=start] .btn-label', root).textContent = home ? 'Rent & start at home' : 'Start on Old Market Road';
      $('[data-slot=creator-start-error]', root).hidden = true;
    };
    select.onchange = update; update();
    $('.creator-body', root).scrollTop = 0;
  }

  creatorStartError(message) {
    const el = $('[data-slot=creator-start-error]', this.el.creator); el.textContent = message; el.hidden = false;
    el.scrollIntoView({ block: 'nearest' });
  }

  _seg(el, items, value, cb) {
    el.innerHTML = '';
    for (const [v, label] of items) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.setAttribute('aria-pressed', String(v === value)); b.onclick = () => cb(v); el.appendChild(b);
    }
  }
  _chips(el, items, value, cb) { this._seg(el, items, value, cb); }
  _swatches(el, items, value, cb) {
    el.innerHTML = '';
    for (const [v, bg, label] of items) {
      const b = document.createElement('button'); b.type = 'button'; b.style.background = bg; b.title = label; b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', String(v === value)); b.onclick = () => cb(v); el.appendChild(b);
    }
  }

  // ------------------------------------------------------------- settings
  bindSettings(settings, onChange) {
    const root = this.el.settings;
    const q = $('[data-setting=quality]', root);
    const render = () => {
      this._seg(q, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], settings.quality, (v) => { settings.quality = v; render(); onChange(settings); });
    };
    render();
    const sens = $('[data-setting=sensitivity]', root), out = $('[data-out=sensitivity]', root);
    sens.value = settings.sensitivity; out.textContent = `${(+settings.sensitivity).toFixed(1)}×`;
    sens.oninput = () => { settings.sensitivity = +sens.value; out.textContent = `${settings.sensitivity.toFixed(1)}×`; onChange(settings); };
    const vol = $('[data-setting=volume]', root), vout = $('[data-out=volume]', root);
    vol.value = settings.volume ?? 0.7; vout.textContent = `${Math.round((settings.volume ?? 0.7) * 100)}%`;
    vol.oninput = () => { settings.volume = +vol.value; vout.textContent = `${Math.round(settings.volume * 100)}%`; onChange(settings); };
    const inv = $('[data-setting=invertY]', root); inv.checked = settings.invertY; inv.onchange = () => { settings.invertY = inv.checked; onChange(settings); };
    const fps = $('[data-setting=showFps]', root); fps.checked = settings.showFps; fps.onchange = () => { settings.showFps = fps.checked; onChange(settings); };
    const fov = $('[data-setting=fov]', root), fout = $('[data-out=fov]', root);
    fov.value = settings.fov; fout.textContent = `${settings.fov}°`;
    fov.oninput = () => { settings.fov = +fov.value; fout.textContent = `${settings.fov}°`; onChange(settings); };
    const ad = $('[data-setting=adaptive]', root); ad.checked = settings.adaptive !== false; ad.onchange = () => { settings.adaptive = ad.checked; onChange(settings); };
    const hints = $('[data-setting=hints]', root); hints.checked = settings.hints !== false; hints.onchange = () => { settings.hints = hints.checked; onChange(settings); };
    const lw=$('[data-setting=liveWeather]',root);lw.checked=settings.liveWeather!==false;lw.onchange=()=>{settings.liveWeather=lw.checked;onChange(settings);};

  }

  contextLost() { $('#ctx-lost').hidden = false; }
  contextRestored() { /* three.js rebuilds GPU resources itself; a reload is still offered for safety */ }

  // ------------------------------------------------------------- HUD
  updateHUD({ location, time, period, day, fps, northAngle, env }) {
    const set = (k, v, el) => { if (this._lastHud[k] !== v) { this._lastHud[k] = v; el.textContent = v; } };
    const loc = typeof location === 'string' ? { place: null, street: location } : location;
    set('location', loc.street, this.hud.location);
    if (this._lastHud.place !== loc.place) { this._lastHud.place = loc.place; this.hud.place.hidden = !loc.place; this.hud.place.textContent = loc.place ?? ''; this.hud.location.classList.toggle('sub', !!loc.place); }
    set('time', time, this.hud.time);
    set('period', period, this.hud.period);
    set('day', env?.day ?? 'WAT', this.hud.day);
    if (env) {
      set('weather', env.weather, this.hud.weather);
      if (this._lastHud.power !== env.power) { this._lastHud.power = env.power; this.hud.power.hidden = !env.power; this.hud.power.textContent = env.power ?? ''; }
    }
    if (fps !== undefined) set('fps', `${fps} fps`, this.hud.fps);
    if (northAngle !== undefined) this.hud.north.style.transform = `translateX(-50%) rotate(${northAngle * 57.2958}deg)`;
  }
  setFpsVisible(v) { this.hud.fps.hidden = !v; }
  fadeHints(after = 12000) { clearTimeout(this._hintT); this.hud.hints.classList.remove('fade'); this._hintT = setTimeout(() => this.hud.hints.classList.add('fade'), after); }

  toast(msg, ms = 2700) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    if (ms > 2700) t.style.animationDuration = `${ms / 1000 - 0.1}s`;
    this.hud.toasts.appendChild(t); setTimeout(() => t.remove(), ms);
  }

  confirm(title, text, yesLabel = 'Continue') {
    const root = this.el.confirm;
    $('[data-slot=title]', root).textContent = title;
    $('[data-slot=text]', root).textContent = text;
    $('[data-action=yes]', root).textContent = yesLabel;
    root.hidden = false;
    return new Promise((resolve) => {
      const done = (v) => { root.hidden = true; offY(); offN(); resolve(v); };
      const offY = this.bus.on('ui:confirm:yes', () => done(true));
      const offN = this.bus.on('ui:confirm:no', () => done(false));
    });
  }

  // ------------------------------------------------------------- interaction prompt & waypoint
  setPrompt(label) {
    const el = $('.hud-prompt', this.el.hud);
    if (this._prompt === label) return; this._prompt = label;
    el.hidden = !label; if (label) $('[data-slot=prompt]', el).textContent = label;
  }
  /** Turn the direction arrows on the waypoint and job chips: angle in radians, 0 = straight ahead, + = right. */
  setDirection(ang, toJob = false) {
    for (const el of this.el.hud.querySelectorAll('.wp-arrow, .job-arrow')) {
      const off = ang == null || (el.classList.contains('job-arrow') && !toJob);
      el.style.visibility = off ? 'hidden' : 'visible';
      if (ang != null) el.style.transform = `rotate(${(ang * 180 / Math.PI - 90).toFixed(1)}deg)`;
    }
  }
  /** Always-visible compass; a marked destination takes over the arrow. */
  setMapPlaces(places, onPick) {
    const root=this.el.map,select=root.querySelector('[data-slot=map-place]');if(!select)return;
    const key=places.map(p=>`${p.kind}:${p.label}:${Math.round(p.x)},${Math.round(p.z)}`).join('|');
    if(this._mapPlaceKey===key)return;this._mapPlaceKey=key;
    const selected=select.value;select.replaceChildren();const first=document.createElement('option');first.value='';first.textContent='Find River Niger, markets, filling stations, hotels…';select.append(first);
    const labels={monument:'Landmarks & monuments',stadium:'Stadiums',waterfront:'River Niger & boats',market:'Markets',venue:'Bars & clubs',eatery:'Eateries & restaurants',office:'Politics & government',mall:'Shopping',hospital:'Hospitals',bank:'Banks',business:'Your businesses',tolet:'Shops to let',court:'Courts',dealer:'Back-street dealer',car:'Cars for sale',job:'Active career job',ict:'ICT hub',workplace:'Career workplaces',hotel:'Hotels',fuel:'Filling stations',police:'Police station',efcc:'EFCC office',checkpoint:'Police checkpoints',agbero:'Agbero / area encounters'};
    for(const[kind,label]of Object.entries(labels)){const list=places.filter(p=>p.kind===kind);if(!list.length)continue;const group=document.createElement('optgroup');group.label=label;
      for(const place of list){const o=document.createElement('option');o.value=`${kind}:${place.id??place.label}`;o.textContent=place.label;group.append(o);o._place=place;}select.append(group);}
    select.value=selected;select.onchange=()=>{const p=select.selectedOptions[0]?._place;if(p)onPick(p);};
  }
  setNavigation(angle, title, detail, active = false) {
    const el = $('.hud-navigation', this.el.hud);
    el.classList.toggle('navigating', active);
    $('.navigation-arrow', el).style.transform = `rotate(${(angle * 180 / Math.PI - 90).toFixed(1)}deg)`;
    const heading = $('[data-slot=navigation-title]', el), sub = $('[data-slot=navigation-detail]', el);
    if (heading.textContent !== title) heading.textContent = title;
    if (sub.textContent !== detail) sub.textContent = detail;
  }
  setWaypoint(text) {
    const el = $('.hud-waypoint', this.el.hud);
    el.style.pointerEvents = 'auto';
    if (this._wp === text) return; this._wp = text;
    el.hidden = !text; if (text) $('[data-slot=waypoint]', el).textContent = text;
  }

  // ------------------------------------------------------------- speech bubbles
  renderBubbles(items) {
    const root = document.getElementById('bubbles');
    this._bubbleEls ??= new Map();
    const seen = new Set();
    for (const it of items) {
      seen.add(it.key);
      let el = this._bubbleEls.get(it.key);
      if (!el) { el = document.createElement('div'); el.className = 'bubble' + (it.target ? ' target' : ''); root.appendChild(el); this._bubbleEls.set(it.key, el); }
      if (el._text !== it.text) {
        el._text = it.text;
        const e = it.expr ? EXPR[it.expr] : null;
        el.innerHTML = '';
        const t = document.createElement('div'); t.className = 'bubble-text'; t.textContent = it.text; el.appendChild(t);
        if (e) { const m = document.createElement('div'); m.className = 'bubble-meaning'; m.textContent = e.meaning; el.appendChild(m); }
      }
      el.style.transform = `translate(-50%, -100%) translate(${it.x}px, ${it.y}px)`;
      el.style.opacity = it.alpha;
    }
    for (const [k, el] of this._bubbleEls) if (!seen.has(k)) { el.remove(); this._bubbleEls.delete(k); }
  }

  // ------------------------------------------------------------- dialogue
  openDialogue({ name, role, relLabel }) {
    const root = this.el.dialogue;
    $('[data-slot=npc-name]', root).textContent = name;
    $('[data-slot=npc-role]', root).textContent = role;
    $('[data-slot=npc-rel]', root).textContent = relLabel;
    root.hidden = false;
  }
  setDialogueRel(relLabel) { $('[data-slot=npc-rel]', this.el.dialogue).textContent = relLabel; }
  closeDialogue() { this.el.dialogue.hidden = true; }

  /** node: {expr, form, gen, note, responses:[{label, expr}]}; onChoose(index) */
  renderDialogueNode(node, onChoose) {
    const root = this.el.dialogue;
    const card = $('[data-slot=expr-card]', root);
    const e = node.expr ? EXPR[node.expr] : null;
    card.hidden = !e;
    if (e) {
      $('[data-slot=expr]', root).textContent = node.form !== undefined ? e.forms[Math.min(node.form, e.forms.length - 1)] : e.expression;
      $('[data-slot=meaning]', root).textContent = e.meaning;
    }
    $('[data-slot=line]', root).textContent = node.gen ?? '';
    const note = $('[data-slot=note]', root); note.hidden = !node.note; note.textContent = node.note ?? '';
    const list = $('[data-slot=responses]', root); list.innerHTML = '';
    node.responses.forEach((r, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'dlg-opt';
      const k = document.createElement('kbd'); k.textContent = String(i + 1); b.appendChild(k);
      const span = document.createElement('span'); span.textContent = r.label; b.appendChild(span);
      if (r.expr) { const sm = document.createElement('small'); sm.textContent = EXPR[r.expr]?.meaning ?? ''; b.appendChild(sm); }
      b.onclick = () => onChoose(i);
      list.appendChild(b);
    });
    list.querySelector('button')?.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------- phrasebook
  openPhrasebook(heard = new Set()) {
    const body = $('[data-slot=pb-body]', this.el.phrasebook);
    body.innerHTML = '';
    const usable = EXPRESSIONS.length;
    $('[data-slot=pb-count]', this.el.phrasebook).textContent = `Heard ${EXPRESSIONS.filter((e) => heard.has(e.id)).length} of ${usable}.`;
    for (const [cat, title] of Object.entries(CATEGORY_NAMES)) {
      const h = document.createElement('h3'); h.textContent = `${cat}. ${title}`; body.appendChild(h);
      const dl = document.createElement('div'); dl.className = 'pb-list';
      for (const e of EXPRESSIONS.filter((x) => x.category === cat)) {
        const row = document.createElement('div'); row.className = 'pb-row' + (heard.has(e.id) ? ' heard' : '');
        const ex = document.createElement('div'); ex.className = 'pb-expr'; ex.textContent = e.supplied ?? e.expression;
        const mn = document.createElement('div'); mn.className = 'pb-meaning'; mn.textContent = e.supplied ? `${e.expression} = ${e.meaning}` : e.meaning;
        const tags = document.createElement('div'); tags.className = 'pb-tags';
        tags.textContent = [heard.has(e.id) ? '✓ heard' : null, e.usable ? null : 'reference only', e.triggers.some((t) => t.startsWith('event:')) && e.usable ? 'used in events' : null, 'unverified'].filter(Boolean).join(' · ');
        row.append(ex, mn, tags);
        if (e.notes) { const n = document.createElement('div'); n.className = 'pb-note'; n.textContent = e.notes; row.appendChild(n); }
        dl.appendChild(row);
      }
      body.appendChild(dl);
    }
    this.el.phrasebook.hidden = false;
  }

  // ------------------------------------------------------------- wallet & job chips
  setWallet(balance, bump = false) {
    const chip = $('.hud-wallet', this.el.hud);
    $('[data-slot=wallet]', chip).textContent = Math.round(balance).toLocaleString('en-NG');
    if (bump) { chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); }
  }
  setJobChip(text, urgent = false) {
    const el = $('.hud-job', this.el.hud);
    el.classList.toggle('urgent', !!urgent);
    if (this._job === text) return; this._job = text;
    el.hidden = !text; if (text) $('[data-slot=job]', el).textContent = text;
  }
  setNeeds(values) {
    const root = $('.hud-needs', this.el.hud);
    if (!root.children.length) for (const [id,label] of Object.entries(NEED_LABELS)) {
      const el = document.createElement('div'); el.className = 'need-meter'; el.dataset.need = id;
      const name = document.createElement('span'); name.innerHTML=uiIcon(id); name.title = label;
      const track = document.createElement('div'); track.className = 'need-track'; const fill = document.createElement('i'); track.append(fill);
      const val = document.createElement('b'); el.append(name,track,val); root.append(el);
    }
    for (const el of root.children) { const value=Math.round(values[el.dataset.need]??0);el.querySelector('i').style.width=`${value}%`;el.querySelector('b').textContent=value;el.classList.toggle('low',value<25);el.setAttribute('aria-label',`${NEED_LABELS[el.dataset.need]} ${value} of 100`); }
  }
  setEnergy(value, label) {
    const el = $('.hud-energy', this.el.hud);
    const v = Math.round(value);
    if (this._energy === v) return; this._energy = v;
    $('i', el).style.width = `${v}%`;
    el.classList.toggle('low', v < 25);
    el.title = `Energy ${v}% · ${label}`;
    $('[data-slot=energy]', el).textContent = `${v}`;
  }

  // ------------------------------------------------------------- public transport
  setTransit(text) {
    const el = $('.hud-transit', this.el.hud);
    if (this._transit === text) return; this._transit = text;
    el.hidden = !text; if (text) $('[data-slot=transit]', el).textContent = text;
  }
  /** view from TransportController.rideView() or null */
  setRide(view) {
    const el = $('.hud-ride', this.el.hud);
    const key = view ? JSON.stringify(view) : null;
    if (this._ride === key) return; this._ride = key;
    el.hidden = !view;
    this.el.hud.classList.toggle('riding', !!view);
    document.getElementById('app')?.classList.toggle('riding', !!view);
    if (!view) return;
    const badge = $('[data-slot=ride-badge]', el); badge.textContent = view.badge; badge.style.background = view.color;
    $('[data-slot=ride-title]', el).textContent = view.title;
    $('[data-slot=ride-status]', el).textContent = view.status;
    $('[data-slot=ride-detail]', el).textContent = view.detail;
    $('[data-action=ride-down]', el).disabled = !view.canDown;
    $('[data-action=ride-next]', el).disabled = !view.canAsk;
    $('[data-action=ride-here]', el).disabled = !view.canAsk;
    const vb = $('[data-action=ride-view]', el); vb.hidden = !view.keke; vb.textContent = view.seatView ? 'Outside view (C)' : 'Seat view (C)';
    const sk = $('[data-action=ride-skip]', el); sk.hidden = !view.canSkip; if (view.skipLabel) sk.firstChild.textContent = view.skipLabel + ' ';
  }

  /** Driving panel: view from VehicleController.driveView() or null. */
  setDrive(view) {
    const el = $('.hud-drive', this.el.hud);
    const key = view ? JSON.stringify(view) : null;
    if (this._drive === key) return; this._drive = key;
    el.hidden = !view;
    this.el.hud.classList.toggle('riding', !!view || !$('.hud-ride', this.el.hud).hidden);
    document.getElementById('app')?.classList.toggle('driving', !!view);
    if (!view) return;
    $('[data-slot=drive-title]', el).textContent = view.title;
    $('[data-slot=drive-speed]', el).textContent = view.speed;
    const f = $('[data-slot=drive-fuel]', el); f.style.width = `${Math.max(0, Math.min(100, (view.fuel / view.tank) * 100))}%`;
    f.parentElement.classList.toggle('low', view.low); el.style.setProperty('--fuel', `${Math.max(0, Math.min(100, (view.fuel / view.tank) * 100))}%`);
    $('[data-slot=drive-litres]', el).textContent = `${view.fuel.toFixed(1)} / ${view.tank} L`;
    $('[data-slot=drive-status]', el).textContent = view.status;
    $('[data-action=drive-exit]', el).disabled = !view.canExit;
    $('[data-action=drive-fuel]', el).hidden = !view.canFuel;
    $('[data-action=drive-pickup]', el).hidden = !view.canPickup;
    const sk = $('[data-action=drive-skip]', el); sk.hidden = !view.skip; if (view.skip) sk.firstChild.textContent = view.skip + ' ';
  }

  /** Fade to black, run fn, fade back (entering a house, sleeping, skipping a trip). */
  fade(fn) {
    const f = document.getElementById('fade');
    f.classList.add('on');
    setTimeout(() => { try { fn(); } finally { setTimeout(() => f.classList.remove('on'), 60); } }, 260);
  }

  // ------------------------------------------------------------- generic choice panel
  renderChoice(view) {
    const root = this.el.choice;
    // quick menus (your car, your front door) are a small card at the bottom; the city stays visible above
    root.classList.toggle('choice-sheet', !!view.sheet);
    root.onclick = view.sheet ? (e) => { if (e.target === root) this.bus.emit('ui:choice:close'); } : null;
    const k = $('[data-slot=choice-kicker]', root); k.hidden = !view.kicker; k.textContent = view.kicker ?? '';
    $('[data-slot=choice-title]', root).textContent = view.title;
    const e = view.expr ? EXPR[view.expr] : null;
    const ex = $('[data-slot=choice-expr]', root); ex.hidden = !e;
    if (e) { $('[data-slot=choice-expr-text]', root).textContent = e.expression; $('[data-slot=choice-expr-meaning]', root).textContent = e.meaning; }
    const t = $('[data-slot=choice-text]', root); t.hidden = !view.text; t.textContent = view.text ?? '';
    const n = $('[data-slot=choice-note]', root); n.hidden = !view.note; n.textContent = view.note ?? '';
    const body = $('[data-slot=choice-body]', root); body.innerHTML = '';
    this._choice = [];
    const addOpt = (list, o) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'choice-opt' + (o.primary ? ' primary' : '') + (o.ghost ? ' ghost' : '');
      b.disabled = !!o.disabled; if (o.disabled && o.why) b.title = o.why;
      const idx = this._choice.length;
      if (idx < 9) { const kb = document.createElement('kbd'); kb.textContent = String(idx + 1); b.appendChild(kb); }
      const span = document.createElement('span'); span.className = 'choice-label'; span.textContent = o.label;if(/^#[0-9a-f]{6}$/i.test(o.color??'')){const swatch=document.createElement('span');swatch.className='choice-paint';swatch.style.backgroundColor=o.color;swatch.setAttribute('aria-hidden','true');span.prepend(swatch);span.style.display='inline-flex';span.style.alignItems='center';} b.appendChild(span);
      if (o.sub || (o.disabled && o.why)) { const sm = document.createElement('small'); sm.textContent = o.sub ?? o.why; b.appendChild(sm); }
      if (o.expr && EXPR[o.expr]) { const sm = document.createElement('small'); sm.textContent = EXPR[o.expr].meaning; b.appendChild(sm); }
      b.onclick = () => { if (!o.disabled) o.act(); };
      this._choice.push(o);
      list.appendChild(b);
    };
    for (const sec of view.sections ?? []) {
      const h = document.createElement('h3'); h.textContent = sec.heading; body.appendChild(h);
      const list = document.createElement('div'); list.className = 'choice-list';
      if (!sec.options.length) { const p = document.createElement('p'); p.className = 'choice-empty'; p.textContent = sec.empty ?? 'Nothing here.'; list.appendChild(p); }
      for (const o of sec.options) addOpt(list, o);
      body.appendChild(list);
    }
    const list = document.createElement('div'); list.className = 'choice-list choice-main';
    for (const o of view.options ?? []) addOpt(list, o);
    body.appendChild(list);
    root.hidden = false;
    root.querySelector('.choice-opt:not([disabled])')?.focus({ preventScroll: true });
  }
  pickChoice(i) { const o = this._choice?.[i]; if (o && !o.disabled) o.act(); }

  // ------------------------------------------------------------- homes & vehicles list
  renderHomes({ homes, sale, mine, balance }) {
    const root = this.el.homes, body = $('[data-slot=homes-body]', root); body.innerHTML = '';
    $('[data-slot=homes-wallet]', root).textContent = naira(balance);
    const section = (title, rows, empty) => {
      const h = document.createElement('h3'); h.textContent = title; body.appendChild(h);
      const ul = document.createElement('ul'); ul.className = 'homes-list';
      if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = empty; ul.appendChild(li); }
      for (const r of rows) {
        const li = document.createElement('li'); if (r.mine) li.className = 'mine';
        const left = document.createElement('div'); left.className = 'homes-info';
        const b = document.createElement('b'); b.textContent = r.title;
        const sm = document.createElement('small'); sm.textContent = [r.status, r.area, r.where].filter(Boolean).join(' · ');
        left.append(b);
        if (r.place) { const pl = document.createElement('small'); pl.className = 'homes-place'; pl.textContent = '📍 ' + r.place; left.append(pl); }
        left.append(sm);
        const right = document.createElement('div'); right.className = 'homes-right';
        const pr = document.createElement('span'); pr.className = 'homes-price'; pr.textContent = r.price;
        const go = document.createElement('button'); go.type = 'button'; go.className = 'btn btn-small'; go.textContent = 'Show on map'; go.onclick = r.go;
        right.append(pr, go);
        li.append(left, right); ul.appendChild(li);
      }
      body.appendChild(ul);
    };
    section('Homes to rent or buy', homes, 'No listings.');
    section('Vehicles for sale', sale, 'Everything has been sold.');
    if (mine.length) section('Your vehicles', mine, '');
    root.hidden = false;
  }

  /** Stop picker: view from TransportController.pickerView(); onPick(entryId) */
  renderStop(view, onPick) {
    const root = this.el.stop;
    $('[data-slot=stop-name]', root).textContent = view.title;
    $('[data-slot=stop-sub]', root).textContent = view.subtitle;
    const lines = $('[data-slot=stop-lines]', root); lines.innerHTML = '';
    for (const l of view.lines) {
      const c = document.createElement('span'); c.className = 'line-chip';
      const b = document.createElement('b'); b.textContent = l.id; b.style.background = l.color;
      c.append(b, document.createTextNode(`${l.mode} · ${l.name}`)); lines.appendChild(c);
    }
    const filter = $('[data-slot=stop-filter]', root);
    const list = $('[data-slot=stop-list]', root);
    this._stopPick = [];
    const draw = () => {
      const q = filter.value.trim().toLowerCase();
      list.innerHTML = ''; this._stopPick = [];
      const shown = view.entries.filter((e) => !q || e.name.toLowerCase().includes(q));
      if (!shown.length) list.innerHTML = '<li class="empty">No stop matches.</li>';
      for (const e of shown) {
        const li = document.createElement('li'); if (e.named) li.className = 'named';
        const b = document.createElement('button'); b.type = 'button';
        if (view.waitingFor === e.id) b.setAttribute('aria-pressed', 'true');
        const idx = this._stopPick.length;
        const left = document.createElement('span'); left.className = 'stop-dest';
        const nm = document.createElement('b'); nm.textContent = e.name;
        const sm = document.createElement('small'); sm.textContent = `${e.where} from you`;
        left.append(nm, sm);
        const opts = document.createElement('span'); opts.className = 'stop-opts';
        for (const o of e.options.slice(0, 3)) {
          const t = document.createElement('span'); t.className = 'stop-opt';
          const lb = document.createElement('i'); lb.textContent = o.line; lb.style.background = o.color;
          const fare = document.createElement('b'); fare.textContent = '₦' + o.fare.toLocaleString('en-NG');
          if (o.fare > view.balance) fare.className = 'short';
          t.append(lb, document.createTextNode(` ${o.mode} · ${o.stops} stop${o.stops === 1 ? '' : 's'} · ~${o.mins} min `), fare);
          opts.appendChild(t);
        }
        if (idx < 9) { const k = document.createElement('kbd'); k.textContent = String(idx + 1); b.appendChild(k); }
        b.append(left, opts);
        b.onclick = () => onPick(e.id);
        this._stopPick.push(() => onPick(e.id));
        li.appendChild(b); list.appendChild(li);
      }
    };
    filter.value = ''; filter.oninput = draw;
    draw();
    root.hidden = false;
  }
  pickStopOption(i) { this._stopPick?.[i]?.(); }

  // ------------------------------------------------------------- shop
  /** view: {name, goods, balance, items:[{id,name,price,owned}], selected, deal:{...}, reply:{expr, form, gen}} ; handlers: {select(id), buy(id), haggle(id), lowball(id)} */
  renderShop(view, h) {
    const root = this.el.shop;
    $('[data-slot=shop-name]', root).textContent = view.name;
    $('[data-slot=shop-goods]', root).textContent = view.goodsLabel;
    $('[data-slot=shop-wallet]', root).textContent = naira(view.balance);
    const e = view.reply?.expr ? EXPR[view.reply.expr] : null;
    $('[data-slot=reply-expr]', root).textContent = e ? (view.reply.form !== undefined ? e.forms[Math.min(view.reply.form, e.forms.length - 1)] : e.expression) : '';
    $('[data-slot=reply-expr]', root).hidden = !e;
    $('[data-slot=reply-meaning-row]', root).hidden = !e;
    $('[data-slot=reply-meaning]', root).textContent = e?.meaning ?? '';
    $('[data-slot=reply-line]', root).textContent = view.reply?.gen ?? '';
    const tabs = $('[data-slot=shop-tabs]', root);
    tabs.hidden = !view.canSell;
    for (const b of tabs.querySelectorAll('button')) { b.setAttribute('aria-pressed', String(b.dataset.tab === view.tab)); b.onclick = () => h.tab(b.dataset.tab); }
    $('[data-tab=sell]', tabs).textContent = `Sell to them${view.sellable.length ? ` (${view.sellable.length})` : ''}`;
    const list = $('[data-slot=shop-items]', root); list.innerHTML = '';
    const deal = $('[data-slot=shop-deal]', root); deal.innerHTML = '';
    if (view.tab === 'sell') {
      if (!view.sellable.length) list.innerHTML = '<li class="empty">Nothing in your bag that this trader buys. Traders only buy goods of their own line.</li>';
      for (const it of view.sellable) {
        const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button';
        const left = document.createElement('span'); left.textContent = it.name;
        const o = document.createElement('div'); o.className = 'owned'; o.textContent = `In your bag: ${it.qty}`; left.appendChild(o);
        const pr = document.createElement('span'); pr.className = 'price'; pr.textContent = `Sell ${naira(it.price)}`;
        b.append(left, pr); b.onclick = () => h.sell(it.id); li.appendChild(b); list.appendChild(li);
      }
      deal.innerHTML = '<p class="deal-hint">Traders pay less than they sell for — about half the usual price, a little more for friends. Tap an item to sell one.</p>';
      return;
    }
    for (const it of view.items) {
      const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button';
      b.setAttribute('aria-pressed', String(it.id === view.selected));
      if (it.left < 1) b.classList.add('soldout');
      const left = document.createElement('span'); left.textContent = it.name;
      const o = document.createElement('div'); o.className = 'owned';
      o.textContent = [it.left < 1 ? 'Sold out today' : it.left !== Infinity && it.left <= 3 ? `Only ${it.left} left` : null, it.owned ? `In your bag: ${it.owned}` : null].filter(Boolean).join(' · ');
      if (o.textContent) left.appendChild(o);
      const pr = document.createElement('span'); pr.className = 'price'; pr.textContent = naira(it.price);
      b.append(left, pr); b.onclick = () => h.select(it.id); li.appendChild(b); list.appendChild(li);
    }
    if (!view.deal) { deal.innerHTML = '<p class="deal-hint">Pick something to see the price. You can ask for a small reduction ("Kpaa ife") before you buy.</p>'; return; }
    const d = view.deal;
    const h3 = document.createElement('h3'); h3.textContent = d.name;
    const price = document.createElement('div'); price.className = 'deal-price'; price.textContent = naira(d.price);
    if (d.first && d.first !== d.price) { const s = document.createElement('s'); s.textContent = naira(d.first); price.appendChild(s); }
    const actions = document.createElement('div'); actions.className = 'deal-actions';
    const mk = (label, cls, fn, disabled, why) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label; b.disabled = !!disabled; if (why) b.title = why; b.onclick = fn; actions.appendChild(b); return b; };
    const out = d.left < 1;
    mk(out ? 'Sold out today' : `Buy for ${naira(d.price)}`, 'btn-primary', () => h.buy(d.id), out || !d.canAfford || !d.bagOk, out ? 'Restocked tomorrow morning' : !d.canAfford ? 'Not enough money' : !d.bagOk ? 'Your bag is full' : '');
    if (!d.fixed) {
      mk('Kpaa ife — ask for a small reduction', '', () => h.haggle(d.id), d.final);
      mk(`Offer ${naira(d.half)} (half)`, 'btn-ghost', () => h.lowball(d.id), d.final);
    }
    const hint = document.createElement('p'); hint.className = 'deal-hint';
    hint.textContent = out ? 'This trader has sold all of these today. Stock comes back tomorrow morning.' : !d.canAfford ? `You need ${naira(d.price - view.balance)} more.` : !d.bagOk ? 'Your bag is full — free a slot first.' : d.fixed ? 'Hawkers sell at a fixed price.' : d.final ? 'This is the trader’s last price.' : 'Bargaining can lower the price a little; better friends get better prices.';
    deal.append(h3, price, actions, hint);
  }

  // ------------------------------------------------------------- bag & jobs
  renderBag({ balance, items, slots, ledger, energy, energyLabel, msg }, h = {}) {
    const root = this.el.bag;
    $('[data-slot=bag-summary]', root).textContent = `Wallet: ${naira(balance)} · Bag: ${items.length}/${slots} slots`;
    const en = $('[data-slot=bag-energy]', root);
    en.querySelector('i').style.width = `${Math.round(energy)}%`;
    en.classList.toggle('low', energy < 25);
    $('[data-slot=bag-energy-label]', root).textContent = `Energy ${Math.round(energy)}% · ${energyLabel}`;
    const m = $('[data-slot=bag-msg]', root); m.hidden = !msg; m.textContent = msg ?? '';
    const ul = $('[data-slot=bag-items]', root); ul.innerHTML = '';
    if (!items.length) ul.innerHTML = '<li>Your bag is empty.</li>';
    for (const it of items) {
      const li = document.createElement('li'); if (it.kind === 'package') li.className = 'package';
      const left = document.createElement('span'); left.textContent = it.name;
      if (it.why) { const sm = document.createElement('small'); sm.textContent = it.why; left.appendChild(sm); }
      const right = document.createElement('span'); right.className = 'bag-right';
      const q = document.createElement('b'); q.textContent = it.kind === 'package' ? 'job' : `× ${it.qty}`; right.appendChild(q);
      if (it.verb && h.use) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-small bag-use';
        b.textContent = it.energy ? `${it.verb} +${it.energy}` : it.verb; b.onclick = () => h.use(it.id); right.appendChild(b);
      }
      li.append(left, right); ul.appendChild(li);
    }
    const lg = $('[data-slot=ledger]', root); lg.innerHTML = '';
    if (!ledger.length) lg.innerHTML = '<li>No transactions yet.</li>';
    for (const e of [...ledger].reverse().slice(0, 10)) {
      const li = document.createElement('li'); const left = document.createElement('span'); left.textContent = e.reason;
      const sm = document.createElement('small'); sm.textContent = e.day ? `${String(Math.floor(e.minutes / 60)).padStart(2, '0')}:${String(e.minutes % 60).padStart(2, '0')} · balance ${naira(e.balance)}` : ''; left.appendChild(sm);
      const amt = document.createElement('span'); amt.className = 'amt ' + (e.amount > 0 ? 'in' : 'out'); amt.textContent = (e.amount > 0 ? '+' : '−') + naira(Math.abs(e.amount));
      li.append(left, amt); lg.appendChild(li);
    }
    root.hidden = false;
  }

  /** jobs: [{id,title,steps,step,reward,tracked,due,late,where}]; log: finished; h: {track(id), abandon(id)} */
  renderJobs({ jobs, max, log, missions = [] }, h) {
    const root = this.el.jobs; const body = $('[data-slot=jobs-body]', root); body.innerHTML = '';
    for (const mission of missions) {
      const card=document.createElement('div');card.className='job-card mission-card'+(mission.tracked?' tracked':'');card.dataset.mission=mission.id;
      const title=document.createElement('h3');title.textContent=mission.title;
      const status=document.createElement('p');status.className='job-meta';status.textContent=`${mission.status.toUpperCase()} · Reward ${naira(mission.reward)} · ${mission.progress}/${mission.objectives.length} objectives`;
      const desc=document.createElement('p');desc.textContent=mission.description;
      const steps=document.createElement('ol');steps.className='job-steps';
      mission.objectives.forEach((text,i)=>{const li=document.createElement('li');li.textContent=text;li.className=i<mission.progress?'done':'now';steps.append(li);});
      const where=document.createElement('p');where.className='job-meta';where.textContent=mission.where;
      card.append(title,status,desc,steps,where);
      if(['available','active'].includes(mission.status)){
        const button=document.createElement('button');button.className='btn btn-small';button.textContent=mission.tracked?'Following on map':mission.status==='available'?'Find contact to accept':'Follow mission';button.disabled=mission.tracked;button.onclick=()=>h.trackMission(mission.id);card.append(button);
      }
      body.append(card);
    }
    const hd = document.createElement('h3'); hd.textContent = `Current jobs (${jobs.length}/${max})`; body.appendChild(hd);
    if (!jobs.length) { const p = document.createElement('p'); p.textContent = 'No job at the moment.'; body.appendChild(p); }
    for (const job of jobs) {
      const card = document.createElement('div'); card.className = 'job-card' + (job.tracked ? ' tracked' : '') + (job.late ? ' late' : '');
      const t = document.createElement('h4'); t.textContent = job.title;
      const ol = document.createElement('ol'); ol.className = 'job-steps';
      job.steps.forEach((s, i) => { const li = document.createElement('li'); li.textContent = s.label; li.className = i < job.step ? 'done' : i === job.step ? 'now' : ''; ol.appendChild(li); });
      const meta = document.createElement('div'); meta.className = 'job-meta';
      const rw = document.createElement('span'); rw.append('Reward '); const b = document.createElement('b'); b.textContent = naira(job.reward); rw.appendChild(b);
      const due = document.createElement('span'); due.className = 'job-due'; due.textContent = job.due;
      const wh = document.createElement('span'); wh.textContent = job.where ?? '';
      meta.append(rw, due, wh);
      const row = document.createElement('div'); row.className = 'job-actions';
      const tr = document.createElement('button'); tr.className = 'btn btn-small' + (job.tracked ? ' btn-primary' : ''); tr.textContent = job.tracked ? 'Following on the map' : 'Follow on the map'; tr.disabled = job.tracked; tr.onclick = () => h.track(job.id);
      const ab = document.createElement('button'); ab.className = 'btn btn-small btn-ghost'; ab.textContent = 'Abandon'; ab.onclick = () => h.abandon(job.id);
      row.append(tr, ab);
      card.append(t, ol, meta, row); body.appendChild(card);
    }
    const h2 = document.createElement('h3'); h2.textContent = 'Finished'; body.appendChild(h2);
    const ul = document.createElement('ul'); ul.className = 'ledger';
    if (!log.length) ul.innerHTML = '<li>Nothing yet.</li>';
    for (const e of [...log].reverse().slice(0, 10)) {
      const li = document.createElement('li'); li.innerHTML = '<span></span><span class="amt"></span>';
      li.firstChild.textContent = e.title;
      li.lastChild.className = 'amt ' + (e.missed ? 'out' : 'in'); li.lastChild.textContent = e.missed ? 'missed' : '+' + naira(e.reward);
      ul.appendChild(li);
    }
    body.appendChild(ul);
    root.hidden = false;
  }
}
