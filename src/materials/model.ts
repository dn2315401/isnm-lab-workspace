import type {Material,Row,Unit} from '../formulation-model';
import type {InventoryMaterial,InventoryLot} from '../material-inventory';
export type MaterialReference={materialId:string;lotId:string|null};
export type MaterialSelection=MaterialReference&{material:InventoryMaterial;lot:InventoryLot|null};
export type MaterialAlias={localId:string;materialId:string};
export type LotAlias={localMaterialId:string;localLotId:string;materialId:string;lotId:string|null};
export type UsageInput={key:string;materialId:string;lotId:string|null;role:string;plannedAmount:string|null;plannedUnit:string;actualAmount:string|null;actualUnit:string;snapshot:unknown};
export type ExperimentInput={clientId:string;kind:'oligomer'|'formulation'|'calculation'|'synthesis'|'sample'|'measurement'|'analysis';localId:string;name:string;projectIds:string[];performedDate:string;snapshot:unknown;usages:UsageInput[];links:{kind:string;localId:string;relation:string}[];unresolved:{field:string;text:string;reason:string}[]};
export function normalizeChemical(value:string){return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ')}
export function unregisteredLot(lot:Pick<InventoryLot,'id'|'name'>|undefined|null){return !lot||lot.name==='Lot 미등록'||lot.id.endsWith('-unregistered')||lot.id.endsWith(':unregistered')}
export function materialPlaceholder(materialId:string):InventoryLot{return {id:materialId+':unregistered',name:'Lot 미등록',stock:'재고 미등록',example:false}}
export function usableMaterial(material:InventoryMaterial):InventoryMaterial{return {...material,lots:[...material.lots.filter(l=>!unregisteredLot(l)),materialPlaceholder(material.id)]}}
export function matchChemical(materials:InventoryMaterial[],text:string,cas=''):{status:'linked'|'ambiguous'|'missing';material?:InventoryMaterial;candidates:InventoryMaterial[]}{
 const query=normalizeChemical(text),matches=materials.filter(m=>cas?!!m.cas&&normalizeChemical(m.cas)===normalizeChemical(cas):[m.id,m.name,m.chemicalName].some(v=>v&&normalizeChemical(v)===query));
 return matches.length===1?{status:'linked',material:matches[0],candidates:matches}:{status:matches.length?'ambiguous':'missing',candidates:matches};
}
export function selectionRow(selection:MaterialSelection,amount=''):Row{
 const m=selection.material,l=selection.lot;return {id:crypto.randomUUID(),materialId:m.id,lotId:l?.id||'',name:m.name,lot:l?.name||'Lot 미등록',component:m.component,role:m.role,amount,unit:l?.unit||m.unit||'g',mw:l?.mw!==undefined?l.mw:m.mw,density:l?.density!==undefined?l.density:m.density,functionality:m.functionality,groups:l?.groups??m.groups,provenance:l?.provenance??m.provenance};
}
export function searchMaterials(materials:InventoryMaterial[],query:string){const term=normalizeChemical(query);return materials.filter(m=>[m.name,m.chemicalName,m.cas,m.id,m.component,...m.lots.flatMap(l=>[l.id,l.name,l.inventory?.manufacturer])].some(v=>v&&normalizeChemical(v).includes(term)))}
export function safeQuantity(value:unknown):string|null{return typeof value==='string'&&value.trim()&&Number.isFinite(Number(value))&&Number(value)>=0?value.trim():null}
export function snapshotOnly(value:unknown):unknown{if(Array.isArray(value))return value.map(snapshotOnly);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='data').map(([key,v])=>[key,snapshotOnly(v)]));return value}
export function canonicalReference(materials:InventoryMaterial[],aliases:MaterialAlias[],lotAliases:LotAlias[],row:Pick<Row,'materialId'|'lotId'|'name'>):{ref?:MaterialReference;reason?:string}{
 const mapped=aliases.find(a=>a.localId===row.materialId)?.materialId;const material=materials.find(m=>m.id===(mapped||row.materialId));
 if(!material)return {reason:'원료 ID 연결 검토 필요'};
 const lotAlias=lotAliases.find(a=>a.localMaterialId===row.materialId&&a.localLotId===row.lotId);
 const lotId=lotAlias?.lotId??(row.lotId&&material.lots.some(l=>l.id===row.lotId&&!unregisteredLot(l))?row.lotId:null);
 if(row.lotId&&!lotAlias&&!material.lots.some(l=>l.id===row.lotId)&&!row.lotId.endsWith(':unregistered')&&!row.lotId.endsWith('-unregistered'))return {reason:'기록의 Lot ID를 확인해주세요.'};
 return {ref:{materialId:material.id,lotId}};
}
export const usageUnits:readonly string[]=['mg','g','kg','µL','mL','L','mmol','mol','wt%','mol%','eq','ratio'];
export const validUsageUnit=(unit:string)=>usageUnits.includes(unit);
