import {canonicalReference,matchChemical,safeQuantity,snapshotOnly,type ExperimentInput,type MaterialAlias,type LotAlias,type UsageInput} from './model';
import type {InventoryMaterial} from '../material-inventory';
type StorageReader=Pick<Storage,'getItem'>;
export function buildMaterialRecords(storage:StorageReader,clientId:string,materials:InventoryMaterial[],aliases:MaterialAlias[],lotAliases:LotAlias[]):ExperimentInput[]{
 const read=(key:string,fallback:any)=>{try{return JSON.parse(storage.getItem(key)||'null')??fallback}catch{return fallback}};
 const out:ExperimentInput[]=[];
 function base(kind:ExperimentInput['kind'],source:any,localId=source.id):ExperimentInput{return {clientId,kind,localId:String(localId),name:source.name||source.input?.name||String(localId),projectIds:(source.projectIds||[source.projectId]).filter(Boolean).map(String),performedDate:source.performedDate||source.actualDate||'',snapshot:snapshotOnly(source),usages:[],links:[],unresolved:[]}}
 function addRow(record:ExperimentInput,row:any,key:string,planned:unknown,actual:unknown,unit:string,actualUnit=unit,role=row.role||'기타'){
  let resolution=canonicalReference(materials,aliases,lotAliases,{materialId:row.materialId||'',lotId:row.lotId||'',name:row.name||''});
  if(!resolution.ref){const match=matchChemical(materials,row.name||'');if(match.status==='linked'){resolution={ref:{materialId:match.material!.id,lotId:null}};if(row.lotId)record.unresolved.push({field:key+'.lot',text:row.lot||row.lotId,reason:'기존 Lot은 임의로 추정하지 않았습니다.'})}}
  if(!resolution.ref){record.unresolved.push({field:key,text:row.name||row.materialId||'',reason:resolution.reason||'원료 연결 검토 필요'});return}
  const ratio=['wt%','mol%','ratio','eq'].includes(actualUnit);record.usages.push({key,...resolution.ref,role,plannedAmount:safeQuantity(planned),plannedUnit:unit,actualAmount:ratio?null:safeQuantity(actual),actualUnit:ratio?'g':actualUnit,snapshot:snapshotOnly(row)});
 }
 for(const batch of read('isnm-oligomer-batches-v1',[])){
  if(batch.example||!batch.id)continue;const record=base('oligomer',batch);if(batch.recordType==='preliminary')record.performedDate='';const plannedOnly=batch.recordType==='preliminary'||['작성 중','합성 예정'].includes(batch.status);
  for(const row of batch.ingredients||[]){const physicalPlan=row.plannedAmount||(plannedOnly?row.amount:'');addRow(record,row,row.id,physicalPlan||row.plannedRatio?.amount||'',plannedOnly?'':row.amount,physicalPlan?row.unit:row.plannedRatio?.unit||row.unit,row.unit);if(physicalPlan&&row.plannedRatio?.amount)addRow(record,row,row.id+':ratio',row.plannedRatio.amount,'',row.plannedRatio.unit,row.unit)}
  const textFields=[['catalyst',batch.catalyst,batch.catalystAmount,batch.catalystUnit||'wt%','촉매'],['solvent',batch.solvent,'','g','용매'],...(batch.washSolutions||[batch.wash]).map((value:string,index:number)=>['wash.'+index,value,'','g','세척액'])];
  for(const [field,text,amount,unit,role] of textFields){if(!text)continue;const match=matchChemical(materials,text);if(match.status!=='linked'){record.unresolved.push({field,text,reason:match.status==='ambiguous'?'동일 이름 후보가 여러 개입니다.':'원료 DB 연결 필요'});continue}if(record.usages.some(u=>u.materialId===match.material!.id))continue;addRow(record,{materialId:match.material!.id,lotId:'',name:text,role},'legacy:'+field,plannedOnly||unit==='wt%'?amount:'',!plannedOnly&&unit!=='wt%'?amount:'',unit,unit,role)}
  out.push(record);
 }
 for(const form of read('isnm-formulations',[])){const record=base('formulation',form,form.id+':v'+form.version);for(const row of form.rows||[])addRow(record,row,row.id,row.amount,'',row.unit);if(form.synthesisId)record.links.push({kind:'synthesis',localId:form.synthesisId,relation:'합성 기록'});out.push(record)}
 const research=read('isnm-research-v1',{});
 for(const calculation of research.calculations||[]){if(calculation.input?.template)continue;const record=base('calculation',calculation);for(const [index,row] of (calculation.input?.rows||[]).entries()){if(row.enabled===false)continue;addRow(record,row,row.id,String(calculation.result?.results?.[index]?.mass??''),'','g')}if(calculation.formulationId)record.links.push({kind:'formulation',localId:calculation.formulationId+':v'+calculation.version,relation:'조성 버전'});out.push(record)}
 for(const synthesis of research.syntheses||[]){if(synthesis.input?.template)continue;const record=base('synthesis',synthesis);for(const [index,row] of (synthesis.input?.rows||[]).entries()){if(row.enabled===false)continue;const actual=synthesis.actualMaterials?.[row.id];addRow(record,row,row.id+':plan',String(synthesis.result?.results?.[index]?.mass??''),'','g');if(safeQuantity(synthesis.actualAmounts?.[row.id])!==null)addRow(record,{...row,...(actual||{})},row.id+':actual','',synthesis.actualAmounts[row.id],'g',actual?.unit||'g')}
  if(synthesis.calculationId)record.links.push({kind:'calculation',localId:synthesis.calculationId,relation:'계산 조건'});for(const id of synthesis.sampleIds||[])record.links.push({kind:'sample',localId:id,relation:'제작 샘플'});out.push(record)}
 for(const sample of research.samples||[]){const record=base('sample',sample);if(sample.synthesisId)record.links.push({kind:'synthesis',localId:sample.synthesisId,relation:'제작 합성'});for(const id of (sample.analysis||'').split(',').map((x:string)=>x.trim()).filter(Boolean))record.links.push({kind:'measurement',localId:id,relation:'분석 측정'});out.push(record)}
 for(const measurement of read('isnm-measurements-v1',[])){if(measurement.example)continue;const record=base('measurement',measurement);if(measurement.sampleId)record.links.push({kind:'sample',localId:measurement.sampleId,relation:'측정 샘플'});out.push(record)}
 for(const result of read('isnm-analysis-results-v1',[])){if(result.example)continue;const record=base('analysis',result);if(result.measurementId)record.links.push({kind:'measurement',localId:result.measurementId,relation:'원본 측정'});out.push(record)}
 return out;
}
