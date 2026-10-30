import {safeBusinessLink} from '../../shared/BillboardCatalogue.js';
import {AREA_NAMES} from './Billboards.js';
import {payForAd} from './PaystackCheckout.js';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
const money=n=>`₦${n.toLocaleString()}`;
const date=t=>new Date(t).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})+' WAT';
export class OnlinePanel{
 constructor(o){this.o=o;this.tab='ads';this.busy=false;this.area='upper-iweka';}
 get visible(){const g=this.o.g;return g.state==='overlay'&&g.overlay==='phone'&&g.phone.app==='ads';}
 open(tab='ads',area=null){const g=this.o.g;if(tab!=='ads'){g.phone.openMessages();if(tab==='team'){g.phone.messenger.view='groups';g.phone.render('messages');}return;}if(!g.saveData){this.o.notice('Enter the city to open your phone.');return;}if(area)this.area=area;this.tab='ads';if(g.state==='map')g.closeMap();if(g.state==='overlay'&&g.overlay!=='phone')g.closeOverlay();if(!(g.state==='overlay'&&g.overlay==='phone'))g.openOverlay('phone');if(g.state==='overlay'&&g.overlay==='phone')g.phone.render('ads');}
 close(){if(this.visible)this.o.g.closeOverlay('phone');this.busy=false;}
 notice(message){if(!this.visible)return;this.notices??=new Map();this.notices.set(this.tab,message);if(this.noticeNode?.isConnected)this.noticeNode.textContent=message;}
 refresh(){if(!this.visible||this.busy||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;const scroll=this.root?.scrollTop||0;this.render(this.tab);if(this.root)this.root.scrollTop=scroll;}
 button(parent,label,action,variant='',disabled=false){const b=el('button',label,`oc-button ${variant}`);b.type='button';b.disabled=disabled;b.onclick=async()=>{b.disabled=true;try{await action();}catch(e){this.o.notice(e.message);}finally{if(b.isConnected)b.disabled=disabled;}};parent.append(b);return b;}
 text(text,cls='oc-copy',parent=this.content){const p=el('p',text,cls);parent.append(p);return p;}
 field(parent,label,type='text',value='',opts={}){const wrap=el('label',null,'oc-field');wrap.append(el('span',label));const input=el(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.value=value;Object.assign(input,opts);wrap.append(input);parent.append(wrap);input.addEventListener('input',()=>this.busy=true);return input;}
 select(parent,label,options,value){const wrap=el('label',null,'oc-field');wrap.append(el('span',label));const s=el('select');s.setAttribute('aria-label',label);for(const[k,v]of options){const opt=el('option',v);opt.value=k;s.append(opt);}s.value=value;wrap.append(s);parent.append(wrap);s.addEventListener('change',()=>this.busy=true);return s;}
 card(title,detail,parent=this.content){const c=el('article',null,'oc-card');c.append(el('h3',title));if(detail)c.append(el('p',detail,'oc-muted'));parent.append(c);return c;}
 /** v0.51: pay for an ad with Paystack (test mode), or simulate it when Paystack isn't set up */
 payControls(c,ad){const o=this.o,ps=o.data.paystack;
  if(!ps?.enabled){if(ps?.problem)c.append(el('p',`Paystack: ${ps.problem}`,'oc-muted'));this.button(c,'Simulate successful payment · no real charge',()=>o.act('adConfirmTest',{id:ad.id}),'oc-primary',!o.data.testPayments);return;}
  c.append(el('p','Paystack TEST mode: pay with a Paystack test card (e.g. 4084 0840 8408 4081, any future date, CVV 408). No real money is charged.','oc-muted'));
  let saved='';try{saved=localStorage.getItem('onitshaway:payEmail')||'';}catch{}
  const email=el('input');email.type='email';email.placeholder='Email for the Paystack receipt';email.autocomplete='email';email.value=saved;email.className='oc-input';email.setAttribute('aria-label','Email for the Paystack receipt');c.append(email);
  this.button(c,`Pay ${money(ad.amount)} with Paystack (test)`,async()=>{const e=email.value.trim();if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e))throw Error('Enter a valid email for the Paystack receipt.');try{localStorage.setItem('onitshaway:payEmail',e);}catch{}this.busy=true;try{const r=await payForAd(o,ad,e);if(r.message)this.o.notice(r.message);}finally{this.busy=false;this.render('ads');}},'oc-primary');
  if(ad.payStarted)this.button(c,'I have paid — check',async()=>{await o.act('adPayCheck',{id:ad.id});});
 }
 render(tab='ads'){if(!this.visible||tab!=='ads')return;this.tab='ads';this.busy=false;this.noticeNode=null;const o=this.o;this.root=o.g.phone.body;this.root.replaceChildren();this.root.classList.add('phone-community','online-panel');this.root.setAttribute('aria-label','Business ads');
  this.content=el('section',null,'oc-content');this.root.append(this.content);this.noticeNode=el('p',this.notices?.get(tab)||'','oc-notice');this.noticeNode.setAttribute('role','status');this.root.append(this.noticeNode);
  if(!o.connected||!o.data){this.text('The local server is disconnected. Reconnect to manage your business ads.');this.button(this.content,'Reconnect',()=>{o.connect();this.notice('Connecting…');},'oc-primary');return;}
  this.ads();
 }
 ads(){const o=this.o;this.text('Put your business on the map.','oc-display');this.text('₦3,000 / seven-day slot. Multiple slots extend one campaign consecutively: 2 slots = 14 days. Choose one of 200 individual billboards. One advertiser per board; no rotation or sharing. Checkout reserves the space for 15 minutes.');this.text(o.data.paystack?.enabled?'PAYSTACK TEST MODE · Payments go through Paystack with test keys: use a Paystack test card, no real money is charged. The server confirms each payment with Paystack before the flyer goes up. Ad moderation must still be added before launch.':'LOCAL TEST MODE · No real money is collected. Test activation combines mock payment and test-only approval. Real payment verification and ad moderation must be added before launch.','oc-warning');
  for(const r of o.boards.records.filter(r=>r.area===this.area&&r.ad?.image)){const c=this.card('On this billboard','Business flyer');const img=el('img');img.src=r.ad.image;img.alt='Active business flyer';img.className='oc-flyer-preview';c.append(img);}
  const form=el('form',null,'oc-form');this.content.append(form);
  const area=this.select(form,'Billboard location',Object.entries(AREA_NAMES),this.area);
  const available=(o.data.bookings??[]),board=this.select(form,'Individual billboard',[],this.boardId);const populate=()=>{board.replaceChildren();for(const r of o.boards.records.filter(r=>r.area===area.value)){const booked=available.some(b=>b.boardId===r.id&&b.until>Date.now()+o.offset),opt=el('option',r.name+' · '+r.site.roadName+(booked?' · BOOKED / RESERVED':' · Available'));opt.value=r.id;opt.disabled=booked;board.append(opt);}if(this.boardId&&[...board.options].some(q=>q.value===this.boardId&&!q.disabled))board.value=this.boardId;else board.value=[...board.options].find(q=>!q.disabled)?.value??'';};populate();area.onchange=()=>{this.area=area.value;this.boardId=null;populate();};board.onchange=()=>this.boardId=board.value;
  const link=this.field(form,'Business website or social link (optional)','url','',{placeholder:'https://your-business.example',maxLength:2048});
  const slots=this.field(form,'Seven-day slots','number','1',{min:1,max:52,step:1,required:true});
  const quote=el('p','1 slot · 7 days · ₦3,000 (TEST)','oc-quote');form.append(quote);
  slots.oninput=()=>{const n=Number(slots.value);quote.textContent=Number.isInteger(n)&&n>=1&&n<=52?`${n} slot${n===1?'':'s'} · ${n*7} days · ${money(n*3000)} (TEST)`:'Choose 1–52 whole slots.';};
  const artwork=this.field(form,'Business flyer · PNG, JPEG or WebP · required','file','',{accept:'image/png,image/jpeg,image/webp',required:true});
  const preview=el('img');preview.alt='Your flyer preview';preview.className='oc-flyer-preview';preview.hidden=true;form.append(preview);
  this.text('Portrait and landscape flyers are supported, without cropping. Upload a sharp image up to 2048 pixels on its longest side. Your optional business link floats above the board and opens only when clicked.');
  let image='',uploadVersion=0,loading=false;
  artwork.onchange=async()=>{const version=++uploadVersion;image='';preview.hidden=true;preview.removeAttribute('src');loading=true;b.disabled=true;
    try{const f=artwork.files[0];if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>5*1024*1024)throw Error('Use a PNG, JPEG or WebP under 5 MB.');
      const bitmap=await createImageBitmap(f);const canvas=document.createElement('canvas');const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').fillStyle='#ffffff';canvas.getContext('2d').fillRect(0,0,canvas.width,canvas.height);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      let encoded='';for(const quality of[.94,.88,.8,.7]){encoded=canvas.toDataURL('image/jpeg',quality);if(encoded.length<=1200000)break;}
      if(encoded.length>1200000)throw Error('Flyer is too detailed; choose a smaller image.');if(version!==uploadVersion)return;
      image=encoded;preview.src=image;preview.hidden=false;this.notice('Flyer ready. Check that the contact details are readable.');
    }catch(e){if(version!==uploadVersion)return;image='';artwork.value='';this.notice(e.message);}finally{if(version===uploadVersion){loading=false;b.disabled=false;}}
  };
  const b=el('button','Create flyer checkout','oc-button oc-primary');b.type='submit';form.append(b);
  form.onsubmit=async e=>{e.preventDefault();if(loading||!image){this.notice('Upload a business flyer image first.');return;}b.disabled=true;try{if(!board.value)throw Error('Choose an available billboard.');if(safeBusinessLink(link.value)===null)throw Error('Use a valid HTTP or HTTPS business link.');const r=await o.request('adCreate',{area:area.value,boardId:board.value,link:link.value,slots:Number(slots.value),image,key:this.checkoutKey||(this.checkoutKey=crypto.randomUUID())});this.checkoutKey=null;this.busy=false;this.render('ads');this.notice(o.data.paystack?.enabled?`Flyer order created: ${money(r.ad.amount)}. Pay with Paystack below (TEST mode: use a Paystack test card, no real money).`:`Flyer order created: ${money(r.ad.amount)}. Confirm below; no real payment is taken.`);}catch(e){this.notice(e.message);}finally{b.disabled=false;}};
  this.text('YOUR CAMPAIGNS','oc-eyebrow');if(!o.data.campaigns.length)this.text('No campaigns yet. Create your first test checkout above.','oc-muted');for(const ad of [...o.data.campaigns].reverse()){const c=this.card(ad.image?'Business flyer':'Legacy text ad — upload a flyer to replace',`${ad.boardId||AREA_NAMES[ad.area]} · ${ad.slots*7} days · ${money(ad.amount)} · ${ad.status.replaceAll('_',' ')}`);if(ad.image){const img=el('img');img.src=ad.image;img.alt='Campaign flyer';img.className='oc-flyer-preview';c.append(img);}if(ad.startsAt)c.append(el('p',`${date(ad.startsAt)} → ${date(ad.endsAt)}`,'oc-muted'));if(ad.status==='awaiting_test_payment')this.payControls(c,ad);if(ad.status==='active'||ad.status==='awaiting_test_payment')this.button(c,'Cancel test campaign',()=>o.act('adCancel',{id:ad.id}));if(ad.link){const a=el('a',new URL(ad.link).hostname,'oc-button');a.href=ad.link;a.target='_blank';a.rel='noopener noreferrer';c.append(a);}const loc=o.locations[ad.boardId]||o.locations[ad.area];if(loc&&o.g.saveData)this.button(c,'Mark billboard on map',()=>o.mark(loc,`${AREA_NAMES[ad.area]} billboard`));}
 }
}
