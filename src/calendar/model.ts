import {isMaterialDate} from '../material-dates';
export const categories=['Paper Critic','세미나','수업','연구실 회의','학회','실험 및 연구','외근 및 출장','휴가 및 부재','기타'] as const;
export const colors=['#155FB4','#7652A3','#207C70','#AD6A16','#984B81','#416E9E','#7B643B','#596675','#69778A'];
export type Visibility='lab'|'public'|'private';
export type Rule={frequency:'none'|'daily'|'weekly'|'monthly';interval:number;weekdays:number[];monthly:'date'|'nth';ordinal:number;weekday:number;end:'never'|'until'|'count';until:string;count:number};
export type EventInput={title:string;category:string;visibility:Visibility;startDate:string;endDate:string;startTime:string;endTime:string;allDay:boolean;location:string;description:string;organizer:string;presenter:string;participants:string[];everyone:boolean;rule:Rule;classScheduleId?:string;semesterName?:string;semesterStart?:string;publicClassTitle?:boolean};
export type LabEvent=EventInput&{id:string;ownerUserId:string;createdByUserId:string;revision:number;createdAt:string;updatedAt:string;exceptions:Record<string,{cancelled?:boolean;patch?:Partial<EventInput>}>};
export type Member={id:string;name:string;email?:string;role:'admin'|'member';canCreateLab:boolean;approved:boolean};
export type Occurrence={key:string;eventId:string;date:string;endDate:string;event:LabEvent};
export const dayNumber=(date:string)=>Math.floor(Date.parse(date+'T00:00:00Z')/86400000);
export const addDays=(date:string,n:number)=>new Date((dayNumber(date)+n)*86400000).toISOString().slice(0,10);
export const weekday=(date:string)=>new Date(date+'T00:00:00Z').getUTCDay();
export const todayKST=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
export function emptyRule():Rule{return {frequency:'none',interval:1,weekdays:[],monthly:'date',ordinal:1,weekday:5,end:'never',until:'',count:12}}
export function blankEvent(date=todayKST()):EventInput{return {title:'',category:'기타',visibility:'public',startDate:date,endDate:date,startTime:'09:00',endTime:'10:00',allDay:false,location:'',description:'',organizer:'',presenter:'',participants:[],everyone:true,rule:emptyRule()}}
export function typeDefaults(category:string):Partial<EventInput>{return {category,visibility:category==='수업'?'public':category==='기타'?'public':'lab',rule:{...emptyRule(),frequency:category==='수업'||category==='Paper Critic'?'weekly':'none',interval:category==='Paper Critic'?2:1}}}
export function validateEvent(e:EventInput):string {
 if(!e.title?.trim()||e.title.length>200)return '일정 제목은 1~200자로 입력해주세요.';
 if(!categories.includes(e.category as typeof categories[number])||!['lab','public','private'].includes(e.visibility))return '일정 유형과 공개 범위를 확인해주세요.';
 if(!isMaterialDate(e.startDate)||!isMaterialDate(e.endDate)||e.startDate<'2000-01-01'||e.endDate>'2100-12-31'||e.endDate<e.startDate||dayNumber(e.endDate)-dayNumber(e.startDate)>31)return '날짜 범위를 확인해주세요. 한 일정은 최대 31일입니다.';
 if(!e.allDay&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.endTime)||(e.endDate===e.startDate&&e.endTime<=e.startTime)))return '종료 시간은 시작 시간 이후여야 합니다.';
 if(!e.rule||!['none','daily','weekly','monthly'].includes(e.rule.frequency)||!Number.isInteger(e.rule.interval)||e.rule.interval<1||e.rule.interval>52)return '반복 간격은 1~52로 입력해주세요.';
 if(!Array.isArray(e.rule.weekdays)||e.rule.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))return '반복 요일을 확인해주세요.';
 if(!['date','nth'].includes(e.rule.monthly)||!Number.isInteger(e.rule.ordinal)||e.rule.ordinal<1||e.rule.ordinal>5||!Number.isInteger(e.rule.weekday)||e.rule.weekday<0||e.rule.weekday>6)return '월간 반복 설정을 확인해주세요.';
 if(!['never','until','count'].includes(e.rule.end))return '반복 종료 조건을 확인해주세요.';
 if(e.rule.end==='until'&&(!isMaterialDate(e.rule.until)||e.rule.until<e.startDate||e.rule.until>'2100-12-31'))return '반복 종료일을 확인해주세요.';
 if(e.rule.end==='count'&&(!Number.isInteger(e.rule.count)||e.rule.count<1||e.rule.count>10000))return '반복 횟수는 1~10000입니다.';
 if(!Array.isArray(e.participants)||e.participants.length>200)return '참여자를 확인해주세요.';
 if([e.location,e.description,e.organizer,e.presenter].some(x=>typeof x!=='string'||x.length>5000))return '입력 내용이 너무 깁니다.';
 return '';
}
function matches(e:EventInput,date:string){
 const r=e.rule,delta=dayNumber(date)-dayNumber(e.startDate);if(delta<0)return false;
 if(r.frequency==='none')return delta===0;
 if(r.frequency==='daily')return delta%r.interval===0;
 if(r.frequency==='weekly'){const days=r.weekdays.length?r.weekdays:[weekday(e.startDate)];const base=dayNumber(e.startDate)-weekday(e.startDate);return Math.floor((dayNumber(date)-base)/7)%r.interval===0&&days.includes(weekday(date))}
 const months=(Number(date.slice(0,4))-Number(e.startDate.slice(0,4)))*12+Number(date.slice(5,7))-Number(e.startDate.slice(5,7));
 return months%r.interval===0&&(r.monthly==='date'?date.slice(8)===e.startDate.slice(8):weekday(date)===r.weekday&&Math.ceil(Number(date.slice(8))/7)===r.ordinal);
}
export function occurrenceDates(e:EventInput,to:string){
 const dates:string[]=[];const end=e.rule.end==='until'&&e.rule.until<to?e.rule.until:to;
 for(let date=e.startDate;date<=end;date=addDays(date,1)){
  if(matches(e,date)){dates.push(date);if(e.rule.frequency==='none'||e.rule.end==='count'&&dates.length>=e.rule.count)break}
 }
 return dates;
}
export function expandEvents(events:LabEvent[],from:string,to:string):Occurrence[]{
 const out:Occurrence[]=[];
 for(const original of events){const span=dayNumber(original.endDate)-dayNumber(original.startDate);
  for(const date of occurrenceDates(original,to)){
   const exception=original.exceptions?.[date];if(exception?.cancelled)continue;
   const base={...original,startDate:date,endDate:addDays(date,span)};
   const event={...base,...exception?.patch};const endDate=event.endDate;
   if(event.startDate<=to&&endDate>=from)out.push({key:original.id+':'+date,eventId:original.id,date,endDate,event});
  }
  // Overrides can move an occurrence into this range from outside the normal range.
  for(const [date,ex] of Object.entries(original.exceptions||{})){if(date<=to||ex.cancelled||!ex.patch?.startDate)continue;const event={...original,startDate:date,endDate:addDays(date,span),...ex.patch};if(event.startDate<=to&&event.endDate>=from)out.push({key:original.id+':'+date,eventId:original.id,date,endDate:event.endDate,event})}
 }
 return out.sort((a,b)=>(a.event.startDate+a.event.startTime).localeCompare(b.event.startDate+b.event.startTime));
}
export function onDay(o:Occurrence,date:string){return o.event.startDate<=date&&o.endDate>=date}
export function canEdit(e:LabEvent,m:Member){return e.visibility==='lab'?(e.createdByUserId===m.id||m.role==='admin'):e.ownerUserId===m.id}
export function colorFor(category:string){return colors[Math.max(0,categories.indexOf(category as typeof categories[number]))]}
export function calendarRange(date:string,view:'month'|'week'|'day'){
 if(view==='day')return {from:date,to:date};if(view==='week'){const from=addDays(date,-weekday(date));return {from,to:addDays(from,6)}}
 const first=date.slice(0,7)+'-01';const from=addDays(first,-weekday(first));const d=new Date(first+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);const last=addDays(d.toISOString().slice(0,10),-1);return {from,to:addDays(last,6-weekday(last))};
}
export function eventTimestamps(e:EventInput){return {startAt:e.startDate+'T'+(e.allDay?'00:00':e.startTime)+':00+09:00',endAt:e.allDay?addDays(e.endDate,1)+'T00:00:00+09:00':e.endDate+'T'+e.endTime+':00+09:00'}}
