/** Date-only values: no Date constructor, UTC conversion, or normalization of invalid days. */
export function isDateOnly(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number);if(year<1||year>9999||month<1||month>12)return false;
 const leap=year%4===0&&(year%100!==0||year%400===0);return day>=1&&day<=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
}
/** Only unambiguous complete legacy formats are normalized. Unknown values remain untouched by callers. */
export function parseDateOnly(value:unknown):string|null{
 if(typeof value!=='string')return null;const text=value.trim();let parts:string[]|undefined;
 if(/^\d{8}$/.test(text))parts=[text.slice(0,4),text.slice(4,6),text.slice(6,8)];
 else{const match=text.match(/^(\d{4})\s*([./-])\s*(\d{1,2})\s*\2\s*(\d{1,2})$/);if(match)parts=[match[1],match[3].padStart(2,'0'),match[4].padStart(2,'0')];}
 const iso=parts?.join('-');return isDateOnly(iso)?iso:null;
}
export function displayDateOnly(value:string){return parseDateOnly(value)?.replaceAll('-','.')??value}
export function formatDateDigits(digits:string){const value=digits.replace(/\D/g,'').slice(0,8);return value.slice(0,4)+(value.length>4?'.'+value.slice(4,6):'')+(value.length>6?'.'+value.slice(6,8):'')}
export function dateInputValue(text:string){const digits=text.replace(/\D/g,'').slice(0,8);const iso=digits.length===8?digits.slice(0,4)+'-'+digits.slice(4,6)+'-'+digits.slice(6,8):null;return {text:formatDateDigits(digits),iso:isDateOnly(iso)?iso:null,digits}}
export function dateInputError(text:string,required=false,min?:string,max?:string){if(!text.trim())return required?'날짜를 입력해주세요.':'';const date=text.replace(/\D/g,'').length===8?parseDateOnly(text):null;if(!date)return '올바른 날짜를 YYYY.MM.DD 형식으로 입력해주세요.';const lower=parseDateOnly(min),upper=parseDateOnly(max);if(lower&&date<lower)return `${displayDateOnly(lower)} 이후 날짜를 입력해주세요.`;if(upper&&date>upper)return `${displayDateOnly(upper)} 이전 날짜를 입력해주세요.`;return ''}
function caretAfterDigits(text:string,count:number){if(count<=0)return 0;let digits=0;for(let i=0;i<text.length;i++){if(/\d/.test(text[i]))digits++;if(digits===count)return i+1}return text.length}
export function editDateInput(raw:string,caret:number){const before=raw.slice(0,caret).replace(/\D/g,'').length;const value=dateInputValue(raw);return {...value,caret:caretAfterDigits(value.text,Math.min(before,8))}}
export function deleteDateDigit(text:string,start:number,end:number,direction:'backward'|'forward'){
 const digits=text.replace(/\D/g,'').slice(0,8);const before=text.slice(0,start).replace(/\D/g,'').length,selected=text.slice(start,end).replace(/\D/g,'').length;let from=before,to=before+selected;if(start===end){if(direction==='backward')from=Math.max(0,before-1);else to=Math.min(digits.length,before+1)}const next=digits.slice(0,from)+digits.slice(to);const formatted=formatDateDigits(next);return {...dateInputValue(next),caret:caretAfterDigits(formatted,from)};
}
/** Called at explicit write boundaries; never scans or rewrites existing records. */
export function dateOnlyForStorage(value:unknown,required=false){if((value===''||value===null||value===undefined)&&!required)return '';const iso=parseDateOnly(value);if(!iso)throw Error('날짜를 YYYY.MM.DD 형식의 실제 날짜로 입력해주세요.');return iso}
