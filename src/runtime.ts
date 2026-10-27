import {Worker} from 'node:worker_threads';
import {createServer} from 'node:net';
import {chmodSync,existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {dataDirectory} from './queue.js';
import {Observer} from './observer.js';
import type {Event,Policy} from './contract.js';
export interface Settings {api:string;credential:string;installation_id:string;secret:string;scope:string;framework:'openclaw'|'hermes';framework_version:string;policy:Policy;}
export function settingsPath(){return join(dataDirectory(),'installation.json');}
export function readSettings():Settings|undefined {const path=settingsPath();return existsSync(path)?JSON.parse(readFileSync(path,'utf8')):undefined;}
export function saveSettings(settings:Settings){writeFileSync(settingsPath(),JSON.stringify(settings),{mode:0o600});}
export function socketPath(id:string){return process.platform==='win32'?`\\\\.\\pipe\\adrouter-${createHash('sha256').update(id).digest('hex').slice(0,24)}`:join(dataDirectory(),`${id}.sock`);}
export class Runtime {
 observer:Observer;worker:Worker;pending=0;stopped=false;latest:Event|undefined;
 constructor(public settings:Settings){
  this.observer=new Observer(settings.policy,settings.secret,settings.framework,settings.framework_version,settings.scope,e=>this.enqueue(e));
  this.worker=new Worker(new URL('./uploader-worker.js',import.meta.url),{workerData:{settings,dir:dataDirectory()}});
  this.worker.on('message',message=>{
   if(message.type==='stored')this.pending=Math.max(0,this.pending-1);
   if(message.type==='policy'){if(message.policy.version!==this.observer.policy.version||message.policy.state!=='active')this.latest=undefined;this.observer.policy=message.policy;this.settings.policy=message.policy;}
   if(message.type==='drop')this.observer.drop(message.code);
  });
  this.worker.on('error',()=>{this.stopped=true;this.observer.drop('storage_worker_failed');});
  // Commands use local IPC. Acknowledgment follows capture disable and queue purge.
  const socket=socketPath(settings.installation_id);
  if(existsSync(socket)&&process.platform!=='win32')unlinkSync(socket);
  const server=createServer(connection=>{let input='';connection.on('data',data=>{input+=data.toString();if(input.length>256){connection.destroy();return;}if(!input.includes('\n'))return;
   const command=input.trim();if(command==='preview'){connection.end(JSON.stringify({event:this.latest??null,dropped:this.observer.drops})+'\n');return;}if(command==='pause'||command==='resume'||command==='revoke'){
    this.latest=undefined;
    this.observer.policy={...this.observer.policy,state:command==='resume'?'active':command==='revoke'?'revoked':'paused'};
    const handler=(message:any)=>{if(message.type==='command_done'){connection.end('ok\n');this.worker.off('message',handler);}};
    this.worker.on('message',handler);this.worker.postMessage({type:command});
   }else connection.end('invalid_command\n');
  });});
  server.on('error',()=>{this.stopped=true;this.observer.drop('local_control_unavailable');});
  server.listen(socket,()=>{if(process.platform!=='win32')chmodSync(socket,0o600);});
  this.worker.on('exit',()=>server.close());server.unref();this.worker.unref();
 }
 enqueue(e:Event){if(this.stopped||this.pending>=1000){this.observer.drop('handoff_full');return;}this.latest=structuredClone(e);this.pending++;this.worker.postMessage({type:'event',event:e});}
 stop(){this.stopped=true;this.observer.policy={...this.observer.policy,state:'paused'};this.worker.postMessage({type:'shutdown'});setTimeout(()=>void this.worker.terminate(),2000).unref();}
}
