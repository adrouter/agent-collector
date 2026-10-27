import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Observer} from '../src/observer.js';
import {validateEvent,type Event,type Policy} from '../src/contract.js';
function policy():Policy{return {installation_id:randomUUID(),state:'active',version:1,permissions:{private_metadata:true,private_content:false,research_metadata:false,research_content:false},grant_epochs:{private_metadata:randomUUID(),private_content:null,research_metadata:null,research_content:null},lease_expires_at:new Date(Date.now()+60000).toISOString(),selected_tools:[],content_fields:[]};}
test('metadata hooks discard raw arguments, results, identifiers and errors',()=>{
 const events:Event[]=[];const observer=new Observer(policy(),'synthetic-local-key','hermes','0.22.5','owned',e=>events.push(e));
 observer.observe('post_tool_call',{tool_name:'private/project/tool',session_id:'private-session',tool_call_id:'private-call',args:{secret:'SYNTHETIC'},result:'private-result',error_message:'private-error',status:'error',duration_ms:15},{scope:'owned'});
 assert.equal(events.length,1);assert.equal(validateEvent(events[0]),true);const serialized=JSON.stringify(events[0]);
 for(const secret of ['private/project/tool','private-session','private-call','SYNTHETIC','private-result','private-error'])assert.equal(serialized.includes(secret),false);
 assert.equal(events[0].observation.status,'error');assert.equal(events[0].content,undefined);
});
test('unattributed, private and expired-policy activity is not captured',()=>{
 let count=0;const observer=new Observer(policy(),'synthetic','openclaw','2026.10.7','owned',()=>count++);
 observer.observe('after_tool_call',{toolName:'browser'},{scope:'other'});
 observer.observe('after_tool_call',{toolName:'browser'},{scope:'owned',private:true});
 observer.policy.lease_expires_at=new Date(Date.now()-1000).toISOString();observer.observe('after_tool_call',{toolName:'browser'},{scope:'owned'});assert.equal(count,0);
});
test('Hermes turn finalization is not treated as session finalization',()=>{
 const events:Event[]=[];const observer=new Observer(policy(),'synthetic','hermes','0.22.5','owned',e=>events.push(e));
 observer.observe('on_session_end',{session_id:'synthetic',turn_id:'turn',completed:true},{scope:'owned'});
 assert.equal(events[0].event_type,'run.ended');assert.equal(events[0].observation.status,'success');
});
test('callback failures leave the host result unchanged and have bounded overhead',()=>{
 const observer=new Observer(policy(),'synthetic','hermes','0.22.5','owned',()=>{throw new Error('synthetic disk full');});
 const samples:number[]=[];const raw={tool_name:'web_search',result:'SYNTHETIC_RESULT',status:'success'};
 for(let i=0;i<2000;i++){const start=performance.now();observer.observe('post_tool_call',raw,{scope:'owned'});samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);assert.equal(raw.result,'SYNTHETIC_RESULT');assert.equal(observer.drops.callback_failure,2000);assert.ok(samples[Math.ceil(samples.length*.95)-1]<10);
});
