import {Runtime,readSettings} from '../dist/src/runtime.js';
export default {
 id:'adrouter-collector',name:'AdRouter Collector',
 register(api:any){
  const settings=readSettings();if(!settings||settings.framework!=='openclaw'||settings.framework_version!=='2026.10.7'||api.runtime.version!=='2026.10.7'){api.logger.warn('AdRouter collector disabled: pairing or supported host version required.');return;}
  const runtime=new Runtime(settings);
  for(const hook of ['after_tool_call','model_call_ended','session_start','session_end']){
   api.on(hook,(event:Record<string,unknown>,context:Record<string,unknown>)=>{
    runtime.observer.observe(hook,event,{scope:context.agentId,private:context.incognito,sessionId:context.sessionId,runId:context.runId,toolCallId:context.toolCallId});
   });
  }
  api.registerService({id:'adrouter-collector-runtime',start(){},stop(){runtime.stop();}});
 }
};
