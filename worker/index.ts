import {materialApi} from './material-api';
import {calendarApi} from './calendar-api';
import {assets} from '../.sites-runtime/calendar-assets';
export default {async fetch(request:Request,env:any){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/materials/'))return materialApi(request,env);
 if(url.pathname.startsWith('/api/calendar/'))return calendarApi(request,env);
 if(url.pathname.startsWith('/api/'))return Response.json({error:'Not found'},{status:404});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const file=assets[url.pathname==='/'?'/index.html':url.pathname]??(!url.pathname.includes('.')?assets['/index.html']:null);
 if(!file)return new Response('Not found',{status:404});
 const headers={'Content-Type':file.type,'Cache-Control':url.pathname.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff'};
 return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(file.base64),(c:string)=>c.charCodeAt(0)),{headers});
}};
