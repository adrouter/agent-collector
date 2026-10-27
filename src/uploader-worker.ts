import {workerData,parentPort} from 'node:worker_threads';
import {join} from 'node:path';
import {writeFileSync,unlinkSync} from 'node:fs';
import {Queue} from './queue.js';
import type {Policy} from './contract.js';
import type {Settings} from './runtime.js';
const settings=workerData.settings as Settings;
const queue=new Queue(join(workerData.dir,settings.installation_id+'.sqlite'));
let policy=settings.policy,paused=settings.policy.state==='paused',busy=false,retryAt=0,failures=0,lastRefresh=0,lastHeartbeat=0,rejected=0;
const send=(message:unknown)=>parentPort?.postMessage(message);
async function call(path:string,body?:unknown){return fetch(settings.api+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${settings.credential}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});}
function save(){writeFileSync(join(workerData.dir,'installation.json'),JSON.stringify({...settings,policy}),{mode:0o600});}
function setPolicy(p:Policy){if(p.version!==policy.version||p.state!=='active'||!p.permissions.private_metadata){queue.purge();}policy=paused&&p.state==='active'?{...p,state:'paused'}:p;save();send({type:'policy',policy});}
async function refresh(){
 const response=await call('/v1/collector/config');lastRefresh=Date.now();
 if(response.status===401){queue.purge();paused=true;policy={...policy,state:'revoked'};send({type:'policy',policy});try{unlinkSync(join(workerData.dir,'installation.json'));}catch{}return;}
 if(!response.ok)throw new Error('policy_unavailable');setPolicy(await response.json() as Policy);
}
async function tick(){
 if(busy||Date.now()<retryAt)return;busy=true;
 try{
  if(Date.now()-lastRefresh>=60000)await refresh();
  if(paused||policy.state!=='active'||!policy.permissions.private_metadata||Date.parse(policy.lease_expires_at)<=Date.now())return;
  const batch=queue.batch();if(batch.length){
   const response=await call('/v1/events/batch',{events:batch});
   if(response.status===401){await refresh();return;}
   if(response.status===403){await refresh();queue.purge();return;}
   if(response.status===429){const wait=Number(response.headers.get('Retry-After'));retryAt=Date.now()+Math.min(300000,Math.max(1000,Number.isFinite(wait)?wait*1000:60000));return;}
   if(response.status>=500)throw new Error('upload_unavailable');
   if(!response.ok){if([400,413].includes(response.status)){queue.ack(batch.map(e=>e.event_id));rejected+=batch.length;}else throw new Error('unexpected_response');}
   else {
    const result=await response.json() as {receipts:{event_id:string;status:string;retryable:boolean}[]};
    const ids=new Set(batch.map(e=>e.event_id));
    queue.ack(result.receipts.filter(r=>ids.has(r.event_id)&&(['accepted','duplicate'].includes(r.status)||r.status==='rejected'&&!r.retryable)).map(r=>r.event_id));
    rejected+=result.receipts.filter(r=>r.status==='rejected').length;
   }
  }
  if(Date.now()-lastHeartbeat>=60000){await call('/v1/collector/heartbeat',{queued:queue.batch().length,dropped:queue.drops,rejected,policy_version:policy.version});lastHeartbeat=Date.now();}
  failures=0;retryAt=0;
 }catch{failures++;retryAt=Date.now()+Math.min(300000,1000*2**Math.min(failures,9))*(.75+Math.random()*.25);send({type:'drop',code:'delivery_unavailable'});}
 finally{busy=false;}
}
const timer=setInterval(()=>void tick(),10000);void tick();
parentPort?.on('message',async message=>{
 try{
  if(message.type==='event'){
   if(!paused&&policy.state==='active'&&policy.permissions.private_metadata&&Date.parse(policy.lease_expires_at)>Date.now())queue.put(message.event);
   send({type:'stored'});if(queue.batch().length>=100)void tick();
  }else if(message.type==='shutdown'){clearInterval(timer);queue.close();parentPort?.close();}
  else if(['pause','resume','revoke'].includes(message.type)){
   paused=message.type!=='resume';queue.purge();
   if(message.type==='resume')await refresh();else{policy={...policy,state:message.type==='revoke'?'revoked':'paused'};save();}
   send({type:'policy',policy});send({type:'command_done'});
  }
 }catch{send({type:'drop',code:'local_storage_failed'});if(message.type==='event')send({type:'stored'});}
});
