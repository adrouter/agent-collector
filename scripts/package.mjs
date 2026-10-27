import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('..',import.meta.url);
mkdirSync(new URL('artifacts/',root),{recursive:true});
execFileSync('npm',['pack','--pack-destination','artifacts'],{cwd:root,stdio:'inherit'});
// Python's zipfile is portable, including on native Windows.
execFileSync('python',['-m','zipfile','-c','artifacts/adrouter-hermes-0.1.0.zip','hermes/adrouter_collector','contracts','hermes/requirements.txt'],{cwd:root,stdio:'inherit'});
const files=['adrouter-agent-collector-0.1.0.tgz','adrouter-hermes-0.1.0.zip'];
writeFileSync(new URL('artifacts/SHA256SUMS',root),files.map(f=>`${createHash('sha256').update(readFileSync(new URL('artifacts/'+f,root))).digest('hex')}  ${f}\n`).join(''));
