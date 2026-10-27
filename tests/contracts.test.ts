import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import fixtures from '../fixtures/events.json' with {type:'json'};
import {validateEvent,consentTransition, type Event} from '../src/contract.js';
import {filterContent} from '../src/privacy.js';
import {Queue} from '../src/queue.js';
for(const f of fixtures) test(f.name,()=>assert.equal(validateEvent(f.event), f.valid));
test('dependencies never expand a child grant',()=>{
 const off={private_metadata:false,private_content:false,research_metadata:false,research_content:false};
 assert.deepEqual(consentTransition(off,{private_metadata:true}),{...off,private_metadata:true});
 assert.throws(()=>consentTransition(off,{research_content:true}));
 assert.deepEqual(consentTransition({...off,private_metadata:true,research_metadata:true},{private_metadata:false}),off);
});
test('privacy discards credentials before truncation and redacts identifiers',()=>{
 assert.equal(filterContent('x'.repeat(3000)+' api_key=SYNTHETIC_SECRET'),undefined);
 assert.equal(filterContent('Contact fake@example.test at https://example.test/private'), 'Contact [EMAIL] at [URL]');
 assert.equal(filterContent({secret:'SYNTHETIC'}),undefined);
});
test('SQLite recovers stable IDs after restart, bounds space and purges',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'adrouter-v4-')),'queue.sqlite');
 let q=new Queue(path); const event=fixtures[0].event as unknown as Event;
 q.put(event);q.put(event);q.close();q=new Queue(path);
 assert.equal(q.batch().length,1);q.ack([event.event_id]);assert.equal(q.batch().length,0);
 q.put(event,Date.now()-8*86400000);assert.equal(q.batch().length,0);assert.equal(q.drops,1);q.close();
});
