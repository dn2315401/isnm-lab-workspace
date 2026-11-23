import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
mkdirSync('work/calendar-tests',{recursive:true});
await build({entryPoints:['src/calendar/LabCalendar.tsx'],outfile:'work/calendar-tests/calendar-ui.mjs',bundle:true,platform:'node',format:'esm',plugins:[{
 name:'calendar-component-test',setup(b){
  b.onResolve({filter:/^react(\/jsx-runtime)?$/},args=>({path:args.path,namespace:'test-react'}));
  b.onLoad({filter:/.*/,namespace:'test-react'},args=>({contents:args.path==='react'?'export const useState=x=>[typeof x==="function"?x():x,()=>{}];export const useEffect=()=>{};export const useRef=()=>({current:null});':'export const Fragment="fragment";export const jsx=(type,props)=>({type,props});export const jsxs=jsx;'}));
  b.onResolve({filter:/^\.\/context$/},()=>({path:'calendar-context',namespace:'test-context'}));b.onLoad({filter:/.*/,namespace:'test-context'},()=>({contents:'export const useCalendar=()=>globalThis.calendarTestContext;'}));
  b.onResolve({filter:/^lucide-react$/},()=>({path:'icons',namespace:'test-icons'}));b.onLoad({filter:/.*/,namespace:'test-icons'},()=>({contents:'export const CalendarDays=()=>null;export const ChevronLeft=()=>null;export const ChevronRight=()=>null;export const Plus=()=>null;'}));
  b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'empty'}));
 }
}]});
const {default:Calendar}=await import('../work/calendar-tests/calendar-ui.mjs');
const {blankEvent}=await import('../work/calendar-tests/model.mjs');
const calls=[];const detail=[];const day='2026-12-15';const e={...blankEvent(day),id:'existing',ownerUserId:'me',createdByUserId:'me',revision:1,exceptions:{},title:'Existing event'};const occurrence={key:'existing:'+day,eventId:'existing',date:day,endDate:day,event:e};
globalThis.calendarTestContext={user:{id:'me',approved:true},ready:true,members:[{id:'me',name:'Test member'}],pending:[],events:[e],occurrences:[occurrence],date:day,setDate:()=>{},setDetail:o=>detail.push(o),openNewOnDate:(date,times)=>calls.push({date,times}),setClasses:()=>{},setManage:()=>{},reload:()=>{}};
function nodes(node,out=[]){if(node==null||typeof node!=='object')return out;if(Array.isArray(node)){node.forEach(n=>nodes(n,out));return out}if(typeof node.type==='function')return nodes(node.type(node.props),out);out.push(node);nodes(node.props?.children,out);return out}
const background={closest:()=>null},control={closest:()=>({})};
for(const compact of [true,false]){
 const tree=nodes(Calendar({compact}));const cell=tree.find(n=>n.props?.['data-calendar-date']===day);assert.ok(cell);let stopped=0;const before=calls.length;cell.props.onDoubleClick({target:background,stopPropagation:()=>stopped++});assert.equal(calls.length,before+1);assert.equal(calls.at(-1).date,day);assert.equal(stopped,1);
 const dateButton=cell.props.children[0];dateButton.props.onDoubleClick({stopPropagation:()=>stopped++});assert.equal(calls.length,before+2);assert.equal(calls.at(-1).date,day);
 const boundary=tree.find(n=>n.props?.['data-calendar-date']==='2027-01-01');assert.ok(boundary);boundary.props.onDoubleClick({target:background,stopPropagation:()=>{}});assert.equal(calls.at(-1).date,'2027-01-01');
 const count=calls.length;cell.props.onDoubleClick({target:control,stopPropagation:()=>{}});assert.equal(calls.length,count,'Controls must not bubble into background creation');
 const plus=tree.find(n=>n.props?.className==='lc-add');plus.props.onClick();assert.equal(calls.at(-1).date,day,'Plus uses same selected-date entry point');
 const event=tree.find(n=>n.props?.className?.split(' ').includes('lc-event'));if(event){const previous=calls.length;event.props.onClick({stopPropagation:()=>{}});assert.equal(detail.at(-1).key,occurrence.key);event.props.onDoubleClick({stopPropagation:()=>{}});assert.equal(calls.length,previous,'Existing event double click never opens a new draft')}
}
for(const timezone of ['Asia/Seoul','Pacific/Honolulu','America/Los_Angeles']){process.env.TZ=timezone;assert.equal(blankEvent('2027-01-01').startDate,'2027-01-01');assert.equal(blankEvent('2027-01-01').endDate,'2027-01-01')}
console.log('PASS: mini/full calendar actual JSX handlers, background/date/plus paths, event details and double-click exclusion, one handler per target, year/month boundaries, timezone-invariant dates');
