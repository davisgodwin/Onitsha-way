/** Mobile-only clean-view preference. Essential controls and modal screens are never hidden. */
export class HudVisibility {
 constructor(game,persist=()=>{}) {
  this.g=game;this.persist=persist;this.minimized=false;
  if(!game.touch)return;
  this.hud=game.ui.el.hud;
  this.button=document.createElement('button');this.button.type='button';this.button.className='hud-visibility-toggle';
  this.button.setAttribute('aria-controls','screen-hud');
  this.button.onclick=e=>{e.stopPropagation();this.setMinimized(!this.minimized);};
  this.hud.append(this.button);document.body.classList.add('mobile-hud-can-minimize');
  this.setMinimized(game.settings.hudMinimized===true,{save:false});
 }
 setMinimized(value,{save=true}={}) {
  if(!this.button)return;
  this.minimized=!!value;this.g.settings.hudMinimized=this.minimized;
  document.body.classList.toggle('mobile-hud-minimized',this.minimized);
  this.button.setAttribute('aria-expanded',String(!this.minimized));
  const label=this.minimized?'Show HUD':'Minimize HUD';this.button.setAttribute('aria-label',label);this.button.title=label;
  this.button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>${this.minimized?'<path d="M8 12h8M12 8v8"/>':'<path d="M8 12h8"/>'}</svg><span>HUD</span>`;
  // If a hidden HUD button had focus, keep keyboard/switch-control focus on the restore button.
  if(this.minimized&&this.hud.contains(document.activeElement)&&document.activeElement!==this.button)this.button.focus({preventScroll:true});
  if(save){this.persist();if(this.minimized)this.g.ui.toast('HUD minimized — tap HUD to bring it back.');}
 }
}
