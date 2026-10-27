import { randomUUID } from 'node:crypto';
import type { Event, Policy } from './contract.js';
import { pseudonym, toolKey, filterContent } from './privacy.js';

export class Observer {
  process = randomUUID(); sequence = 0; drops: Record<string, number> = {};
  constructor(public policy: Policy, private secret: string, private framework: 'openclaw'|'hermes', private frameworkVersion: string, private enrolledScope: string, private emit: (e: Event)=>void) {}
  drop(reason: string) { this.drops[reason] = (this.drops[reason] ?? 0) + 1; }
  observe(hook: string, raw: Record<string, unknown>, ctx: Record<string, unknown> = {}) {
    try {
      if (this.policy.state !== 'active' || !this.policy.permissions.private_metadata || Date.parse(this.policy.lease_expires_at) <= Date.now()) return;
      // Explicitly enrolled identity and affirmative non-private state are required.
      if (ctx.scope !== this.enrolledScope || ctx.private !== false) { this.drop('unattributed_or_private'); return; }
      const mapping: Record<string, string> = this.framework === 'hermes' ? {
        post_tool_call:'tool.completed', post_api_request:'model.completed', api_request_error:'model.failed', on_session_start:'session.started', on_session_end:'run.ended', on_session_finalize:'session.ended'
      } : {after_tool_call:'tool.completed', llm_output:'model.completed', session_start:'session.started', session_end:'session.ended'};
      const type = mapping[hook]; if (!type) return;
      const e: Event = {schema_version:1,event_id:randomUUID(),event_type:type,occurred_at:new Date().toISOString(),framework:this.framework,framework_version:this.frameworkVersion,collector_version:'0.1.0',capability_version:`${this.framework}-v1`,source_hook:hook,installation_id:this.policy.installation_id,process_ref:this.process,sequence:this.sequence++,consent_version:this.policy.version,grant_epochs:{...this.policy.grant_epochs},synthetic:false,observation:{status:'unknown'}};
      const ids: Record<string, unknown> = this.framework === 'hermes' ? {session_ref:raw.session_id,run_ref:raw.turn_id,call_ref:type==='tool.completed'?raw.tool_call_id:raw.api_request_id} : {session_ref:ctx.sessionId,run_ref:ctx.runId,call_ref:raw.toolCallId};
      for (const [key, val] of Object.entries(ids)) { const ref = pseudonym(this.secret,key,val); if(ref) (e as unknown as Record<string,unknown>)[key] = ref; }
      if (type === 'tool.completed') e.observation.tool_key = toolKey(this.secret, raw.tool_name ?? raw.toolName);
      const status = raw.status;
      if (['success','error','blocked','interrupted','unknown'].includes(String(status))) e.observation.status = String(status);
      if (type === 'model.failed') e.observation.status = 'error';
      if (hook === 'on_session_end') e.observation.status = raw.interrupted === true ? 'interrupted' : raw.failed === true ? 'error' : raw.completed === true ? 'success' : 'unknown';
      const duration = raw.duration_ms ?? raw.durationMs;
      if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 && duration <= 604800000) e.observation.duration_ms = duration;
      if (typeof raw.retry_count === 'number' && Number.isSafeInteger(raw.retry_count) && raw.retry_count >= 0 && raw.retry_count < 1000) {e.observation.attempt=raw.retry_count+1; e.observation.retry=raw.retry_count>0;}
      // Content is opt-in and restricted to selected public tools and a documented source field.
      const publicTool = e.observation.tool_key;
      if (this.policy.permissions.private_content && typeof publicTool === 'string' && this.policy.selected_tools.includes(publicTool) && this.policy.content_fields.includes('tool_excerpt') && publicTool === 'web_search') {
        const excerpt = filterContent(raw.result); if (excerpt) e.content={tool_excerpt:excerpt}; else this.drop('content_filtered');
      }
      this.emit(e);
    } catch { this.drop('callback_failure'); }
  }
}
