import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const checked=spawnSync('node',['scripts/test-search.mjs'],{stdio:'inherit'});assert.equal(checked.status,0);
const require=createRequire(import.meta.url);
const {buildSearch,performSearch,emptySearch,createLocalSearchRepository,normalizeSearchKinds}=require('../work/test-search/research-search.js');
const material={id:'eddt',name:'EDDT',cas:'2251-66-9',lots:[
 {id:'legacy-lot',reagentId:'reagent-001',sourceKind:'purchased',name:'EDDT #001',internalCode:'EDDT-001',manufacturingLot:'manufacturer-lot-001',inventory:{lifecycle:'Completed',manufacturer:'TCI',productNumber:'E002',supplier:'Supplier A',purchased:'2026-10-01',received:'2026-10-02'}},
 {id:'reagent-002',reagentId:'reagent-002',sourceKind:'purchased',name:'EDDT #002',inventory:{lifecycle:'Active',manufacturer:'TCI',productNumber:'E003',supplier:'Supplier B',received:'2026-11-24'}},
 {id:'reagent-003',reagentId:'reagent-003',sourceKind:'purchased',name:'EDDT #003',inventory:{lifecycle:'Disposed'}},
 {id:'legacy-review',sourceKind:'legacy',reviewRequired:true,name:'old container',inventory:{lifecycle:'Archived'}},
 {id:'eddt:unregistered',name:'사용 시약 미등록'}]};
const row={id:'row1',materialId:'eddt',name:'EDDT',lotId:'legacy-lot',reagentId:'reagent-001',lot:'EDDT #001',component:'Thiol',role:'단량체',amount:'1',unit:'g',mw:122,density:null,functionality:2};
const original={
 'isnm-material-library-v1':[material,{id:'own',name:'PBB-TT',lots:[{id:'batch-material-1',sourceKind:'synthesized',name:'OLG-001',sourceExperimentId:'source1'}]}],
 'isnm-research-v1':{syntheses:[{id:'syn1',name:'Synthesis',projectId:'1',input:{rows:[row]},actualMaterials:{row1:{materialId:'eddt',reagentId:'reagent-002',lotId:'reagent-002',lot:'EDDT #002',name:'EDDT'}},actualAmounts:{row1:'0.9'}}],samples:[{id:'sample1',name:'Film',synthesisId:'syn1'}]},
 'isnm-oligomer-batches-v1':[{id:'olg1',name:'Prior synthesis',ingredients:[row]}]
};
const raw=JSON.stringify(original),storage={getItem:key=>original[key]===undefined?null:JSON.stringify(original[key])};
const index=buildSearch([],storage);const search=filters=>performSearch(index,{...structuredClone(emptySearch),...filters});
assert.deepEqual(search({kinds:['구매 시약'],query:'EDDT'}).map(r=>r.id),['reagent-002']);
assert.equal(search({kinds:['구매 시약'],query:'EDDT',archive:'all'}).length,3);
assert(search({kinds:['원료'],query:'EDDT'}).some(r=>r.id==='eddt'));
assert.equal(search({kinds:['구매 시약'],query:'E003'})[0].id,'reagent-002');
assert.equal(search({kinds:['구매 시약'],query:'Supplier B'})[0].id,'reagent-002');
assert.equal(search({kinds:['구매 시약'],query:'manufacturer-lot-001',archive:'all'})[0].id,'legacy-lot');
assert.equal(search({kinds:['자체 합성 원료']}).length,1);
assert.equal(search({kinds:['시약 검토 기록'],archive:'all'}).length,1);
assert(!index.results.some(r=>r.id==='eddt:unregistered'));
assert(search({query:'reagent-002',kinds:['합성 기록']}).some(r=>r.id==='syn1'));
assert(search({lot:'reagent-002',kinds:['샘플']}).some(r=>r.id==='sample1'));
assert(search({lot:'reagent-001',kinds:['올리고머 배치']}).some(r=>r.id==='olg1'));
assert(search({lot:'legacy-lot',kinds:['올리고머 배치']}).some(r=>r.id==='olg1'));
assert.equal(search({lot:'reagent-003',kinds:['합성 기록']}).length,0);
const synthesis=index.results.find(r=>r.id==='syn1');assert.equal(synthesis.rows[0].reagentId,'reagent-001');assert.equal(synthesis.actualRows[0].reagentId,'reagent-002');assert.equal(synthesis.rows[0].amount,'1');assert.equal(synthesis.actualRows[0].amount,'0.9');
const repository=createLocalSearchRepository([],storage);assert.equal((await repository.detail('원료 Lot:legacy-lot')).id,'legacy-lot');
assert((await repository.related('합성 기록:syn1')).some(r=>r.id==='legacy-lot'),'archived bottles remain visible in original experiment relationships');
assert.deepEqual(normalizeSearchKinds(['원료 Lot']),['구매 시약','자체 합성 원료','시약 검토 기록']);
assert.equal(JSON.stringify(original),raw,'search must not modify historical records');
console.log('PASS: reagent search identities, active/history filters, material discoverability, product/supplier/manufacturing metadata, planned vs actual references, sample traces, legacy filters/detail links, and read-only preservation');
