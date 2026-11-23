export function isMaterialDate(value: string) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const [year,month,day]=value.split('-').map(Number);
 if(year<1||month<1||month>12||day<1||day>31)return false;
 const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
export function materialDateInput(text:string) {
 const digits=text.replace(/\D/g,'').slice(0,8);
 return digits.length===8?digits.slice(0,4)+'-'+digits.slice(4,6)+'-'+digits.slice(6,8):digits;
}
export function materialDateDisplay(value:string) {
 return isMaterialDate(value)?value.replaceAll('-','. '):value;
}
