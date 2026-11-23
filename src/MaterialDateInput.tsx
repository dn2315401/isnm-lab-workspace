import {useRef,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {materialDateDisplay,materialDateInput} from './material-dates';
export default function MaterialDateInput({id,value,disabled,invalid,describedBy,onChange}:{id:string;value:string;disabled:boolean;invalid:boolean;describedBy?:string;onChange:(value:string)=>void}) {
 const [editing,setEditing]=useState(false);const picker=useRef<HTMLInputElement>(null);
 return <div className="mi-date-input"><input id={id} type="text" inputMode="numeric" autoComplete="off" placeholder="YYYY. MM. DD" value={editing?value.replace(/\D/g,''):materialDateDisplay(value)} disabled={disabled} aria-invalid={invalid} aria-describedby={describedBy} onFocus={()=>setEditing(true)} onBlur={()=>setEditing(false)} onChange={event=>onChange(materialDateInput(event.target.value))}/><button type="button" disabled={disabled} aria-label={(id.endsWith('opened')?'개봉일':'구매일')+' 달력 열기'} onClick={()=>{try{picker.current?.showPicker()}catch{picker.current?.focus()}}}><CalendarDays size={19}/></button><input ref={picker} className="mi-date-picker" type="date" aria-label={(id.endsWith('opened')?'개봉일':'구매일')+' 달력 선택'} tabIndex={-1} min="0001-01-01" max="9999-12-31" disabled={disabled} value={/^\d{4}-\d{2}-\d{2}$/.test(value)?value:''} onChange={event=>onChange(event.target.value)}/></div>;
}
