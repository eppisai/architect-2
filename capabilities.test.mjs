import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, addAgent, removeAgent, checkpoint, restoreVersion, publish, rollback, generateFiles, applyOps } from './model.mjs';
import { platform, addCollection, saveRecord, saveSchema, saveRoute, workflowTrace, validateConnection, validateListing, recordEvent, themeFor } from './capabilities.mjs';

test('database rejects invalid records and schema changes without altering saved data',()=>{
 const p=createProject('policy assistant');
 addCollection(p,'requests',[{name:'title',type:'string',required:true},{name:'resolved',type:'boolean'}]);
 saveRecord(p,'requests',{title:'Vacation',resolved:false});
 const c=platform(p).collections.find(c=>c.name==='requests'), before=structuredClone(c);
 assert.throws(()=>saveRecord(p,'requests',{title:'',resolved:false}),/required/);
 assert.throws(()=>saveRecord(p,'requests',{title:'Okay',resolved:'yes'}),/boolean/);
 assert.throws(()=>saveSchema(p,'requests',[{name:'title',type:'number',required:true}]),/number/);
 assert.deepEqual(c,before);
 saveRecord(p,'requests',{title:'Approved',resolved:true},c.records[0].id);
 assert.equal(c.records.length,1);assert.equal(c.records[0].resolved,true);
 assert.throws(()=>addCollection(p,'requests',[{name:'title',type:'string'}]),/already/);
});
test('workflow branches on result, skips disabled agents and rejects cycles',()=>{
 const p=createProject('policy assistant'),a=addAgent(p,{name:'Reviewer',responsibility:'Review'}),b=addAgent(p,{name:'Escalation',responsibility:'Escalate'});
 saveRoute(p,{from:'main',to:a.id,when:'answered'});saveRoute(p,{from:'main',to:b.id,when:'unanswered'});
 assert.equal(workflowTrace(p,true).find(x=>x.id===a.id).status,'simulated');
 assert.equal(workflowTrace(p,true).find(x=>x.id===b.id).status,'skipped');
 assert.equal(workflowTrace(p,false).find(x=>x.id===b.id).status,'simulated');
 a.enabled=false;assert.equal(workflowTrace(p,true).find(x=>x.id===a.id).status,'skipped');
 const routes=structuredClone(platform(p).routes);
 assert.throws(()=>saveRoute(p,{from:b.id,to:'main',when:'always'}),/loop/);assert.deepEqual(platform(p).routes,routes);
 removeAgent(p,b.id);assert.equal(platform(p).routes.some(r=>r.to===b.id),false);
 platform(p).routes=[];a.enabled=true;assert.equal(workflowTrace(p,true).find(x=>x.id===a.id).status,'unconnected');
});
test('new capability state survives export, version restore and independent release rollback',()=>{
 const p=createProject('policy assistant');const initial=p.versions[0];
 const st=platform(p);st.architecture='repository';st.analytics=false;
 addCollection(p,'requests',[{name:'title',type:'string'}]);saveRecord(p,'requests',{title:'Original'});
 p.revision++;checkpoint(p,'Database and ownership');const release=publish(p);
 platform(p).collections[1].records[0].title='Changed';
 assert.equal(release.platform.collections[1].records[0].title,'Original');
 rollback(p,release);assert.equal(platform(p).collections[1].records[0].title,'Original');
 assert.ok(generateFiles(p).find(f=>f.path==='agenticos/workbench.md'));
 const records=JSON.parse(generateFiles(p).find(f=>f.path==='data/records.json').text);assert.equal(records.requests[0].title,'Original');
 restoreVersion(p,initial.id);assert.equal(platform(p).collections.length,1);assert.equal(platform(p).architecture,'managed');
});
test('connections require scoped actions and exclude secrets in endpoint URLs',()=>{
 const c={name:'Support',endpoint:'https://example.com/mcp',scope:'tickets',actions:['read']};
 assert.doesNotThrow(()=>validateConnection(c));
 assert.throws(()=>validateConnection({...c,actions:[]}),/action/);
 assert.throws(()=>validateConnection({...c,endpoint:'https://example.com/?token=secret'}),/credentials/);
 assert.throws(()=>validateConnection({...c,endpoint:'http://example.com'}),/https/);
});
test('marketplace listing requires public access and complete bounded copy',()=>{
 const m={enabled:true,summary:'A policy desk',description:'Answers policy questions with sources.',tags:['HR']};
 assert.doesNotThrow(()=>validateListing(m,'public'));assert.throws(()=>validateListing(m,'team'),/Anyone/);
 assert.throws(()=>validateListing({...m,summary:'x'.repeat(161)},'public'),/160/);
 assert.throws(()=>validateListing({...m,tags:Array(9).fill('tag')},'public'),/8 tags/);
 const p=createProject('policy assistant');platform(p).marketplace=m;
 applyOps(p,[{type:'settings',change:{audience:'team'}}]);assert.equal(platform(p).marketplace.enabled,false);
});
test('analytics obeys opt-out and theme changes clear custom design overrides',()=>{
 const p=createProject('policy assistant');recordEvent(p,'question',{supported:true});assert.equal(p.events.length,1);
 platform(p).analytics=false;recordEvent(p,'question');assert.equal(p.events.length,1);
 platform(p).design={tokens:{accent:'#123456'}};const themes={forest:{accent:'#000000'}};
 assert.equal(themeFor(p,themes).accent,'#123456');applyOps(p,[{type:'settings',change:{theme:'forest'}}]);assert.equal(themeFor(p,themes).accent,'#000000');
});
