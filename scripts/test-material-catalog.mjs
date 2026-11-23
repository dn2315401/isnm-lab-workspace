import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('work/test-material-catalog',{recursive:true});
writeFileSync('work/test-material-catalog/package.json',JSON.stringify({type:'commonjs'}));
for(const args of [ ['node_modules/typescript/bin/tsc','src/material-inventory.ts','src/formulation-model.ts','--outDir','work/test-material-catalog','--target','ES2022','--module','commonjs','--resolveJsonModule','--esModuleInterop','--skipLibCheck'],['tests/material-catalog.test.cjs']]){
 const run=spawnSync(process.execPath,args,{stdio:'inherit'});if(run.status!==0)process.exit(run.status??1);
}
