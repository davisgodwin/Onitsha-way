import {HudVisibility} from './HudVisibility.js';
import './hud-visibility.css';
import './city-hud.css';
import {SaveSystem} from '../save/SaveSystem.js';
import {uiIcon} from './UIIcons.js';
const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text)e.textContent=text;return e;};
export class CityHUD {
 constructor(g){this.g=g;const hud=g.ui.el.hud;this.hud=hud;hud.classList.add('city-hud');const bar=make('div','city-status');bar.setAttribute('aria-label','City status');hud.prepend(bar);
  const clock=hud.querySelector('.hud-clock');this.date=make('span','city-date');clock.prepend(this.date);bar.append(clock);this.mood=make('span','city-mood','Feeling good');bar.append(this.mood);this.online=make('span','city-online','○ Local city');this.online.setAttribute('aria-label','City connection status');bar.append(this.online);
  this.sound=this.button(bar,'city-sound','♪',()=>{this.lastVolume=g.settings.volume||this.lastVolume||.7;g.settings.volume=g.settings.volume>0?0:this.lastVolume;g.applySettings();SaveSystem.saveSettings(g.settings);this.update();});this.sound.setAttribute('aria-label','Mute game sound');bar.append(hud.querySelector('.hud-wallet'));
  const nav=make('nav','city-nav');nav.setAttribute('aria-label','Game navigation');for(const[id,ico,label,fn]of[['homes','⌂','Home',()=>g.openOverlay('homes')],['buy','▱','Buy',()=>g.buy.open()],['map','♧','Map',()=>g.openMap()],['phone','▯','Phone',()=>g.openOverlay('phone')]]){const b=this.button(nav,'city-nav-button','',fn);b.dataset.nav=id;b.setAttribute('aria-label',label);const im=make('span','city-nav-icon');im.innerHTML=uiIcon(id);b.append(im,make('span','',label));if(id==='phone'){const n=make('b','city-unread');n.dataset.mailBadge='';n.hidden=true;b.append(n);}}hud.append(nav);
  this.avatar=make('span','city-avatar','OW');hud.append(this.avatar);
  this.exit=this.button(hud,'city-exit','↗ Go outside',()=>{if(g.homes.inside)g.homes.exit();else if(g.civic.inside)g.civic.exit();else if(g.club.inside)g.club.exit();});this.exit.hidden=true;
  this.floor=this.button(hud,'city-floor','↑ Up',()=>g.homes.switchFloor(g.homes.inside.layout.id==='duplexUp'?'ground':'up'));this.floor.hidden=true;
  const phone=hud.querySelector('.hud-phone');phone.innerHTML='✉';phone.setAttribute('aria-label','Open messages');phone.onclick=e=>{e.stopPropagation();g.phone.openMessages();};const badge=make('b','city-unread');badge.dataset.mailBadge='';badge.hidden=true;phone.append(badge);
  this.close=this.button(g.ui.el.phone,'phone-close','× Close',()=>g.closeOverlay('phone'));this.close.setAttribute('aria-label','Close phone');
  this.visibility=new HudVisibility(g,()=>SaveSystem.saveSettings(g.settings));
 }
 button(parent,cls,text,fn){const b=make('button',cls,text);b.type='button';b.onclick=fn;parent.append(b);return b;}
 update(){const g=this.g;if(!g.saveData)return;this.date.textContent=new Intl.DateTimeFormat('en-NG',{timeZone:'Africa/Lagos',weekday:'short',day:'numeric'}).format(new Date())+' ·';this.mood.textContent='☺ '+g.needs.mood;this.mood.dataset.mood=g.needs.mood==='Uncomfortable'?'low':'good';const o=g.online,n=o.onlineCount??o.data?.onlineCount??0;this.online.textContent=o.connected?`● ${n} online`:'○ Offline';this.sound.textContent=g.settings.volume>0?'♫':'♩';this.sound.setAttribute('aria-label',g.settings.volume>0?'Mute game sound':'Unmute game sound');this.sound.setAttribute('aria-pressed',String(g.settings.volume===0));this.avatar.textContent=g.saveData.character.name.slice(0,2).toUpperCase();this.avatar.title=g.saveData.character.name;const inside=g.homes.inside||g.civic.inside||g.club.inside;this.exit.hidden=!inside;this.floor.hidden=!(g.homes.inside?.home.type==='duplex');if(!this.floor.hidden)this.floor.textContent=g.homes.inside.layout.id==='duplexUp'?'↓ Down':'↑ Up';for(const b of this.hud.querySelectorAll('[data-nav]'))b.classList.toggle('selected',g.state==='overlay'&&g.overlay===b.dataset.nav||g.state==='map'&&b.dataset.nav==='map');g.phone.messenger.badge();}
}
