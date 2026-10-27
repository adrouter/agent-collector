import { createHmac } from 'node:crypto';

export function pseudonym(secret: string, kind: string, value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096
    ? createHmac('sha256', secret).update(kind + '\0' + value).digest('hex') : undefined;
}
// Deliberately narrow registry. Unknown identifiers never leave the host verbatim.
const tools = new Set(['web_search', 'web_fetch', 'terminal', 'read_file', 'write_file', 'browser']);
export function toolKey(secret: string, value: unknown): string {
  return typeof value === 'string' && tools.has(value) ? value : `local:${pseudonym(secret, 'tool', value) ?? 'unknown'}`;
}
export const credentialPattern = /(?:bearer\s+\S+|(?:api[_ -]?key|password|secret|token)\s*[:=]\s*\S+|-----BEGIN[\s\S]*PRIVATE KEY|(?:sk|ghp|gho|xoxb)-[a-zA-Z0-9_-]{10,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.)/i;
export function filterContent(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 65536 || credentialPattern.test(raw) || /[\x00-\x08\x0e-\x1f]/.test(raw)) return;
  const redacted = raw.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
    .replace(/https?:\/\/[^\s]+/gi, '[URL]').replace(/(?:\+?\d[\d ().-]{7,}\d)/g, '[PHONE]')
    .replace(/(?:[A-Za-z]:\\|\/(?:Users|home|private|etc)\/)[^\s]+/g, '[PATH]');
  return [...redacted].slice(0, 2000).join('') || undefined;
}
export function contentIsSafe(value: string): boolean { return filterContent(value) === value; }
