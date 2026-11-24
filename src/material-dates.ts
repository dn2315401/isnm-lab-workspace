import {isDateOnly,dateInputValue,displayDateOnly} from './date-only';
export const isMaterialDate=isDateOnly;
/** Compatibility helper; partial/invalid return values are editing text, never a stored date. */
export function materialDateInput(text:string){const result=dateInputValue(text);return result.iso||result.digits}
export const materialDateDisplay=displayDateOnly;
