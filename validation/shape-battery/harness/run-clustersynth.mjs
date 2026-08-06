// harness/run-clustersynth.mjs — ../CLUSTERSYNTH-PREREG.md
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE=path.dirname(fileURLToPath(import.meta.url)); const STUDY=path.dirname(HERE);
const ENGINE_ROOT=path.resolve(STUDY,'..','..');
const sk=require(path.join(ENGINE_ROOT,'dist','detectors','shape-kurtosis-e-value.js'));
const DS=path.resolve(ENGINE_ROOT,'..','deploysignal');
const mcdM=require(path.join(DS,'tools','calibrators','_family-c-mcd.js'));
const covM=require(path.join(DS,'tools','calibrators','_family-c-covariance.js'));
const CS=path.resolve(ENGINE_ROOT,'..','clustersynth','dist','index.js');
const cs=await import(CS);

const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const MODE=arg('--mode','sim');
const W=30, ALPHA=0.05, BASE=600, SHARDS=Number(arg('--shards',120));
const ARMS=[
 {id:'C1-healthy',           cfg:{faults:false}},
 {id:'C2-heavyTails-df5',    cfg:{faults:false, heavyTails:{df:5}}},
 {id:'C3-no-nonstationarity',cfg:{faults:false, nonstationarity:[]}},
];
const MA=0.9, MS=Math.sqrt(1-0.81);
function summarise(xs){const n=xs.length,m=xs.reduce((a,b)=>a+b,0)/n;
 const v=n>1?xs.reduce((a,b)=>a+(b-m)**2,0)/(n-1):0,se=Math.sqrt(v/n);
 return{n,mean:m,se,lower95_one_sided:m-1.645*se,upper95_one_sided:m+1.645*se};}
function trimmed(rows){
  const Z=covM.relativeDeviations(rows,covM.columnMean(rows));
  const m=mcdM.fastMCD(Z,mcdM.FASTMCD_DEFAULT_ALPHA,mcdM.FASTMCD_DEFAULT_SEED,mcdM.computeLWWarmSeed(Z));
  if(!m) return rows;
  const rw=mcdM.mcdReweight(Z,m.mean,m.cov);
  return rw&&rw.kept.length>=W*4?rw.kept.map(i=>rows[i]):rows;}
const sigmaOf=(rows)=>{const p=rows[0].length;const mu=new Array(p).fill(0);
 for(const z of rows)for(let i=0;i<p;i++)mu[i]+=z[i]/rows.length;
 const s=new Array(p).fill(0);for(const z of rows)for(let i=0;i<p;i++)s[i]+=(z[i]-mu[i])**2/(rows.length-1);
 return s.map(Math.sqrt);};

const cells=[]; const t0=Date.now();
console.log('arm                      shards  ticks  false-alarm   increment [lo]        verdict');
for(const arm of ARMS){
  const sc=cs.buildScenario({family:'gb200',pods:1,seed:7,window:{steps:1400,dt_s:30},...arm.cfg});
  const ids=sc.gpuIds.slice(0,SHARDS);
  const per=[],maxM=[]; let T=0;
  for(const gid of ids){
    const rec=cs.realizeShard(sc.seed,gid,sc.ctx,sc.graph,sc.applier,undefined,arm.cfg.heavyTails?.df);
    const names=Object.keys(rec); T=rec[names[0]].length;
    const rows=[]; for(let t=0;t<T;t++) rows.push(names.map(n=>rec[n][t]));
    if(rows.length<BASE+W*3) continue;
    const base=rows.slice(0,BASE), live=rows.slice(BASE);
    const tr=trimmed(base); const sigma=sigmaOf(tr);
    const scores=sk.buildShapeKurtosisCalibrationEmpirical(tr,W,sigma,1);
    if(!scores.length) continue;
    const params={kind:'shape_kurtosis_e_value',window:W,scores,sigma};
    const st=sk.freshShapeKurtosisState(); const es=[]; let mx=1;
    for(const z of live){ const b=st.M;
      sk.evaluateShapeKurtosisEValue({params,alpha:ALPHA},z,st);
      if(st.M!==b)es.push(st.M/b); if(st.M>mx)mx=st.M; }
    if(es.length)per.push(es.reduce((a,b)=>a+b,0)/es.length);
    maxM.push(mx);
  }
  const inc=summarise(per); const fa=maxM.filter(v=>v>=1/ALPHA).length/Math.max(maxM.length,1);
  const verdict=inc.lower95_one_sided>1?'REFUTED':inc.upper95_one_sided<1.0005?'CLEARED':'inconclusive';
  cells.push({arm:arm.id,shards:maxM.length,ticks:T,false_alarm:fa,increment_estimator:inc,verdict});
  console.log(`${arm.id.padEnd(24)} ${String(maxM.length).padStart(5)}  ${String(T).padStart(5)}  ${fa.toFixed(4).padStart(9)}   ${inc.mean.toFixed(6)} [${inc.lower95_one_sided.toFixed(6)}]  ${verdict}`);
}
const gitSha=execSync('git rev-parse HEAD',{cwd:ENGINE_ROOT}).toString().trim();
const out=path.join(STUDY,'results',MODE==='live'?'live':'sim',`cs-${new Date().toISOString().replace(/[-:.]/g,'').slice(0,15)}Z`);
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'summary.json'),`${JSON.stringify({cells},null,1)}\n`);
fs.writeFileSync(path.join(out,'manifest.json'),`${JSON.stringify({study:'shape-clustersynth',
 prereg:'../CLUSTERSYNTH-PREREG.md',window:W,alpha:ALPHA,baseline:BASE,shards:SHARDS,
 git_sha:gitSha,mode:MODE,elapsed_s:(Date.now()-t0)/1000},null,1)}\n`);
console.log(`\nwrote ${out}`);
