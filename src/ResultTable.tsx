import {MaterialLink} from './materials/shared';
import {useState} from 'react';
import type {Calculator, CalcResult} from './calculator-model';

const units = {
  mass: {mg:1000,g:1,kg:0.001}, wt:{'wt%':1,'질량분율':0.01},
  mw:{'g/mol':1,'kg/mol':0.001}, mol:{mmol:1000,mol:1,'µmol':1e6},
  fraction:{'mol%':1,'몰분율':0.01}, eq:{'mmol-eq':1000,eq:1},
  volume:{mL:1,L:0.001,'µL':1000}
};
type Key=keyof typeof units;
export function ResultTable({d,result}:{d:Calculator,result:CalcResult}){
  const [selected,setSelected]=useState<Record<string,string>>({});
  const [optional,setOptional]=useState({fraction:false,eq:false});
  const columns:{key:Key,title:string,values:(number|null|undefined)[],total?:number|null}[]=[];
  const rows=result.results;
  function add(key:Key,title:string,values:(number|null|undefined)[],total?:number|null){columns.push({key,title,values,total})}
  add('mass','기본 계산량',rows.map(r=>r.base),result.baseTotal);
  if(d.overshoot)add('mass','여분 포함 계량량',rows.map(r=>r.mass),result.actual);
  add('wt','질량 비율',rows.map(r=>r.wt),result.valid?100:null);
  add('mw','분자량',d.rows.map(r=>r.mw));
  add('mol','몰수',rows.map(r=>r.moles),result.totalMoles);
  if(optional.fraction)add('fraction','몰 비율',result.molPercent);
  if(optional.eq)add('eq','작용기 당량',rows.map(r=>r.equivalents));
  if(d.volume)add('volume','부피',rows.map(r=>r.volume),result.valid&&rows.every(r=>!r.included||r.volume!=null)?rows.reduce((sum,r)=>sum+(r.volume??0),0):null);
  function unit(key:Key){return selected[key]??Object.keys(units[key])[0]}
  function format(value:number|null|undefined,key:Key){
    if(value==null)return '—';
    return (value*(units[key] as Record<string,number>)[unit(key)]).toLocaleString('ko-KR',{maximumFractionDigits:d.precision,minimumFractionDigits:d.precision});
  }
  return <><div className="result-options">{(['fraction','eq'] as const).map(k=><label key={k}><input type="checkbox" checked={optional[k]} onChange={e=>setOptional({...optional,[k]:e.target.checked})}/>{k==='fraction'?'mol%':'작용기 당량'}</label>)}</div><div className="calc-input-scroll"><table className="calc-result-table"><thead><tr><th>원료명</th>{columns.map(c=><th key={c.title}>{c.title}<br/><select aria-label={c.title+' 표시 단위'} value={unit(c.key)} onChange={e=>setSelected({...selected,[c.key]:e.target.value})}>{Object.keys(units[c.key]).map(u=><option key={u}>{u}</option>)}</select></th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id}><td><MaterialLink materialId={d.rows[i].materialId} snapshotName={r.name}/>{!r.included&&<small>제외</small>}</td>{columns.map(c=><td key={c.title}>{r.included?format(c.values[i],c.key):'—'}</td>)}</tr>)}</tbody><tfoot><tr><td>합계</td>{columns.map(c=><td key={c.title}>{format(c.total,c.key)}</td>)}</tr></tfoot></table></div></>;
}
