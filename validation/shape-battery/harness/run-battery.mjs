// harness/run-battery.mjs — N1-N7 for the shape-kurtosis detector.
// Design fixed by ../PREREGISTRATION.md.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE); const ENGINE_ROOT = path.resolve(STUDY, '..', '..');
const sk = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'shape-kurtosis-e-value.js'));
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const MODE=arg('--mode','sim'), N=Number(arg('--n',1000)), T=Number(arg('--t',900));
const P=11, SD=0.05, RHO=0.3, ALPHA=0.05, W=30, SEED=20260805;

const sigmaTrue=()=>{const S=[];for(let i=0;i<P;i++){S.push([]);for(let j=0;j<P;j++)S[i].push(SD*SD*Math.pow(RHO,Math.abs(i-j)));}return S;};
function chol(A){const n=A.length,L=Array.from({length:n},()=>new Array(n).fill(0));
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=A[i][j];for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];
 L[i][j]=i===j?Math.sqrt(Math.max(s,1e-18)):s/L[j][j];}return L;}
function mul(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);
 t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function gf(r){let sp=null;return()=>{if(sp!==null){const v=sp;sp=null;return v;}
 const u1=Math.max(r(),1e-300),u2=r();const rr=Math.sqrt(-2*Math.log(u1)),th=2*Math.PI*u2;sp=rr*Math.sin(th);return rr*Math.cos(th);};}
const LT=chol(sigmaTrue());
// moment-matched unit-variance draws per law
function unit(law,r,g,prev,phi){
  if(law==='gauss') return g();
  if(law==='ar1') return phi*prev+Math.sqrt(1-phi*phi)*g();
  if(law==='logn'){const s=Math.sqrt(Math.log(2));const x=Math.exp(s*g()-s*s/2);return (x-1)/Math.sqrt(Math.exp(s*s)-1);}
  if(law==='t3'){const z=g();const c=g()**2+g()**2+g()**2;return (z/Math.sqrt(c/3))/Math.sqrt(3);}
  return g();
}
function makeDraw(law,r,g,phi){const prev=new Array(P).fill(0);
  return()=>{const u=new Array(P);
    for(let k=0;k<P;k++){u[k]=unit(law,r,g,prev[k],phi);prev[k]=u[k];}
    const z=new Array(P);for(let i=0;i<P;i++){let s=0;for(let j=0;j<=i;j++)s+=LT[i][j]*u[j];z[i]=s;}return z;};}
function estCholFrom(law,m,seed,phi){
  const r=mul(seed),g=gf(r),d=makeDraw(law,r,g,phi);const rows=[];
  for(let i=0;i<m;i++)rows.push(d());
  const mu=new Array(P).fill(0);for(const z of rows)for(let i=0;i<P;i++)mu[i]+=z[i]/m;
  const S=Array.from({length:P},()=>new Array(P).fill(0));
  for(const z of rows)for(let i=0;i<P;i++)for(let j=0;j<P;j++)S[i][j]+=(z[i]-mu[i])*(z[j]-mu[j])/(m-1);
  return chol(S);
}
/** Empirical calibration: K over windows of the ACTUAL law's baseline. */
function empiricalCal(law,m,seed,phi,sigma){
  const r=mul(seed),g=gf(r),d=makeDraw(law,r,g,phi);const scores=[];
  for(let q=0;q<4000;q++){const win=[];for(let t=0;t<W;t++)win.push(d());
    const k=sk.shapeKurtosisScore(win,sigma); if(k!==null) scores.push(k);}
  scores.sort((a,b)=>a-b); return scores;
}
function summarise(xs){const n=xs.length,m=xs.reduce((a,b)=>a+b,0)/n;
 const v=n>1?xs.reduce((a,b)=>a+(b-m)**2,0)/(n-1):0,se=Math.sqrt(v/n);
 return{n,mean:m,se,lower95_one_sided:m-1.645*se,upper95_one_sided:m+1.645*se};}

const ARMS=[
 {id:'N1',law:'gauss',cal:'oracle',phi:0},
 {id:'N2-m30',law:'gauss',cal:'est',m:30,phi:0},
 {id:'N2-m100',law:'gauss',cal:'est',m:100,phi:0},
 {id:'N2-m500',law:'gauss',cal:'est',m:500,phi:0},
 {id:'N3-p06',law:'ar1',cal:'oracle',phi:0.6},
 {id:'N3-p09',law:'ar1',cal:'oracle',phi:0.9},
 {id:'N4-p06',law:'ar1',cal:'est',m:100,phi:0.6},
 {id:'N4-p09',law:'ar1',cal:'est',m:100,phi:0.9},
 {id:'N5-gaussCal',law:'logn',cal:'est',m:100,phi:0},
 {id:'N5-empiricalCal',law:'logn',cal:'emp',m:100,phi:0},
 {id:'N6-gaussCal',law:'t3',cal:'est',m:100,phi:0},
 {id:'N6-empiricalCal',law:'t3',cal:'emp',m:100,phi:0},
 {id:'N3-p06-empCal',law:'ar1',cal:'emp',m:100,phi:0.6},
 {id:'N3-p09-empCal',law:'ar1',cal:'emp',m:100,phi:0.9},
 {id:'N4-p09-empCal',law:'ar1',cal:'emp',m:100,phi:0.9},
 {id:'N7-rolling',law:'gauss',cal:'est',m:100,phi:0,rolling:true},
];
const cells=[]; const t0=Date.now();
for(const a of ARMS){
  const L = a.cal==='oracle'?LT:estCholFrom(a.law,a.m,SEED+555,a.phi);
  const base = sk.buildShapeKurtosisCalibration(L,W,4000,mul(12345));
  const scores = a.cal==='emp' ? empiricalCal(a.law,a.m,SEED+777,a.phi,base.sigma) : base.scores;
  const params={kind:'shape_kurtosis_e_value',window:W,scores,sigma:base.sigma};
  const per=[],maxM=[];
  for(let i=0;i<N;i++){
    const r=mul(SEED+i*7919+a.id.length),g=gf(r),d=makeDraw(a.law,r,g,a.phi);
    const st=sk.freshShapeKurtosisState();const es=[];let mx=1;
    for(let t=0;t<T;t++){
      const before=st.M;
      if(a.rolling){ st.sinceEval=params.window-1; }   // force per-tick evaluation
      sk.evaluateShapeKurtosisEValue({params,alpha:ALPHA},d(),st);
      if(st.M!==before)es.push(st.M/before);
      if(st.M>mx)mx=st.M;
    }
    if(es.length)per.push(es.reduce((x,y)=>x+y,0)/es.length);
    maxM.push(mx);
  }
  const inc=summarise(per);const fires=maxM.filter(v=>v>=1/ALPHA).length;
  const rec={arm:a.id,law:a.law,calibration:a.cal,m:a.m??null,phi:a.phi,window:W,
    n:per.length,ticks:T,alpha:ALPHA,increment_estimator:inc,crossing_rate:fires/maxM.length,
    verdict:inc.lower95_one_sided>1?'REFUTED':inc.upper95_one_sided<1.0005?'CLEARED':'inconclusive'};
  cells.push(rec);
  process.stderr.write(`${a.id.padEnd(18)} inc=${inc.mean.toFixed(6)} [${inc.lower95_one_sided.toFixed(6)}] `
   +`${rec.verdict.padEnd(12)} cross=${rec.crossing_rate.toFixed(4)} (${((Date.now()-t0)/1000).toFixed(0)}s)\n`);
}
const gitSha=execSync('git rev-parse HEAD',{cwd:ENGINE_ROOT}).toString().trim();
const outDir=path.join(STUDY,'results',MODE==='live'?'live':'sim',`bat-${new Date().toISOString().replace(/[-:.]/g,'').slice(0,15)}Z`);
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'summary.json'),`${JSON.stringify({cells},null,1)}\n`);
fs.writeFileSync(path.join(outDir,'manifest.json'),`${JSON.stringify({study:'shape-battery',
 prereg:'../PREREGISTRATION.md',node:process.version,seed:SEED,n:N,ticks:T,window:W,alpha:ALPHA,
 git_sha:gitSha,mode:MODE,elapsed_s:(Date.now()-t0)/1000},null,1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
