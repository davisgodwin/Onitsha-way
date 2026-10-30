/** Fixed Onitsha location: never requests device geolocation or credentials. */
export const WEATHER_URL='https://api.open-meteo.com/v1/forecast?latitude=6.15&longitude=6.79&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m&timezone=Africa%2FLagos';
export function decodeWeather(data,now=Date.now()) {
 const c=data?.current;if(!c||!Number.isFinite(c.temperature_2m)||!Number.isFinite(c.weather_code)||!Number.isFinite(c.precipitation)||!Number.isFinite(c.cloud_cover))throw Error('Invalid weather response');
 const code=c.weather_code,rain=Math.max(0,Math.min(1,c.precipitation/5));
 const label=code>=95?'Thunderstorm':code>=80?'Rain showers':code>=61?'Rain':code>=51?'Drizzle':code>=45?'Fog':code>=3?'Overcast':code>=1?'Partly cloudy':'Clear';
 return {rain:code>=51?Math.max(.18,rain):0,harmattan:code===45||code===48?.35:0,cloud:Math.max(0,Math.min(1,c.cloud_cover/100)),label,temperature:c.temperature_2m,wind:c.wind_speed_10m??0,fetchedAt:now,observedAt:c.time??null};
}
export class LiveWeather {
 constructor({fetcher=globalThis.fetch,storage=undefined,now=()=>Date.now()}={}){if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}this.fetcher=fetcher;this.storage=storage;this.now=now;this.next=0;this.pending=false;this.current=null;this.failed=false;try{const c=JSON.parse(storage?.getItem('onitshaway:weather')??'null');if(c&&Number.isFinite(c.fetchedAt)&&now()-c.fetchedAt<6*3600000&&now()>=c.fetchedAt&&Number.isFinite(c.temperature)&&Number.isFinite(c.rain)&&Number.isFinite(c.cloud))this.current=c;}catch{}}
 get status(){if(!this.current)return 'offline fallback';return this.failed||this.now()-this.current.fetchedAt>30*60000?'cached weather':'live weather';}
 async refresh(){if(this.pending||this.now()<this.next)return;this.pending=true;this.next=this.now()+15*60000;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await this.fetcher.call(globalThis,WEATHER_URL,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('Weather unavailable');this.current=decodeWeather(await r.json(),this.now());this.failed=false;try{this.storage?.setItem('onitshaway:weather',JSON.stringify(this.current));}catch{}}catch(e){this.failed=true;this.lastError=String(e?.message??'Network unavailable');this.next=this.now()+60000;}finally{clearTimeout(timer);this.pending=false;}}
}
