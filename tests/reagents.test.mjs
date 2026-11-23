import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {build} from 'esbuild';
mkdirSync('work/reagent-tests',{recursive:true});
await build({entryPoints:['worker/material-api.ts'],outfile:'work/reagent-tests/api.mjs',bundle:true,platform:'node',format:'esm'});
const {materialApi}=await import('../work/reagent-tests/api.mjs');
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
for(const name of ['0000_lab_calendar','0001_material_connections'])db.exec(readFileSync('drizzle/'+name+'.sql','utf8'));
db.exec("INSERT INTO calendar_members (id,email,name,role,approved,can_create_lab) VALUES ('owner','owner@example.test','Owner','admin',1,1)");
// Seed legacy data before running the append-only migration; these records must survive byte-for-byte.
const legacyMaterial={id:'legacy-chemical',name:'Legacy chemical',component:'Other',unit:'g',mw:123,unassignedInventories:[{id:'container-without-lot',unit:'g',inventory:{capacity:'14',remaining:'12',location:'냉장고',state:'pellets',notes:'Keep original',lifecycle:'Active'}}]};
db.prepare("INSERT INTO material_entities (id,name,payload,created_by,created_at,updated_at) VALUES (?,?,?,'owner','','')").run(legacyMaterial.id,legacyMaterial.name,JSON.stringify(legacyMaterial));
const safePayload={id:'legacy-bottle',name:'MFG-001',inventory:{capacity:'100',remaining:'40',location:'냉장고',purchased:'2026-11-01',lifecycle:'Active'},unit:'g'};
const ambiguousPayload={id:'legacy-group',name:'Unknown group',inventory:{capacity:'300',remaining:'250',location:'상온 시약장 좌측',lifecycle:'Active'},unit:'g'};
for(const p of [safePayload,ambiguousPayload])db.prepare("INSERT INTO material_lots(id,material_id,number,payload,created_at,updated_at) VALUES (?,?,?,?,'','')").run(p.id,legacyMaterial.id,p.name,JSON.stringify(p));
const snapshot={source:'legacy experiment',materialId:legacyMaterial.id,lotId:safePayload.id,mw:123};
db.prepare("INSERT INTO material_experiments (id,owner_id,client_id,kind,local_id,name,project_ids,payload,fingerprint,created_at,updated_at) VALUES ('old-experiment','owner','test_browser_1','oligomer','OLD-1','Original','[]',?,'old','','')").run(JSON.stringify(snapshot));
db.prepare("INSERT INTO material_usages(id,experiment_id,local_key,material_id,lot_id,role,planned_unit,actual_unit,snapshot,created_at,updated_at) VALUES ('old-usage','old-experiment','row-1',?,?,'촉매','g','g',?,'','')").run(legacyMaterial.id,safePayload.id,JSON.stringify(snapshot));
db.exec(readFileSync('drizzle/0002_reagent_lifecycle.sql','utf8'));
assert.equal(db.prepare('SELECT COUNT(*) n FROM material_pre_reagent_backup').get().n,4);
assert.equal(JSON.parse(db.prepare("SELECT payload FROM material_pre_reagent_backup WHERE kind='lot' AND id='legacy-bottle'").get().payload).row.inventory.remaining,'40');
class P{constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...args){return new P(this.sql,args)}async first(){return db.prepare(this.sql).get(...this.args)||null}async all(){return {results:db.prepare(this.sql).all(...this.args)}}async run(){return {meta:{changes:Number(db.prepare(this.sql).run(...this.args).changes)}}}}
const env={DB:{prepare:sql=>new P(sql),batch:async commands=>{db.exec('BEGIN');try{const out=[];for(const c of commands)out.push(await c.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}},CALENDAR_OWNER_EMAIL:'owner@example.test'};
async function req(path,body,user='owner',method=body?'POST':'GET',origin='https://test.local'){const headers={'content-type':'application/json',origin};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test'}const r=await materialApi(new Request('https://test.local/api/materials'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()}}
const okay=r=>assert.equal(r.status,200,JSON.stringify(r.data));
const lib=async()=>{const r=await req('/library?clientId=test_browser_1');okay(r);return r.data};
let data=await lib();let legacy=data.materials.find(m=>m.id===legacyMaterial.id);
assert.equal(legacy.lots.length,3);assert.equal(legacy.lots.find(l=>l.id===safePayload.id).reviewRequired,false);assert.equal(legacy.lots.find(l=>l.id===ambiguousPayload.id).reviewRequired,true);
assert.equal(legacy.lots.find(l=>l.inventory?.notes==='Keep original').reviewRequired,true);
assert.equal(db.prepare('SELECT payload FROM material_entities WHERE id=?').get(legacyMaterial.id).payload,JSON.stringify(legacyMaterial));
assert.equal(db.prepare('SELECT payload FROM material_lots WHERE id=?').get(safePayload.id).payload,JSON.stringify(safePayload));
assert.equal(db.prepare("SELECT snapshot FROM material_usages WHERE id='old-usage'").get().snapshot,JSON.stringify(snapshot));
assert.ok(db.prepare("SELECT reagent_id FROM material_usages WHERE id='old-usage'").get().reagent_id);
const migratedCount=db.prepare('SELECT COUNT(*) n FROM material_reagents').get().n;await lib();assert.equal(db.prepare('SELECT COUNT(*) n FROM material_reagents').get().n,migratedCount,'Migration idempotence');
assert.equal((await req('/reagents/save',{},null)).status,401);assert.equal((await req('/reagents/save',{},'pending')).status,403);assert.equal((await req('/reagents/save',{},'owner','POST','https://evil.test')).status,403);
// Catalog initialization is empty-only; create a chemical explicitly for the lifecycle scenario.
let created=await req('/save',{draft:{name:'EDDT test',component:'Thiol',unit:'g',mw:'154.25',density:'1.12',functionality:'2',cas:'14970-87-7'}});okay(created);const materialId=created.data.materialId;
const fields={manufacturer:'TCI',productNumber:'E-100',supplier:'Research supplier',capacity:'100',remaining:'75',location:'냉장고',purchased:'2026-11-20',received:'2026-11-21',expires:'2028-11-20',unopened:true,notes:'First bottle'};
created=await req('/reagents/save',{materialId,fields,unit:'g',manufacturingLot:'MFG-SAME',internalCode:'EDDT #001'});okay(created);const first=created.data.reagentId;
let material=created.data.materials.find(m=>m.id===materialId);let bottle=material.lots.find(l=>l.reagentId===first);assert.equal(bottle.inventory.lifecycle,'Active');assert.equal(bottle.manufacturingLot,'MFG-SAME');assert.equal(bottle.sourceKind,'purchased');
assert.equal(db.prepare('SELECT COUNT(*) n FROM material_entities WHERE id=?').get(materialId).n,1);
assert.equal((await req('/reagents/save',{materialId,fields:{...fields,received:''},unit:'g'})).status,400,'Shipping cannot create active reagent');
const record={clientId:'test_browser_1',kind:'oligomer',localId:'SYN-EDDT-1',name:'EDDT reaction',projectIds:['project-1'],performedDate:'2026-11-23',snapshot:{bottle:first,originalMw:154.25},links:[],unresolved:[],usages:[{key:'r1',materialId,lotId:bottle.id,reagentId:first,role:'모노머',plannedAmount:'10',plannedUnit:'g',actualAmount:'9.5',actualUnit:'g',snapshot:{name:'EDDT test',mw:154.25,reagentId:first}}]};
okay(await req('/records',record));assert.equal(db.prepare('SELECT reagent_id FROM material_usages WHERE local_key=? AND material_id=?').get('r1',materialId).reagent_id,first);
assert.equal(JSON.parse(db.prepare('SELECT payload FROM material_reagents WHERE id=?').get(first).payload).fields.remaining,'75','No automatic stock deduction');
let changed=await req('/reagents/'+first+'/status',{status:'Completed',date:'2026-11-24',reason:'모두 사용',revision:bottle.revision});okay(changed);bottle=changed.data.materials.find(m=>m.id===materialId).lots.find(l=>l.reagentId===first);assert.equal(bottle.inventory.lifecycle,'Completed');assert.equal(bottle.inventory.completedDate,'2026-11-24');
let history=await req('/reagents/'+first+'/history');okay(history);assert.equal(history.data.usages.length,1);assert.equal(history.data.usages[0].reagent_id,first);assert.ok(history.data.history.some(h=>h.to_status==='Completed'&&h.reason==='모두 사용'));
assert.equal((await req('/reagents/'+first+'/status',{status:'Active',date:'2026-11-24',reason:'Wrong version',revision:1})).status,409);
// Repurchase preserves the same chemical but creates an independent bottle, even if manufacturing Lot repeats.
created=await req('/reagents/save',{materialId,fields:{...fields,capacity:'250',remaining:'',purchased:'2026-11-24',received:'2026-11-24',supplier:'New supplier',notes:''},unit:'g',manufacturingLot:'MFG-SAME',internalCode:'EDDT #002'});okay(created);const second=created.data.reagentId;assert.notEqual(second,first);material=created.data.materials.find(m=>m.id===materialId);assert.equal(material.lots.find(l=>l.reagentId===first).inventory.lifecycle,'Completed');assert.equal(material.lots.find(l=>l.reagentId===second).inventory.lifecycle,'Active');assert.equal(db.prepare('SELECT material_id FROM material_reagents WHERE id=?').get(second).material_id,materialId);
assert.equal(db.prepare('SELECT reagent_id FROM material_usages WHERE local_key=? AND material_id=?').get('r1',materialId).reagent_id,first,'Old experiment never repoints to repurchased bottle');
const beforeSnapshot=db.prepare("SELECT payload FROM material_experiments WHERE local_id='SYN-EDDT-1'").get().payload;
changed=await req('/reagents/'+first+'/status',{status:'Active',date:'2026-11-24',reason:'잘못 완료 처리하여 복원',revision:bottle.revision});okay(changed);bottle=changed.data.materials.find(m=>m.id===materialId).lots.find(l=>l.reagentId===first);
changed=await req('/reagents/'+first+'/status',{status:'Disposed',date:'2026-11-24',reason:'오염',revision:bottle.revision});okay(changed);bottle=changed.data.materials.find(m=>m.id===materialId).lots.find(l=>l.reagentId===first);assert.equal(bottle.inventory.disposedDate,'2026-11-24');assert.notEqual(bottle.inventory.lifecycle,'Completed');assert.equal(db.prepare("SELECT payload FROM material_experiments WHERE local_id='SYN-EDDT-1'").get().payload,beforeSnapshot);
history=await req('/reagents/'+first+'/history');assert.ok(history.data.history.some(h=>h.from_status==='Completed'&&h.to_status==='Active'));assert.ok(history.data.history.some(h=>h.to_status==='Disposed'));
const wrong=structuredClone(record);wrong.localId='WRONG-MATERIAL';wrong.usages[0].materialId=legacyMaterial.id;wrong.usages[0].lotId=null;assert.equal((await req('/records',wrong)).status,400);
assert.throws(()=>db.prepare("UPDATE material_usages SET reagent_id=? WHERE id='old-usage'").run(second),/reagent material mismatch/);
// One purchase order can have several bottles, but none exist before actual receipt.
const countBefore=db.prepare('SELECT COUNT(*) n FROM material_reagents').get().n;
let order=await req('/orders/save',{materialId,status:'Requested',manufacturer:'TCI',productNumber:'E-100',supplier:'Order supplier',capacity:'50',unit:'g',count:2,purchased:'2026-11-24',location:'냉장고'});okay(order);const orderId=order.data.orderId;assert.equal(db.prepare('SELECT COUNT(*) n FROM material_reagents').get().n,countBefore);
let orderRow=order.data.orders.find(o=>o.id===orderId);order=await req('/orders/save',{...orderRow,status:'Shipping'});okay(order);assert.equal(db.prepare('SELECT COUNT(*) n FROM material_reagents').get().n,countBefore);
orderRow=order.data.orders.find(o=>o.id===orderId);assert.equal((await req('/orders/'+orderId+'/receive',{received:'',count:2,capacity:'50',unit:'g',location:'냉장고',revision:orderRow.revision})).status,400);
const receipt={received:'2026-11-24',count:2,capacity:'50',unit:'g',location:'냉장고',manufacturingLot:'SHIP-MFG',revision:orderRow.revision};let received=await req('/orders/'+orderId+'/receive',receipt);okay(received);assert.equal(received.data.orders.find(o=>o.id===orderId).status,'Received');const receivedRows=db.prepare('SELECT * FROM material_reagents WHERE order_id=?').all(orderId);assert.equal(receivedRows.length,2);assert.notEqual(receivedRows[0].id,receivedRows[1].id);assert.ok(receivedRows.every(r=>r.status==='Active'&&r.material_id===materialId));okay(await req('/orders/'+orderId+'/receive',receipt));assert.equal(db.prepare('SELECT COUNT(*) n FROM material_reagents WHERE order_id=?').get(orderId).n,2,'Repeated receipt cannot duplicate bottles');
assert.equal((await req('/orders/save',{...received.data.orders.find(o=>o.id===orderId),status:'Ordered'})).status,400);
// The actual common picker's filter preserves history while exposing only usable bottles/batches.
await build({entryPoints:['src/materials/MaterialPicker.tsx'],outfile:'work/reagent-tests/picker.mjs',bundle:true,platform:'node',format:'esm',loader:{'.css':'empty'}});
const {selectableReagents}=await import('../work/reagent-tests/picker.mjs');
const latest=(await lib()).materials.find(m=>m.id===materialId);const available=selectableReagents(latest);
assert.ok(available.some(l=>l.reagentId===second));assert.ok(!available.some(l=>l.reagentId===first));assert.equal(available.filter(l=>l.orderId===orderId).length,2);
assert.equal(selectableReagents(legacy).length,1,'Uncertain imports never auto-select');
const outputEntry={id:'batch-anchor',name:'OLG-001',sourceKind:'synthesized',sourceExperimentId:'old-experiment'};
assert.equal(selectableReagents({...latest,lots:[outputEntry]}).length,1,'Own synthesized output remains selectable without becoming purchased reagent');
assert.equal(selectableReagents({...latest,lots:latest.lots.map(l=>({...l,inventory:{...l.inventory,lifecycle:'Completed'}}))}).length,0);
const staleRecord=structuredClone(record);staleRecord.localId='MISMATCH-ANCHOR';staleRecord.usages[0].reagentId=second;assert.equal((await req('/records',staleRecord)).status,400,'An explicit reagent ID must agree with its compatibility anchor');
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
console.log('PASS: additive backups, conservative/idempotent migration, unchanged legacy snapshots, per-bottle IDs, repurchase without duplicate material, status/reason/date/restore history, retained experiment reference, foreign keys, authentication, no automatic stock deduction, shipping without stock, multi-bottle receipt and retry idempotence');
