import test from 'node:test';import assert from 'node:assert/strict';
import {accountRequest} from '../src/online/AccountAPI.js';
const form={username:'test_user',password:'test-only-password'};
for(const [label,response]of[
 ['empty proxy error',()=>new Response('',{status:500})],
 ['empty successful response',()=>new Response('',{status:200})],
 ['frontend HTML instead of backend',()=>new Response('<!doctype html><html>Game</html>',{status:200})],
 ['truncated JSON',()=>new Response('{"ok":', {status:502})],
 ['unexpected null',()=>new Response('null')],
 ['malformed success',()=>Response.json({ok:true,token:'test-token',me:{}})],
 ['connection refused',()=>{throw new TypeError('fetch failed');}],
])test(label+' gives local startup guidance, not a JSON parser error',async()=>{await assert.rejects(()=>accountRequest(form,true,{fetcher:async()=>response()}),e=>{assert.match(e.message,/npm run dev/);assert.doesNotMatch(e.message,/Unexpected end|Unexpected token|test-only-password/);return true;});});
test('backend validation errors stay useful',async()=>{await assert.rejects(()=>accountRequest(form,true,{fetcher:async()=>Response.json({error:'Username unavailable.'},{status:400})}),/Username unavailable/);});
test('valid account response is accepted',async()=>{let path;const value={ok:true,token:'qa-token',me:{id:'qa-id',username:'test_user'}};const actual=await accountRequest(form,true,{fetcher:async(url)=>{path=url;return Response.json(value);}});assert.equal(path,'/api/register');assert.deepEqual(actual,value);});
test('timeout gives account-server guidance',async()=>{await assert.rejects(()=>accountRequest(form,false,{timeout:10,fetcher:async(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))}),/timed out.*npm run dev/);});
