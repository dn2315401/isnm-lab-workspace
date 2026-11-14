import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const [date,version]=process.argv.slice(2);
if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||Number.isNaN(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||!/^v[1-9]\d*$/.test(version||'')){
 console.error('사용법: npm run version:set -- YYYY-MM-DD v숫자');process.exit(1);
}
const path=new URL('../version.json',import.meta.url);const old=JSON.parse(readFileSync(path,'utf8'));
const next={...old,name:`ISNM LAB · ${date} · ${version}`,date,version,branch:`work/${date}-${version}`,tag:`${date}-${version}`};
try{next.basedOnCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}catch{}
writeFileSync(path,JSON.stringify(next,null,2)+'\n');
const htmlPath=new URL('../index.html',import.meta.url);const html=readFileSync(htmlPath,'utf8').replace(/<title>.*?<\/title>/,`<title>${next.name}</title>`);writeFileSync(htmlPath,html);
const readmePath=new URL('../README.md',import.meta.url);
const readme=readFileSync(readmePath,'utf8').replace(/^# ISNM LAB Workspace.*$/m,`# ISNM LAB Workspace · ${date} · ${version}`).replace(/작업 브랜치는 `work\/[^`]+`, 고정 태그는 `[^`]+`입니다\./,`작업 브랜치는 \`${next.branch}\`, 고정 태그는 \`${next.tag}\`입니다.`).replace(/git switch work\/[^\s]+/,`git switch ${next.branch}`);
writeFileSync(readmePath,readme);
console.log(next.name+' · '+next.branch);
