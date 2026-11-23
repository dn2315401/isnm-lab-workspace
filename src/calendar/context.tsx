import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {blankEvent,calendarRange,expandEvents,todayKST,type EventInput,type LabEvent,type Member,type Occurrence} from './model';
export async function calendarRequest(path:string,options:RequestInit={}){const response=await fetch('/api/calendar'+path,{...options,headers:{'Content-Type':'application/json',...options.headers},credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'일정 서버에 연결하지 못했습니다.');return data}
type Session={user:Member|null;members:Member[];pending:{id:string;name:string;email:string}[];invites:{email:string;can_create_lab:number}[]};
function useCalendarState(){
 const[session,setSession]=useState<Session>({user:null,members:[],pending:[],invites:[]});const[ready,setReady]=useState(false);const[error,setError]=useState('');const[date,setDate]=useState(todayKST());const[events,setEvents]=useState<LabEvent[]>([]);const[loading,setLoading]=useState(false);const[refresh,setRefresh]=useState(0);const[draft,setDraft]=useState<EventInput|null>(null);const[editing,setEditing]=useState<Occurrence|null>(null);const[editScope,setEditScope]=useState('all');const[detail,setDetail]=useState<Occurrence|null>(null);const[classes,setClasses]=useState<string|null>(null);const[manage,setManage]=useState(false);
 const range=calendarRange(date,'month');
 async function refreshSession(){try{setError('');setSession(await calendarRequest('/session'));setReady(true)}catch(e){setError((e as Error).message);setReady(true)}}
 useEffect(()=>{void refreshSession()},[]);
 useEffect(()=>{if(!session.user?.approved){setEvents([]);return}const controller=new AbortController();setLoading(true);calendarRequest('/events?from='+range.from+'&to='+range.to,{signal:controller.signal}).then(data=>{setEvents(data.events);setError('')}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[session.user?.id,session.user?.approved,range.from,range.to,refresh]);
 const occurrences=useMemo(()=>expandEvents(events,range.from,range.to),[events,range.from,range.to]);
 const reload=()=>setRefresh(n=>n+1);
 const openNewOnDate=(selectedDate:string,times:Partial<Pick<EventInput,'startTime'|'endTime'>>={})=>{if(!session.user?.approved||draft||detail||classes!==null||manage)return;setDate(selectedDate);openNew({...blankEvent(selectedDate),...times})};
 const openNew=(input:EventInput)=>{setEditing(null);setEditScope('all');setDetail(null);setDraft(input)};
 return {...session,ready,error,setError,date,setDate,events,occurrences,loading,reload,refreshSession,draft,setDraft,editing,setEditing,editScope,setEditScope,detail,setDetail,classes,setClasses,manage,setManage,openNew,openNewOnDate};
}
const CalendarContext=createContext<ReturnType<typeof useCalendarState>|null>(null);
export function CalendarProvider({children}:{children:ReactNode}){const state=useCalendarState();return <CalendarContext.Provider value={state}>{children}</CalendarContext.Provider>}
export function useCalendar(){const context=useContext(CalendarContext);if(!context)throw Error('CalendarProvider missing');return context}
