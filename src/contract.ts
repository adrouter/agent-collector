import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../contracts/event.schema.json' with { type: 'json' };

const ajv = new (Ajv as unknown as typeof Ajv.default)({ allErrors: false, strict: true });
(addFormats as unknown as typeof addFormats.default)(ajv);
export const validateEvent = ajv.compile(schema);
export const permissions = ['private_metadata', 'private_content', 'research_metadata', 'research_content'] as const;
export type Permission = typeof permissions[number];
export type Consent = Record<Permission, boolean>;
export type Epochs = Record<Permission, string | null>;
export interface Policy {
  installation_id: string; state: 'active' | 'paused' | 'revoked'; version: number;
  permissions: Consent; grant_epochs: Epochs; lease_expires_at: string;
  selected_tools: string[]; content_fields: string[];
}
export interface Event {
  schema_version: 1; event_id: string; event_type: string; occurred_at: string;
  framework: 'openclaw' | 'hermes'; framework_version: string; collector_version: string;
  capability_version: string; source_hook: string; installation_id: string; process_ref: string;
  sequence: number; consent_version: number; grant_epochs: Epochs; synthetic: boolean;
  observation: Record<string, string | number | boolean>;
  session_ref?: string; run_ref?: string; call_ref?: string; parent_run_ref?: string;
  content?: {task_description?: string; tool_excerpt?: string};
}
export function consentTransition(current: Consent, changes: Partial<Consent>): Consent {
  if (Object.keys(changes).some(k => !permissions.includes(k as Permission) || typeof changes[k as Permission] !== 'boolean')) throw new Error('invalid_consent');
  const next = { ...current, ...changes };
  if (!next.private_metadata) {
    if (changes.private_content || changes.research_metadata || changes.research_content) throw new Error('consent_dependency');
    next.private_content = next.research_metadata = next.research_content = false;
  }
  if (!next.private_content || !next.research_metadata) {
    if (changes.research_content) throw new Error('consent_dependency');
    next.research_content = false;
  }
  return next;
}
