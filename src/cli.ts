#!/usr/bin/env node
import {randomBytes} from 'node:crypto';
import {createConnection} from 'node:net';
import {readSettings,saveSettings,socketPath} from './runtime.js';
import type {Policy} from './contract.js';
const [command,...args]=process.argv.slice(2);
async function setup(){
 const [framework,version,scope,api='https://slarp-api.adrouter.co']=args;
 if(framework!=='openclaw'||version!=='2026.10.7'||!scope||!(new URL(api).protocol==='https:'||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(api)))throw new Error('Use setup openclaw 2026.10.7 <owned-agent> [api]. For Hermes use python -m adrouter_collector.');
 if(readSettings())throw new Error('An installation already exists. Revoke and uninstall it before pairing a new one.');
 const response=await fetch(api+'/v1/collector/pairings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({framework,framework_version:version,label:'Agent collector'})});
 if(!response.ok)throw new Error('Pairing unavailable. Admission may be closed.');const pairing=await response.json() as {id:string;proof:string;code:string};
 console.log(`Open https://slarp.adrouter.co, choose Installations, and enter code ${pairing.code}. Confirm only a workload you own. Research and optional content start off.`);
 for(let i=0;i<120;i++){
  await new Promise(r=>setTimeout(r,5000));const r=await fetch(api+`/v1/collector/pairings/${pairing.id}/exchange`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({proof:pairing.proof})});
  if(r.status===429)continue;if(!r.ok)throw new Error('Pairing expired or failed. Start a new pairing.');
  const result=await r.json() as {state:string;credential:string;installation_id:string};if(result.state!=='paired')continue;
  const config=await fetch(api+'/v1/collector/config',{headers:{Authorization:`Bearer ${result.credential}`}});if(!config.ok)throw new Error('Configuration unavailable. Revoke the unused installation and pair again.');
  saveSettings({api,framework:framework as 'openclaw'|'hermes',framework_version:version,scope,credential:result.credential,installation_id:result.installation_id,secret:randomBytes(32).toString('hex'),policy:await config.json() as Policy});console.log('Paired. Enable the observer plugin for the selected instance.');return;
 }throw new Error('Pairing expired.');
}
try{
 if(command==='setup')await setup();
 else if(command==='status'){const settings=readSettings();console.log(settings?JSON.stringify({installation_id:settings.installation_id,framework:settings.framework,scope:settings.scope,state:settings.policy.state,policy_version:settings.policy.version,lease_expires_at:settings.policy.lease_expires_at}):'Not paired');}
 else if(['pause','resume','revoke','preview'].includes(command)){
  const settings=readSettings();if(!settings)throw new Error('Not paired.');
  if(command==='revoke')throw new Error('Permanently revoke in Sharing and Privacy, then use pause and remove the plugin and local storage. Hosted deletion is separate.');
  await new Promise<void>((resolve,reject)=>{let result='';const connection=createConnection(socketPath(settings.installation_id));connection.setTimeout(5000,()=>connection.destroy(new Error('Local control timed out')));connection.on('connect',()=>connection.write(command+'\n'));connection.on('data',data=>{result+=data.toString();if(result.length>32768){connection.destroy();reject(new Error('Preview too large'));return;}if(!result.endsWith('\n'))return;if(command==='preview'){console.log(result.trim());connection.end();resolve();}else if(result.startsWith('ok')){connection.end();resolve();}else reject(new Error('Local control failed'));});connection.on('error',reject);});if(command!=='preview')console.log(command==='pause'?'Paused; pending queue purged.':'Resumed for future observations.');
 }else console.log('Commands: setup, status, preview, pause, resume. See docs/installation.md for revoke and uninstall.');
}catch(e){console.error(e instanceof Error?e.message:'Collector command failed');process.exitCode=1;}
