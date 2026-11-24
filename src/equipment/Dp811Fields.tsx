import {useId} from 'react';
import {powerRanges,powerSettingsError,type Booking} from '../equipment-bookings';
import './dp811.css';
export default function Dp811Fields({value,onChange}:{value:Partial<Booking>;onChange:(patch:Partial<Booking>)=>void}){
 const range=value.outputRange?powerRanges[value.outputRange]:undefined;
 const error=powerSettingsError({outputRange:value.outputRange,voltage:value.plannedVoltage,current:value.plannedCurrent});
 return <section className="dp811-fields" aria-label="DP811A 계획 출력 설정"><h3>계획 출력 설정 <small>선택 사항</small></h3><p>단일 채널 · 2개 Range · 최대 200 W. 실험 전 장비에서 실제 설정과 출력을 확인하세요.</p><div className="dp811-grid"><label>출력 Range<select value={value.outputRange||''} onChange={e=>onChange({outputRange:e.target.value as Booking['outputRange']||undefined})}><option value="">선택하지 않음</option>{Object.entries(powerRanges).map(([key,r])=><option key={key} value={key}>{r.label}</option>)}</select></label><label>계획 전압 (V)<input type="number" min="0" max={range?.voltage} step="any" inputMode="decimal" value={value.plannedVoltage||''} placeholder="미입력" onChange={e=>onChange({plannedVoltage:e.target.value})}/></label><label>계획 전류 (A)<input type="number" min="0" max={range?.current} step="any" inputMode="decimal" value={value.plannedCurrent||''} placeholder="미입력" onChange={e=>onChange({plannedCurrent:e.target.value})}/></label></div>{error&&<p className="dp811-error" role="alert">{error}</p>}</section>
}
export const dp811SafetyNotes = [
 '사용 전 출력 Range와 전압·전류 설정 확인',
 '전원 연결 및 케이블 연결 상태 확인',
 '출력 ON 상태에서 전극이나 도체 접촉 금지',
 '절연 보호구 사용 및 젖은 손으로 장비 조작 금지',
 '전열 구동 실험 시 IR 카메라로 온도 확인',
 '필름과 에나멜선의 국부 과열 주의',
 '실험 종료 후 출력 OFF 확인',
];
export function SafetyNotes(){const heading=useId();return <section className="dp811-safety" aria-labelledby={heading}><h3 id={heading}>사용 전 안전 확인</h3><ul>{dp811SafetyNotes.map(note=><li key={note}>{note}</li>)}</ul><p><strong>연구실 매뉴얼 기준</strong> · 「DC supply manual」 슬라이드 30은 IR 카메라로 온도를 항상 확인하고, 에나멜선의 피복이 약 100–200 °C에서 타며 유해물질이 발생할 수 있음을 경고합니다. 해당 실험에서는 110 °C 이내 사용을 안내합니다. 이 수치는 모든 재료·배선·실험 조건의 안전을 보장하는 온도는 아닙니다.</p></section>}
