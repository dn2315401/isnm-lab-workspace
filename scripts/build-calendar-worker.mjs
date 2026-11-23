import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
const assets={};const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.woff2':'font/woff2'};
function walk(dir){for(const file of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory()){if(!['server','.openai'].includes(file.name))walk(full)}else{const key='/'+path.relative('dist',full).split(path.sep).join('/');assets[key]={type:types[path.extname(full)]||'application/octet-stream',base64:fs.readFileSync(full).toString('base64')}}}}
walk('dist');fs.mkdirSync('.sites-runtime',{recursive:true});fs.writeFileSync('.sites-runtime/calendar-assets.ts','export const assets:Record<string,{type:string;base64:string}>='+JSON.stringify(assets));
await build({entryPoints:['worker/index.ts'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
fs.mkdirSync('dist/.openai',{recursive:true});fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
fs.writeFileSync('dist/server/wrangler.json',JSON.stringify({name:'isnm-lab-calendar',main:'index.js',compatibility_date:'2026-11-23',d1_databases:[{binding:'DB',database_name:'isnm-calendar',migrations_dir:'../../drizzle'}]},null,2));
console.log('Built calendar Worker with '+Object.keys(assets).length+' existing app assets.');
