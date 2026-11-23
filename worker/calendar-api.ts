import {isMaterialDate} from '../src/material-dates';
import {blankEvent,canEdit,occurrenceDates,validateEvent,addDays,dayNumber,eventTimestamps,weekday,type EventInput,type LabEvent,type Member} from '../src/calendar/model';
type Env={DB:any;CALENDAR_OWNER_EMAIL?:string};
class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
function fail(code:number,message:string):never{throw new ApiError(code,message)}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
async function memberFor(request:Request,env:Env):Promise<Member|null>{
 const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();if(!id||!email)return null;
 let name=request.headers.get('oai-authenticated-user-full-name')||email;
 if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name)}catch{name=email}}
 const existing=await env.DB.prepare('SELECT * FROM calendar_members WHERE id=?').bind(id).first();
 if(!existing){const owner=!!env.CALENDAR_OWNER_EMAIL&&email===env.CALENDAR_OWNER_EMAIL.toLowerCase();const invite=await env.DB.prepare('SELECT * FROM calendar_invites WHERE email=?').bind(email).first();await env.DB.prepare('INSERT INTO calendar_members (id,email,name,role,approved,can_create_lab) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,email,name,owner?'admin':'member',owner||invite?1:0,owner||invite?.can_create_lab?1:0).run()}
 const row=await env.DB.prepare('SELECT * FROM calendar_members WHERE id=?').bind(id).first();
 return {id:row.id,email:row.email,name:row.name,role:row.role,approved:!!row.approved,canCreateLab:!!row.can_create_lab};
}
const readEvent=(row:any):LabEvent=>({...JSON.parse(row.payload),id:row.id,revision:row.revision});
function checkedInput(input:any):EventInput{
 const e:EventInput={...blankEvent(),...input};const problem=validateEvent(e);if(problem)fail(400,problem);
 return {title:e.title.trim(),category:e.category,visibility:e.visibility,startDate:e.startDate,endDate:e.endDate,startTime:e.startTime,endTime:e.endTime,allDay:!!e.allDay,location:e.location,description:e.description,organizer:e.organizer,presenter:e.presenter,participants:e.participants,everyone:!!e.everyone,rule:e.rule,...(typeof e.classScheduleId==='string'?{classScheduleId:e.classScheduleId}:{}),...(typeof e.semesterName==='string'?{semesterName:e.semesterName}:{}),...(typeof e.semesterStart==='string'?{semesterStart:e.semesterStart}:{}),publicClassTitle:!!e.publicClassTitle};
}
function safeEvent(e:LabEvent,user:Member):LabEvent{
 if(e.category==='수업'&&e.publicClassTitle&&e.ownerUserId!==user.id){return {...e,title:'수업',description:'',location:'',organizer:'',presenter:'',exceptions:Object.fromEntries(Object.entries(e.exceptions||{}).map(([date,ex])=>[date,{...ex,patch:ex.patch?{...ex.patch,title:'수업',description:'',location:'',organizer:'',presenter:''}:undefined}]))}}
 return e;
}
function authorizeInput(e:EventInput,user:Member){if(e.visibility==='lab'&&!user.canCreateLab&&user.role!=='admin')fail(403,'연구실 전체 일정 작성 권한이 없습니다. 관리자에게 요청해주세요.')}
function insertStatement(env:Env,event:LabEvent){return env.DB.prepare('INSERT INTO calendar_events (id,owner_id,created_by,visibility,start_date,end_date,payload,revision) VALUES (?,?,?,?,?,?,?,?)').bind(event.id,event.ownerUserId,event.createdByUserId,event.visibility,event.startDate,event.endDate,JSON.stringify({...event,...eventTimestamps(event)}),event.revision)}
function updateStatement(env:Env,event:LabEvent,revision:number){return env.DB.prepare('UPDATE calendar_events SET visibility=?, start_date=?, end_date=?, payload=?, revision=? WHERE id=? AND revision=?').bind(event.visibility,event.startDate,event.endDate,JSON.stringify({...event,...eventTimestamps(event)}),revision+1,event.id,revision)}
function makeEvent(input:EventInput,user:Member):LabEvent{const now=new Date().toISOString();return {...input,id:crypto.randomUUID(),ownerUserId:user.id,createdByUserId:user.id,revision:1,createdAt:now,updatedAt:now,exceptions:{}}}
export async function calendarApi(request:Request,env:Env):Promise<Response>{
 try{
  if(!env.DB)fail(503,'일정 저장소 연결을 준비 중입니다. 잠시 후 다시 시도해주세요.');
  const url=new URL(request.url),path=url.pathname.slice('/api/calendar'.length);
  if(!['GET','HEAD'].includes(request.method)){
   const origin=request.headers.get('origin');if(origin&&origin!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'다른 사이트의 저장 요청은 허용되지 않습니다.');
   if(!request.headers.get('content-type')?.includes('application/json'))fail(415,'JSON 요청이 필요합니다.');
  }
  const user=await memberFor(request,env);
  if(path==='/session'&&request.method==='GET'){
   if(!user)return json({user:null,members:[],pending:[],invites:[]});
   const rows=user.approved?(await env.DB.prepare('SELECT id,name,role,approved,can_create_lab FROM calendar_members WHERE approved=1').all()).results:[];
   const pending=user.role==='admin'?(await env.DB.prepare('SELECT id,name,email FROM calendar_members WHERE approved=0').all()).results:[];
   const invites=user.role==='admin'?(await env.DB.prepare('SELECT email,can_create_lab FROM calendar_invites').all()).results:[];
   return json({user,members:rows.map((r:any)=>({id:r.id,name:r.name,role:r.role,approved:!!r.approved,canCreateLab:!!r.can_create_lab})),pending,invites});
  }
  if(!user)fail(401,'로그인 후 연구실 캘린더를 사용할 수 있습니다.');if(!user.approved)fail(403,'연구실 구성원 승인 후 사용할 수 있습니다.');
  let body:any={};if(!['GET','HEAD'].includes(request.method)){const text=await request.text();if(text.length>160000)fail(413,'입력 내용이 너무 큽니다.');try{body=JSON.parse(text)}catch{fail(400,'입력 내용을 확인해주세요.')}}
  if(path==='/members'&&request.method==='POST'){
   if(user.role!=='admin')fail(403,'관리자만 구성원을 관리할 수 있습니다.');
   if(body.email){const email=String(body.email).trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'계정 이메일을 확인해주세요.');await env.DB.batch([env.DB.prepare('INSERT INTO calendar_invites (email,can_create_lab) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET can_create_lab=excluded.can_create_lab').bind(email,body.canCreateLab?1:0),env.DB.prepare("UPDATE calendar_members SET approved=1,can_create_lab=? WHERE email=? AND role!='admin'").bind(body.canCreateLab?1:0,email)]);return json({ok:true})}
   if(body.id){await env.DB.prepare("UPDATE calendar_members SET approved=1,can_create_lab=? WHERE id=? AND role!='admin'").bind(body.canCreateLab?1:0,body.id).run();return json({ok:true})}
   fail(400,'승인할 계정을 선택해주세요.');
  }
  if(path==='/events'&&request.method==='GET'){
   const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
   if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||dayNumber(to)-dayNumber(from)>93||to<from||from<'2000-01-01'||to>'2100-12-31')fail(400,'조회 날짜 범위를 확인해주세요.');
   const {results}=await env.DB.prepare("SELECT * FROM calendar_events WHERE visibility!='private' OR owner_id=? ORDER BY start_date LIMIT 1001").bind(user.id).all();if(results.length>1000)fail(400,'일정이 많습니다. 관리자에게 문의해주세요.');
   // Return only authorized rules. Instances are expanded for the visible range on the client.
   return json({events:results.map(readEvent).map((e:LabEvent)=>safeEvent(e,user))});
  }
  if(path==='/events'&&request.method==='POST'){
   const e=checkedInput(body.event);authorizeInput(e,user);
   const members=await env.DB.prepare('SELECT id FROM calendar_members WHERE approved=1').all();if(e.participants.some(id=>!members.results.some((m:any)=>m.id===id)))fail(400,'참여 대상자를 다시 선택해주세요.');
   const event=makeEvent(e,user);await insertStatement(env,event).run();return json({event},201);
  }
  if(path==='/classes'&&request.method==='POST'){
   const {semesterName,start,end,rows,groupId}=body;if(typeof semesterName!=='string'||!semesterName.trim()||!Array.isArray(rows)||!rows.length||rows.length>30)fail(400,'학기명과 수업을 입력해주세요.');
   if(!isMaterialDate(start)||!isMaterialDate(end)||end<start||dayNumber(end)-dayNumber(start)>366)fail(400,'학기 시작일과 종료일을 확인해주세요.');
   const group=groupId||crypto.randomUUID();const events:LabEvent[]=rows.map((r:any)=>{let first=start;for(let n=0;n<7&&weekday(first)!==Number(r.weekday);n++)first=addDays(first,1);const e=checkedInput({...blankEvent(first),title:r.title,category:'수업',visibility:'public',startDate:first,endDate:first,startTime:r.startTime,endTime:r.endTime,location:r.location||'',description:r.description||'',semesterName,semesterStart:start,classScheduleId:group,publicClassTitle:!!r.publicClassTitle,rule:{...blankEvent().rule,frequency:'weekly',weekdays:[Number(r.weekday)],end:'until',until:end}});return makeEvent(e,user)});
   for(let i=0;i<rows.length;i++)for(let j=0;j<i;j++)if(Number(rows[i].weekday)===Number(rows[j].weekday)&&rows[i].startTime<rows[j].endTime&&rows[i].endTime>rows[j].startTime)fail(409,'같은 요일의 수업 시간이 겹칩니다. 수정 후 저장해주세요.');
   const commands=[];if(groupId){const existing=(await env.DB.prepare('SELECT * FROM calendar_events WHERE owner_id=?').bind(user.id).all()).results.map(readEvent).filter((e:LabEvent)=>e.classScheduleId===groupId);if(!existing.length)fail(404,'원본 시간표를 찾을 수 없습니다.');for(const e of existing)commands.push(env.DB.prepare('DELETE FROM calendar_events WHERE id=? AND owner_id=?').bind(e.id,user.id))}
   commands.push(...events.map(e=>insertStatement(env,e)));await env.DB.batch(commands);return json({events},201);
  }
  const match=path.match(/^\/events\/([^/]+)$/);
  if(match&&['PATCH','DELETE'].includes(request.method)){
   const row=await env.DB.prepare('SELECT * FROM calendar_events WHERE id=?').bind(decodeURIComponent(match[1])).first();if(!row)fail(404,'일정을 찾을 수 없습니다.');const prior=readEvent(row);
   if(!canEdit(prior,user))fail(403,'본인의 일정만 수정할 수 있습니다.');if(body.revision!==prior.revision)fail(409,'다른 화면에서 수정되었습니다. 새로고침 후 다시 시도해주세요.');
   const scope=prior.rule.frequency==='none'?'all':body.scope;if(!['one','following','all'].includes(scope))fail(400,'반복 일정 수정 범위를 선택해주세요.');
   const date=body.occurrenceDate;if(scope!=='all'&&!occurrenceDates(prior,date||'').includes(date))fail(400,'해당 반복 일정을 찾을 수 없습니다.');
   if(request.method==='DELETE'&&scope==='all'){const r=await env.DB.prepare('DELETE FROM calendar_events WHERE id=? AND revision=?').bind(prior.id,prior.revision).run();if(!r.meta.changes)fail(409,'최신 기록을 다시 열어주세요.');return json({ok:true})}
   const next={...prior,exceptions:{...prior.exceptions},updatedAt:new Date().toISOString()};
   if(scope==='one'){
    if(request.method==='DELETE')next.exceptions[date]={cancelled:true};else{const edit=checkedInput(body.event);if(edit.visibility!==prior.visibility)fail(400,'공개 범위는 전체 반복 일정에서 변경해주세요.');next.exceptions[date]={patch:{title:edit.title,startDate:edit.startDate,endDate:edit.endDate,startTime:edit.startTime,endTime:edit.endTime,allDay:edit.allDay,location:edit.location,description:edit.description,presenter:edit.presenter,organizer:edit.organizer}}}
   }else if(scope==='following'){
    const remaining=prior.rule.end==='count'?prior.rule.count-occurrenceDates(prior,addDays(date,-1)).length:0;
    next.rule={...prior.rule,end:'until',until:addDays(date,-1)};
    if(date===prior.startDate){if(request.method==='DELETE'){await env.DB.prepare('DELETE FROM calendar_events WHERE id=? AND revision=?').bind(prior.id,prior.revision).run();return json({ok:true})}Object.assign(next,checkedInput(body.event));authorizeInput(next,user);next.exceptions={}}
    else if(request.method!=='DELETE'){const input=checkedInput(body.event);authorizeInput(input,user);if(prior.rule.end==='count'&&input.rule.end==='count')input.rule.count=Math.min(input.rule.count,remaining);const fresh={...makeEvent(input,user),ownerUserId:prior.ownerUserId,createdByUserId:prior.createdByUserId};Object.assign(next,{splitToken:fresh.id});const results=await env.DB.batch([updateStatement(env,next,prior.revision),env.DB.prepare('INSERT INTO calendar_events (id,owner_id,created_by,visibility,start_date,end_date,payload,revision) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM calendar_events WHERE id=? AND revision=? AND json_extract(payload,?)=?)').bind(fresh.id,fresh.ownerUserId,fresh.createdByUserId,fresh.visibility,fresh.startDate,fresh.endDate,JSON.stringify({...fresh,...eventTimestamps(fresh)}),fresh.revision,prior.id,prior.revision+1,'$.splitToken',fresh.id)]);if(!results[0].meta.changes)fail(409,'최신 기록을 다시 열어주세요.');return json({ok:true})}
   }else{const input=checkedInput(body.event);authorizeInput(input,user);Object.assign(next,input)}
   const result=await updateStatement(env,next,prior.revision).run();if(!result.meta.changes)fail(409,'최신 기록을 다시 열어주세요.');return json({ok:true});
  }
  fail(404,'요청한 기능을 찾을 수 없습니다.');
 }catch(error){return json({error:error instanceof ApiError?error.message:'일정을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'},error instanceof ApiError?error.status:500)}
}
