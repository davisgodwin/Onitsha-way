import {randomUUID} from 'node:crypto';
const check=(ok,text)=>{if(!ok)throw Error(text);};
const textOf=t=>String(t??'').replace(/[\x00-\x08\x0b-\x1f]/g,'').trim().slice(0,1000);
/** Bounded, server-persisted private conversations. No client-provided sender/read identity. */
export function createMailEngine({db,user,publicUser,blocked,persist,publish,to,teamOf,limit,now}){
 db.mailThreads??=[];db.groupMail??={};db.mailSeq??=0;
 const peer=(u,id)=>{const v=user(id);check(v&&v.id!==u.id&&!blocked(u.id,id),'Player unavailable or blocked.');return v;};
 const find=(u,id)=>db.mailThreads.find(t=>t.members.includes(u.id)&&t.members.includes(id));
 const notify=t=>t.members.forEach(id=>to(id,{type:'mailUpdate',thread:t.id}));
 const summary=(u,t)=>{const other=user(t.members.find(id=>id!==u.id)),last=t.messages.at(-1);return {id:t.id,peer:publicUser(other),status:t.status,requestFrom:t.requestFrom,last:last?{text:last.text,time:last.time,from:last.from}:null,unread:t.messages.filter(m=>m.from!==u.id&&m.seq>(t.read[u.id]||0)).length};};
 const allowed=(u,t)=>t.members.includes(u.id)&&t.members.every(id=>!blocked(u.id,id));
 const get=(u,id)=>{const t=db.mailThreads.find(t=>t.id===id);check(t&&allowed(u,t),'Conversation unavailable.');return t;};
 const details=(u,t)=>({...summary(u,t),messages:t.messages.map(m=>({...m,read:m.from===u.id&&(t.read[t.members.find(id=>id!==u.id)]||0)>=m.seq}))});
 const snapshot=u=>({threads:db.mailThreads.filter(t=>allowed(u,t)).map(t=>summary(u,t)).sort((a,b)=>(b.last?.time||0)-(a.last?.time||0))});
 const sendDirect=(u,m)=>{
  const v=peer(u,m.target),text=textOf(m.text);check(text,'Write a message first.');const key=String(m.key||'');check(key.length>=8&&key.length<=80,'Missing message request ID.');let t=find(u,v.id);
  const duplicate=t?.messages.find(a=>a.from===u.id&&a.key===key);if(duplicate)return {thread:details(u,t),messageId:duplicate.id};
  limit(`mail:${u.id}`,8,5000);
  if(!t){check(db.mailThreads.filter(t=>t.members.includes(u.id)).length<200,'Conversation limit reached (200).');t={id:randomUUID(),members:[u.id,v.id],status:u.friends.includes(v.id)?'accepted':'pending',requestFrom:u.id,read:{},messages:[]};db.mailThreads.push(t);}
  if(u.friends.includes(v.id)&&v.friends.includes(u.id))t.status='accepted';
  check(t.status!=='declined','This message request was declined.');check(t.status==='accepted'||t.requestFrom===u.id,'Accept the message request before replying.');check(t.status==='accepted'||!t.messages.length,'Wait for this player to accept your message request.');
  const message={id:randomUUID(),seq:++db.mailSeq,from:u.id,text,key,time:now()};t.messages.push(message);t.messages=t.messages.slice(-200);persist();notify(t);publish();
  // Compatibility for the existing live-chat panel. Offline delivery is in the persisted inbox.
  for(const id of t.members)to(id,{type:'chat',...message,name:u.name,channel:'direct',target:v.id});
  return {thread:details(u,t),messageId:message.id};
 };
 const action=(u,m)=>{
  if(m.action==='mailFind'){const q=String(m.username||'').replace(/^@/,'').trim().toLowerCase();check(/^[a-z0-9_]{3,24}$/.test(q),'Enter an exact @username.');limit(`lookup:${u.id}`,15,60000);const v=db.users.find(v=>v.username===q);check(v&&v.id!==u.id&&!blocked(u.id,v.id),'Player unavailable or blocked.');const t=find(u,v.id);return {peer:publicUser(v),thread:t?details(u,t):null};}
  if(m.action==='mailSend')return sendDirect(u,m);
  if(m.action==='mailOpen'){const t=get(u,m.id);const latest=t.messages.at(-1)?.seq||0;if(m.read!==false&&t.status==='accepted'&&(t.read[u.id]||0)<latest){t.read[u.id]=latest;persist();notify(t);publish();}return {thread:details(u,t)};}
  if(m.action==='mailRespond'){const t=get(u,m.id);check(t.status==='pending'&&t.requestFrom!==u.id,'No incoming message request.');t.status=m.accept===true?'accepted':'declined';if(t.status==='declined')t.read[u.id]=t.messages.at(-1)?.seq||0;persist();notify(t);publish();return {thread:details(u,t)};}
  if(m.action==='mailGroupOpen'){const team=teamOf(u.id);check(team,'Join a crew to use group chat.');const room=db.groupMail[team.id]||{messages:[]};return {group:{id:team.id,members:team.members.map(id=>publicUser(user(id))),messages:room.messages.filter(m=>!blocked(u.id,m.from))}};}
  if(m.action==='mailGroupSend'){const team=teamOf(u.id);check(team,'Join a crew to use group chat.');const text=textOf(m.text);check(text,'Write a message first.');limit(`mail:${u.id}`,8,5000);const key=String(m.key||randomUUID());const room=db.groupMail[team.id]??={messages:[]};const old=room.messages.find(a=>a.from===u.id&&a.key===key);if(old)return {messageId:old.id};const message={id:randomUUID(),seq:++db.mailSeq,from:u.id,name:u.name,text,key,time:now()};room.messages.push(message);room.messages=room.messages.slice(-200);const activeIds=Object.keys(db.groupMail);if(activeIds.length>100)delete db.groupMail[activeIds[0]];persist();for(const id of team.members){if(blocked(u.id,id))continue;to(id,{type:'mailUpdate',group:team.id});to(id,{type:'chat',...message,channel:'team'});}return {messageId:message.id};}
  throw Error('Unknown messaging action.');
 };
 return {snapshot,action,sendDirect};
}
