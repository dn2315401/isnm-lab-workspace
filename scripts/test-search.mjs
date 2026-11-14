import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('work/test-search',{recursive:true});
writeFileSync('work/test-search/package.json',JSON.stringify({type:'commonjs'}));
for(const [cmd,args] of [['node',['node_modules/typescript/bin/tsc','src/research-search.ts','src/search-dates.ts','src/search-records.ts','src/search-comparison.ts','src/search-http.ts','src/formulation-model.ts','--outDir','work/test-search','--target','ES2022','--module','commonjs','--skipLibCheck']],['node',['tests/search.test.cjs']]]){
 const check=spawnSync(cmd,args,{stdio:'inherit'});if(check.status!==0)process.exit(check.status??1);
}
