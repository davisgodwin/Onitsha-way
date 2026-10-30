import {accountRequest} from '../online/AccountAPI.js';
import './entry.css';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
/** Front door only: no city renderer, NPCs or in-world signup until this resolves. */
export class EntryFlow {
 constructor(){
  this.loadingScreen=document.querySelector('#screen-loading');
  this.loadingScreen.classList.add('entry-active');
  this.root=node('main',null,'entry');this.root.setAttribute('aria-label','Welcome to Onitsha Way');
  this.loadingScreen.insertBefore(this.root,this.loadingScreen.querySelector('.loadbar'));
 }
 splashStatus(text){this.loadingScreen.querySelector('.load-status').textContent=text;}
 async start(){
  const ready=new Promise(resolve=>this.resolve=resolve);this.check();return ready;
 }
 async check(){this.loading('Checking your account…');
  try{
   const token=sessionStorage.getItem('onitshaway:session');
   const r=await fetch('/api/session',{cache:'no-store',signal:AbortSignal.timeout(8000),headers:token?{Authorization:`Bearer ${token}`}:{}});
   if(r.ok){const a=await r.json();if(a.ok&&a.me?.id&&a.token){this.finish(a);return;}}
   else if(r.status!==401)throw Error('Local server unavailable.');else{try{this.joinCodeRequired=(await r.json()).joinCodeRequired===true;}catch{}}
   sessionStorage.removeItem('onitshaway:session');this.render('signup');
  }catch{
   // v0.54: no account server (a static web host such as Vercel, or the server isn't running): play in this browser
   const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
   this.renderOffline(local?'The account server isn\'t running. To play online, start the game with npm run dev and keep that terminal open.':'');
  }
 }
 /** v0.54: the front door when there is no account server: single-player, saved in this browser */
 renderOffline(note=''){
  this.shell();const c=this.card;this.mode='offline';this.splashStatus('Ready to play.');
  c.append(node('p','NNỌỌ · WELCOME','entry-kicker'),node('h2','A new life starts here.'),node('p','Make your character and step into Onitsha. Your game is saved in this browser on this device.','entry-muted'));
  this.button(c,localStorage.getItem('onitshaway:save')?'Continue →':'Play now →',()=>this.finish(null),true);
  c.append(node('p','Online play (friends, other players, business ads and cloud saves) needs the game\'s account server, which this web version doesn\'t run. Everything else works.','entry-small'));
  if(note)c.append(node('p',note,'entry-small'));
  if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))this.button(c,'Try the account server again',()=>this.check());
 }
 shell(){
  this.root.replaceChildren();this.card=node('section',null,'entry-card');this.root.append(this.card);
 }
 loading(text){this.shell();this.card.append(node('p',text,'entry-muted'));this.splashStatus(text);}
 button(parent,label,fn,primary=false){const b=node('button',label,primary?'entry-button entry-primary':'entry-button');b.type='button';b.onclick=()=>{if(!this.busy)fn();};parent.append(b);return b;}
 field(form,label,type,name,options={}){const l=node('label',null,'entry-field');l.append(node('span',label));const i=node('input');Object.assign(i,{type,name,id:`entry-${name}`,required:true,...options});l.append(i);form.append(l);return i;}
 render(mode='welcome',message=''){
  this.shell();const c=this.card;this.mode=mode;this.splashStatus('Create an account or log in, then load your city.');
  if(mode==='welcome'){
   c.append(node('p','NNỌỌ · WELCOME','entry-kicker'),node('h2','A new life starts here.'),node('p','Create your account, make your character, then step into the city.','entry-muted'));
   this.button(c,'Create an account →',()=>this.render('signup'),true);this.button(c,'Log in',()=>this.render('login'));
   c.append(node('p','Already playing? Log in to continue your character.','entry-small'));
   if(localStorage.getItem('onitshaway:save'))this.button(c,'Open previous offline save',()=>{if(confirm('Open your old offline save? It will stay separate from all player accounts.'))this.finish(null);});
  }else{
   const signup=mode==='signup';
   const tabs=node('nav',null,'entry-tabs');tabs.setAttribute('aria-label','Account options');c.append(tabs);
   for(const [id,label] of [['signup','Create account'],['login','Log in']]){const b=this.button(tabs,label,()=>this.render(id),id===mode);b.setAttribute('aria-pressed',String(id===mode));}
   c.append(node('p',signup?'01 ACCOUNT  →  02 CHARACTER  →  03 CITY':'WELCOME BACK','entry-steps'),node('h2',signup?'Make yourself known.':'Back to your city.'),node('p',signup?'One account. Your character. Your place in Onitsha.':'Log in to continue where you left off.','entry-muted'));
   const f=node('form');f.setAttribute('aria-label',signup?'Create player account':'Log in to play');c.append(f);
   const name=signup?this.field(f,'Display name','text','display-name',{maxLength:32,autocomplete:'nickname'}):null;
   const u=this.field(f,'Username','text','username',{minLength:3,maxLength:24,pattern:'[A-Za-z0-9_]{3,24}',autocomplete:'username',autocapitalize:'none',spellcheck:false});
   f.append(node('p','3–24 letters, numbers or underscores.','entry-hint'));
   const pw=this.field(f,'Password','password','password',{minLength:10,maxLength:128,autocomplete:signup?'new-password':'current-password'});
   const show=this.button(f,'Show password',()=>{pw.type=pw.type==='password'?'text':'password';show.textContent=pw.type==='password'?'Show password':'Hide password';show.setAttribute('aria-pressed',String(pw.type==='text'));});show.className='entry-password-toggle';
   f.append(node('p','At least 10 characters. Use a password just for this prototype.','entry-hint'));
   // LAN play: a phone or another PC needs the host's join code to create an account (logging in doesn't)
   const join=signup&&this.joinCodeRequired?this.field(f,'Join code','text','join-code',{minLength:4,maxLength:12,autocomplete:'off',autocapitalize:'characters',spellcheck:false}):null;
   if(join)f.append(node('p','Shown in the terminal of the computer hosting the game.','entry-hint'));
   const check=(label,checked,required=false)=>{const l=node('label',null,'entry-check');const i=node('input');i.type='checkbox';i.checked=checked;i.required=required;l.append(i,document.createTextNode(label));f.append(l);return i;};
   const adult=signup?check('I am 18 or older. Online characters must be adults.',false,true):null;
   const remember=check('Keep me logged in on this device',true);
   this.status=node('p',message,'entry-status');this.status.setAttribute('role','alert');f.append(this.status);
   const submit=node('button',signup?'Create account & continue →':'Log in & continue →','entry-button entry-primary');submit.type='submit';f.append(submit);
   f.onsubmit=async e=>{e.preventDefault();if(this.busy)return;this.busy=true;submit.disabled=true;show.disabled=true;this.status.textContent=signup?'Creating your account…':'Logging in…';
    try{const a=await accountRequest({username:u.value,password:pw.value,name:name?.value,adult:adult?.checked,remember:remember.checked,...(join?{joinCode:join.value}:{})},signup);pw.value='';this.finish(a);}
    catch(err){this.status.textContent=err.message;submit.disabled=false;show.disabled=false;}
    finally{this.busy=false;}
   };
   if(localStorage.getItem('onitshaway:save'))this.button(c,'Open previous offline save',()=>{if(confirm('Open your old offline save? It will stay separate from all player accounts.'))this.finish(null);});
   c.append(node('p','Local build: your account and saved game stay on the server of the computer hosting the game. No email or password recovery yet.','entry-small'));
  }
  if(mode==='welcome'&&message){const status=node('p',message,'entry-status');status.setAttribute('role','alert');c.append(status);}
 }
 finish(account){if(account)sessionStorage.setItem('onitshaway:session',account.token);else sessionStorage.removeItem('onitshaway:session');this.root.remove();this.loadingScreen.classList.remove('entry-active');this.splashStatus('Preparing your city…');this.resolve(account);}
}
