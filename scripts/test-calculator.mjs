import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('work/test-build',{recursive:true});
writeFileSync('work/test-build/package.json',JSON.stringify({type:'commonjs'}));
for(const [cmd,args] of [['node',['node_modules/typescript/bin/tsc','src/calculator-model.ts','src/formulation-model.ts','--outDir','work/test-build','--target','ES2022','--module','commonjs','--skipLibCheck']],['node',['tests/calculator.test.cjs']]]){
 const run=spawnSync(cmd,args,{stdio:'inherit'});if(run.status!==0)process.exit(run.status??1);
}
