export const units=['mg','g','kg','µL','mL','L','mmol','mol'] as const;
export type Unit=typeof units[number];
export const components=['Oligomer','Reactive Monomer','Crosslinker','Initiator','Catalyst','Solvent','Additive','Stabilizer','Other'];
export const roles=['주 수지','올리고머','반응성 희석제','가교제','광개시제','열개시제','촉매','용매','첨가제','안정제','충전재','기타'];
export type FunctionalGroup={type:string;count:number};
export type Material={groups?:FunctionalGroup[];provenance?:string;id:string;name:string;component:string;role:string;mw:number|null;density:number|null;functionality:number|null;unit:Unit;lots:{id:string;name:string;stock:string;unit?:Unit;mw?:number|null;density?:number|null;groups?:FunctionalGroup[];provenance?:string}[]};
export type Row={groups?:FunctionalGroup[];provenance?:string;id:string;materialId:string;lotId:string;name:string;lot:string;component:string;role:string;amount:string;unit:Unit;mw:number|null;density:number|null;functionality:number|null};
export const library:Material[]=[
{id:'olg',name:'OLG-A-023',component:'Oligomer',role:'주 수지',mw:null,density:null,functionality:null,unit:'g',lots:[{id:'olg-2404',name:'OLG-A-023-2404',stock:'재고 미등록'},{id:'olg-2405',name:'OLG-A-023-2405',stock:'재고 미등록'}]},
{id:'rm82',name:'RM82',component:'Reactive Monomer',role:'반응성 희석제',mw:672.81,density:null,functionality:2,unit:'g',lots:[{id:'rm82-2404',name:'RM82-2404',stock:'재고 미등록'}]},
{id:'petmp',name:'PETMP',component:'Crosslinker',role:'가교제',mw:488.66,density:1.28,functionality:4,unit:'g',lots:[{id:'petmp-2403',name:'PETMP-2403',stock:'재고 미등록'}]},
{id:'tpo',name:'TPO',component:'Initiator',role:'광개시제',mw:348.37,density:null,functionality:null,unit:'g',lots:[{id:'tpo-2402',name:'TPO-2402',stock:'재고 미등록'}]},
{id:'thf',name:'THF',component:'Solvent',role:'용매',mw:72.11,density:0.889,functionality:null,unit:'g',lots:[{id:'thf-2406',name:'THF-2406',stock:'재고 미등록'}]},
{id:'additive',name:'Additive X',component:'Additive',role:'첨가제',mw:null,density:null,functionality:null,unit:'g',lots:[{id:'add-01',name:'ADD-01',stock:'재고 미등록'}]}
];
export function makeRow(m:Material,lotId=m.lots[0].id,amount='0'):Row{const lot=m.lots.find(x=>x.id===lotId)!;return {id:crypto.randomUUID(),materialId:m.id,lotId,name:m.name,lot:lot.name,component:m.component,role:m.role,amount,unit:lot.unit??m.unit,mw:lot.mw!==undefined?lot.mw:m.mw,density:lot.density!==undefined?lot.density:m.density,functionality:m.functionality,groups:lot.groups??m.groups,provenance:lot.provenance??m.provenance}}
const dim=(u:Unit)=>['mg','g','kg'].includes(u)?'mass':['µL','mL','L'].includes(u)?'volume':'moles';
const factor:Record<Unit,number>={mg:.001,g:1,kg:1000,'µL':.001,mL:1,L:1000,mmol:.001,mol:1};
const valid=(n:number|null):n is number=>n!==null&&Number.isFinite(n)&&n>0;
export function quantities(r:Row){const n=r.amount.trim()===''?NaN:Number(r.amount);if(!Number.isFinite(n)||n<0)return {mass:null,moles:null,error:'0 이상의 투입량을 입력하세요.'};const a=n*factor[r.unit];let mass:number|null=null,moles:number|null=null;
if(dim(r.unit)==='mass'){mass=a;moles=a===0?0:valid(r.mw)?a/r.mw:null}
if(dim(r.unit)==='volume'){mass=a===0?0:valid(r.density)?a*r.density:null;moles=mass===0?0:mass!==null&&valid(r.mw)?mass/r.mw:null}
if(dim(r.unit)==='moles'){moles=a;mass=a===0?0:valid(r.mw)?a*r.mw:null}
if(mass!==null&&!Number.isFinite(mass)||moles!==null&&!Number.isFinite(moles))return {mass:null,moles:null,error:'계산 가능한 수치 범위를 초과했습니다.'};
return {mass,moles,error:null};}
export function convert(r:Row,to:Unit):{amount?:string;error?:string}{if(r.unit===to)return {amount:r.amount};const n=Number(r.amount);if(!r.amount.trim()||!Number.isFinite(n)||n<0)return {error:'먼저 유효한 투입량을 입력하세요.'};let value:number|null=null;
if(dim(r.unit)===dim(to))value=n*factor[r.unit]/factor[to];else{const q=quantities(r);if(dim(to)==='mass')value=q.mass===null?null:q.mass/factor[to];if(dim(to)==='moles')value=q.moles===null?null:q.moles/factor[to];if(dim(to)==='volume')value=q.mass!==null&&valid(r.density)?q.mass/r.density/factor[to]:null}
return value!==null&&Number.isFinite(value)?{amount:String(Number(value.toPrecision(14)))}:{error:'단위 환산에 필요한 분자량 또는 밀도를 원료 상세에서 입력하세요.'};}
export function calculate(rows:Row[],basis:'all'|'solids'='all'){const values=rows.map(quantities);const included=rows.map(r=>basis==='all'||(r.component!=='Solvent'&&r.role!=='용매'));const massComplete=values.every((v,i)=>!included[i]||v.mass!==null);const molComplete=values.every((v,i)=>!included[i]||v.moles!==null);const mass=massComplete?values.reduce((s,v,i)=>s+(included[i]?v.mass??0:0),0):null;const moles=molComplete?values.reduce((s,v,i)=>s+(included[i]?v.moles??0:0),0):null;return {values,mass,moles,percent:values.map((v,i)=>({wt:included[i]&&mass!==null&&mass>0&&v.mass!==null?v.mass/mass*100:null,mol:included[i]&&moles!==null&&moles>0&&v.moles!==null?v.moles/moles*100:null,included:included[i]}))};}
export type Saved={id:string;version:number;name:string;rows:Row[];basis:'all'|'solids';molMode:'molecular';projectId:string;sampleIds:string[];synthesisId:string;analysisRefs:string[];savedAt:string};

