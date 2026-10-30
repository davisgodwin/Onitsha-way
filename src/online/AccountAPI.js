const START_HELP='The local account server is not responding correctly. Stop the old game terminal, then run npm run dev in this project folder and open http://localhost:5173. Keep that terminal open. If it fails, check the terminal error for port 8787.';
/** Never show a raw JSON parser error or put sign-in values in diagnostics. */
export async function accountRequest(form,register,{fetcher=globalThis.fetch,timeout=12000}={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
 try{
  let res;try{res=await fetcher(register?'/api/register':'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form),signal:controller.signal,cache:'no-store'});}catch(e){if(e.name==='AbortError')throw Error('Account server timed out. '+START_HELP);throw Error(START_HELP);}
  const text=await res.text();let out;try{out=JSON.parse(text);}catch{throw Error((res.status?`Account server returned HTTP ${res.status} without a valid account response. `:'')+START_HELP);}
  if(!out||typeof out!=='object'||Array.isArray(out))throw Error(START_HELP);
  if(!res.ok)throw Error(typeof out.error==='string'?out.error:'Account request failed. '+START_HELP);
  if(out.ok!==true||typeof out.token!=='string'||!out.token||typeof out.me?.id!=='string'||!out.me.id)throw Error(START_HELP);
  return out;
 }finally{clearTimeout(timer);}
}
