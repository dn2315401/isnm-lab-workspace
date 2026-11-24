import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
mkdirSync('work/equipment-api-tests',{recursive:true});
await build({entryPoints:['worker/equipment-api.ts'],outfile:'work/equipment-api-tests/api.mjs',bundle:true,platform:'node',format:'esm'});
const {equipmentApi}=await import('../work/equipment-api-tests/api.mjs');
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const migration of ['0000_lab_calendar','0001_material_connections','0002_reagent_lifecycle','0003_equipment_documents'])db.exec(readFileSync('drizzle/'+migration+'.sql','utf8'));
db.exec("INSERT INTO calendar_members (id,email,name,role,approved,can_create_lab) VALUES ('owner','owner@example.test','Owner','admin',1,1)");
class P{constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...args){return new P(this.sql,args)}async first(){return db.prepare(this.sql).get(...this.args)||null}async all(){return {results:db.prepare(this.sql).all(...this.args)}}async run(){return {meta:{changes:Number(db.prepare(this.sql).run(...this.args).changes)}}}}
const env={DB:{prepare:sql=>new P(sql),batch:async commands=>{db.exec('BEGIN');try{const out=[];for(const c of commands)out.push(await c.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}},CALENDAR_OWNER_EMAIL:'owner@example.test'};
async function req(path,body,options={}){const {user='owner',origin='https://test.local',method=body?'POST':'GET'}=options;const headers={origin};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test'}if(body&&!(body instanceof FormData))headers['content-type']='application/json';return equipmentApi(new Request('https://test.local/api/equipment'+path,{method,headers,...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})}),env)}
async function parsed(path,body,options){const r=await req(path,body,options);return {status:r.status,data:await r.json()}}
const okay=r=>assert.equal(r.status,200,JSON.stringify(r.data));
function upload(name,bytes,extra={}){const f=new FormData();f.set('equipmentId','dp811a');f.set('kind','manual');for(const [key,value] of Object.entries(extra))f.set(key,value);f.set('file',new File([bytes],name));return f}
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal((await req('/files?equipmentId=dp811a',undefined,{user:null})).status,401);
assert.equal((await req('/files?equipmentId=dp811a',undefined,{user:'pending'})).status,403);
const pdf=new TextEncoder().encode('%PDF-1.7\nISNM LAB test manual\n%%EOF');
assert.equal((await req('/files',upload('manual.pdf',pdf),{origin:'https://evil.test'})).status,403);
assert.equal((await req('/files',upload('fake.pdf',new TextEncoder().encode('not a PDF')))).status,400);
assert.equal((await req('/files',upload('wrong.txt',pdf))).status,400);
assert.equal((await req('/files',upload('empty.pdf',new Uint8Array()))).status,413);
assert.equal((await req('/files',upload('big.pdf',new Uint8Array(8*1024*1024+1)))).status,413);
let stored=await parsed('/files',upload('manual.pdf',pdf));okay(stored);const pdfId=stored.data.file.id;assert.equal(stored.data.file.sha256,sha(pdf));
const duplicate=await parsed('/files',upload('same bytes renamed.pdf',pdf));okay(duplicate);assert.equal(duplicate.data.unchanged,true);assert.equal(duplicate.data.file.id,pdfId);
let list=await parsed('/files?equipmentId=dp811a');okay(list);assert.equal(list.data.files.length,1);assert.equal(list.data.files[0].id,pdfId);
let download=await req('/files/'+pdfId);assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/pdf');assert.match(download.headers.get('content-disposition'),/^inline;/);assert.equal(sha(new Uint8Array(await download.arrayBuffer())),sha(pdf));
download=await req('/files/'+pdfId+'?download=1');assert.match(download.headers.get('content-disposition'),/^attachment;/);assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.equal(download.headers.get('cache-control'),'private,no-store');
assert.equal((await req('/files/no-such-file')).status,404);
const pptHeader=Uint8Array.from([208,207,17,224,161,177,26,225,0,1,2,3]);okay(await parsed('/files',upload('legacy.ppt',pptHeader)));
assert.equal((await req('/files',upload('invalid.pptx',new TextEncoder().encode('PK empty archive')))).status,400);
// The attached original is served byte-for-byte, rather than regenerated from slide text.
const manualPath='public/manuals/dc-supply-manual.pptx';const manual=readFileSync(manualPath);assert.equal(sha(manual),'7cd345c2c0318b1bc54c7dd76f4036ef48b54ea14bbe0f388a0af12f7998a1e5','Original uploaded PPTX checksum');
const staticManual=await parsed('/files',upload('DC supply manual.pptx',manual,{preview:JSON.stringify(JSON.parse(readFileSync('public/manuals/dc-supply-manual.json','utf8')))}));okay(staticManual);assert.equal(staticManual.data.file.sha256,sha(manual));assert.equal(staticManual.data.file.preview.slides.length,30);download=await req('/files/'+staticManual.data.file.id+'?download=1');assert.equal(sha(new Uint8Array(await download.arrayBuffer())),sha(manual));
assert.equal(db.prepare('SELECT COUNT(*) n FROM equipment_experiment_records').get().n,0,'Manual/booking UI cannot fabricate actual experiment records');
const record={equipmentId:'dp811a',date:'2026-11-24',outputRange:'range1',actualVoltage:'20',actualCurrent:'10',durationSeconds:'5',temperature:'80',observations:'Measured on test sample'};
assert.equal((await req('/experiments',{...record,date:'2026-99-99'})).status,400);
const experiment=await parsed('/experiments',record);okay(experiment);const recordId=experiment.data.id;
let experiments=await parsed('/experiments?equipmentId=dp811a');okay(experiments);assert.equal(experiments.data.records.length,1);assert.equal(experiments.data.records[0].actualVoltage,'20');assert.equal(experiments.data.records[0].temperature,'80');assert.equal(experiments.data.records[0].ownerId,'owner');
assert.equal((await req('/experiments',{...record,actualVoltage:'40',actualCurrent:'10'})).status,400,'40V/10A is outside either supported range');
assert.equal((await req('/experiments',{...record,actualVoltage:'20',durationSeconds:'-1'})).status,400);
assert.equal((await req('/experiments',{...record,temperature:'-274'})).status,400);
assert.equal((await req('/files',upload('result.csv',new TextEncoder().encode('seconds,temperature\n5,80'),{kind:'experiment',recordId:'missing'}))).status,400);
assert.equal((await req('/files',upload('result.csv',new TextEncoder().encode('seconds,temperature\n5,80'),{equipmentId:'different',kind:'experiment',recordId}))).status,400);
const csv=new TextEncoder().encode('seconds,temperature\n5,80');const resultFile=await parsed('/files',upload('result.csv',csv,{kind:'experiment',recordId}));okay(resultFile);assert.equal(resultFile.data.file.recordId,recordId);download=await req(resultFile.data.file.url.replace('/api/equipment',''));assert.equal(sha(new Uint8Array(await download.arrayBuffer())),sha(csv));assert.match(download.headers.get('content-disposition'),/^attachment;/);
const image=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);okay(await parsed('/files',upload('result.png',image,{kind:'experiment',recordId})));
assert.equal((await req('/files',upload('fake.png',pdf,{kind:'experiment',recordId}))).status,400);
// Multipart chunk storage must preserve bytes well beyond the chunk boundary.
const large=new Uint8Array(350000);large.set(pdf);for(let i=pdf.length;i<large.length;i++)large[i]=i%251;const chunked=await parsed('/files',upload('large.pdf',large));okay(chunked);assert.ok(db.prepare('SELECT chunk_count FROM equipment_documents WHERE id=?').get(chunked.data.file.id).chunk_count>1);download=await req('/files/'+chunked.data.file.id);assert.equal(sha(new Uint8Array(await download.arrayBuffer())),sha(large));
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
console.log('PASS: authenticated equipment files, CSRF/format/size validation, exact original PPTX bytes, duplicate upload idempotence, byte-exact PDF/PPT/PPTX/CSV and chunk downloads, stored actual experiment settings/range validation, linked same-equipment result files, no fabricated actual records');
