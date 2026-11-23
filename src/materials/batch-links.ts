import type {BatchDraft,Ingredient} from '../oligomer-batches';
import {selectionRow,type MaterialSelection} from './model';
export type BatchMaterialTarget='ingredient'|'catalyst'|'solvent'|`wash:${number}`;
export function bindBatchMaterial(batch:BatchDraft,selection:MaterialSelection,target:BatchMaterialTarget):BatchDraft{
 const role=target==='catalyst'?'촉매':target==='solvent'?'용매':target.startsWith('wash:')?'세척액':selection.material.role;
 const designated=target==='catalyst'?batch.catalystUsageId:target==='solvent'?batch.solventUsageId:target.startsWith('wash:')?batch.washUsageIds?.[Number(target.slice(5))]:undefined;
 const reserved=new Set([batch.catalystUsageId,batch.solventUsageId,...(batch.washUsageIds||[])]);
 const same=target==='ingredient'?[]:batch.ingredients.filter(row=>row.materialId===selection.materialId&&!reserved.has(row.id)&&(row.role===role||row.role==='기타'));
 const current=batch.ingredients.find(row=>row.id===designated)||(same.length===1?same[0]:undefined);
 const row:Ingredient={...selectionRow(selection),...(current?{id:current.id,amount:current.amount,plannedAmount:current.plannedAmount}:{}),role};
 const next={...batch,ingredients:current?batch.ingredients.map(r=>r.id===current.id?row:r):[...batch.ingredients,row]};
 if(target==='catalyst'){next.catalystUsageId=row.id;next.catalyst=selection.material.name;const unit=batch.catalystUnit||'wt%';if(unit==='wt%'){row.amount='';row.plannedRatio={amount:batch.catalystAmount,unit:'wt%'}}else{row.unit=unit;row.amount=batch.catalystAmount}}
 if(target==='solvent'){next.solventUsageId=row.id;next.solvent=selection.material.name}
 if(target.startsWith('wash:')){const index=Number(target.slice(5));next.washSolutions=[...(batch.washSolutions||[batch.wash])];next.washSolutions[index]=selection.material.name;next.wash=next.washSolutions.filter(Boolean).join(' / ');next.washUsageIds=[...(batch.washUsageIds||[])];next.washUsageIds[index]=row.id}
 return next;
}
export function synchronizeBatchLinks(next:BatchDraft,patch:Partial<BatchDraft>):BatchDraft{
 if('ingredients' in patch){if(next.solventUsageId){const r=next.ingredients.find(row=>row.id===next.solventUsageId);next={...next,solvent:r?.name||'',solventUsageId:r?.id}}const names=[...(next.washSolutions||[next.wash])],ids=[...(next.washUsageIds||[])];ids.forEach((id,index)=>{if(!id)return;const r=next.ingredients.find(row=>row.id===id);names[index]=r?.name||'';ids[index]=r?.id||''});next={...next,washSolutions:names,washUsageIds:ids,wash:names.filter(Boolean).join(' / ')}}
 const id=next.catalystUsageId;if(!id)return next;const row=next.ingredients.find(r=>r.id===id);if(!row)return {...next,catalystUsageId:undefined,catalyst:'',catalystAmount:''};
 if('catalystAmount' in patch||'catalystUnit' in patch){const unit=next.catalystUnit||'wt%';return {...next,ingredients:next.ingredients.map(r=>r.id!==id?r:unit==='wt%'?{...r,amount:'',plannedRatio:{amount:next.catalystAmount,unit:'wt%'}}:{...r,amount:next.catalystAmount,unit,plannedRatio:undefined})}}
 if('ingredients' in patch){if(row.role!=='촉매')return {...next,catalystUsageId:undefined,catalyst:'',catalystAmount:''};return {...next,catalyst:row.name,catalystAmount:row.plannedRatio?.amount??row.amount,catalystUnit:row.plannedRatio?'wt%':['mg','g','kg'].includes(row.unit)?row.unit as 'mg'|'g'|'kg':next.catalystUnit}}
 return next;
}
