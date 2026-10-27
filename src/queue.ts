import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync, realpathSync, existsSync } from 'node:fs';
import { join,dirname,relative } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import type { Event } from './contract.js';

export function dataDirectory(): string {
  const base = process.platform === 'win32' ? process.env.LOCALAPPDATA : process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support') : process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share');
  if (!base) throw new Error('local_storage_unavailable');
  const dir = join(base, 'AdRouterCollector', 'openclaw');
  let ancestor=dir;while(!existsSync(ancestor))ancestor=dirname(ancestor);
  const prospective=join(realpathSync(ancestor),relative(ancestor,dir));
  if (/Mobile Documents|iCloud|OneDrive|(?:^|[/\\])(?:Documents|Desktop)(?:[/\\]|$)/i.test(prospective)) throw new Error('synced_storage_forbidden');
  mkdirSync(dir, {recursive:true, mode:0o700});
  const resolved = realpathSync(dir);
  if (/Mobile Documents|iCloud|OneDrive|(?:^|[/\\])(?:Documents|Desktop)(?:[/\\]|$)/i.test(resolved)) throw new Error('synced_storage_forbidden');
  if (process.platform === 'win32') {
    const who = execFileSync('whoami', [], {encoding:'utf8'}).trim();
    execFileSync('icacls', [dir, '/inheritance:r', '/grant:r', `${who}:(OI)(CI)F`], {stdio:'ignore'});
  } else chmodSync(dir, 0o700);
  return dir;
}
export class Queue {
  db: DatabaseSync;
  drops = 0;
  constructor(path: string, private capacity = 100 * 1024 * 1024) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS pending(id TEXT PRIMARY KEY, captured INTEGER NOT NULL, bytes INTEGER NOT NULL, payload TEXT NOT NULL)');
    if (process.platform !== 'win32') chmodSync(path, 0o600);
  }
  put(event: Event, now = Date.now()) {
    const payload = JSON.stringify(event); const bytes = Buffer.byteLength(payload);
    if (bytes > 16384) { this.drops++; return; }
    this.db.prepare('INSERT OR IGNORE INTO pending VALUES(?,?,?,?)').run(event.event_id, now, bytes, payload);
    this.trim(now);
  }
  trim(now = Date.now()) {
    this.drops += Number(this.db.prepare('DELETE FROM pending WHERE captured < ?').run(now - 7 * 86400000).changes);
    while (Number((this.db.prepare('SELECT COALESCE(SUM(bytes),0) n FROM pending').get() as {n:number}).n) > this.capacity) {
      this.db.exec('DELETE FROM pending WHERE id IN (SELECT id FROM pending ORDER BY captured,id LIMIT 1)'); this.drops++;
    }
  }
  batch(): Event[] {
    this.trim(); const events: Event[] = []; let bytes = 14;
    for (const row of this.db.prepare('SELECT payload FROM pending ORDER BY captured,id LIMIT 100').all() as {payload:string}[]) {
      bytes += Buffer.byteLength(row.payload) + 1; if (bytes > 1048576) break;
      events.push(JSON.parse(row.payload));
    }
    return events;
  }
  ack(ids: string[]) { const q = this.db.prepare('DELETE FROM pending WHERE id=?'); for (const id of ids) q.run(id); }
  purge() { this.db.exec('DELETE FROM pending; PRAGMA wal_checkpoint(TRUNCATE)'); }
  close() { this.db.close(); }
}
