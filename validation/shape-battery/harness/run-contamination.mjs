// harness/run-contamination.mjs — ../CONTAMINATION-PREREG.md.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE=path.dirname(fileURLToPath(import.meta.url)); const STUDY=path.dirname(HERE);
const ENGINE_ROOT=path.resolve(STUDY,'..','..');
const sk=require(path.join(ENGINE_ROOT,'dist','detectors','shape-kurtosis-e-value.js'));
const DS=path.resolve(ENGINE_ROOT,'..','deploysignal');
const mcd=require(path.join(DS,'tools','calibrators','_family-c-mcd.js'));
const cov=require(path.join(DS,'tools','calibrators','_family-c-covariance.js'));
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const MODE=arg('--mode','sim'),N=Number(arg('--n',1000)),T=Number(arg('--t',900));
const P=11,SD=0.05,RHO=0.3,ALPHA=0.05,W=30,SEED=20260805,BASE_N=600;
const EPS=[0,0.05,0.10,0.20], SHAPES=['shift','scatter'];
const sigT=()=>{const S=[];for(let i=0;i<P;i++){S.push([]);for(let j=0;j<P;j++)S[i].push(SD*SD*Math.pow(RHO,Math.abs(i-j)));}return S;};
function chol(A){const n=A.length,L=Array.from({length:n},()=>new Array(n).fill(0));
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=A[i][j];for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];
 L[i][j]=i===j?Math.sqrt(Math.max(s,1e-18)):s/L[j][j];}return L;}
function mul(s0){let s=s0>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);
 t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function gf(r){let sp=null;return()=>{if(sp!==null){const v=sp;sp=null;return v;}
 const u1=Math.max(r(),1e-300),u2=r();const rr=Math.sqrt(-2*Math.log(u1)),th=2*Math.PI*u2;sp=rr*Math.sin(th);return rr*Math.cos(th);};}
const L=chol(sigT());
const MA=0.9,MS=Math.sqrt(1-0.81);
function draw(law,r,g){const u=new Array(P);
 for(let k=0;k<P;k++)u[k]= law==='mix'?((r()<0.5?-1:1)*MA+MS*g()):g();
 const z=new Array(P);for(let i=0;i<P;i++){let s=0;for(let j=0;j<=i;j++)s+=L[i][j]*u[j];z[i]=s;}return z;}
function baseline(eps,shape,seed){
  const r=mul(seed),g=gf(r),rows=[],nOut=Math.round(BASE_N*eps);
  for(let i=0;i<BASE_N;i++){const z=draw('gauss',r,g);
    if(i<nOut){ if(shape==='shift') for(let k=0;k<P;k++) z[k]+=4*SD; else for(let k=0;k<P;k++) z[k]*=3; }
    rows.push(z);}
  return rows;}
const sigmaOf=(rows)=>{const mu=new Array(P).fill(0);for(const z of rows)for(let i=0;i<P;i++)mu[i]+=z[i]/rows.length;
 const s=new Array(P).fill(0);for(const z of rows)for(let i=0;i<P;i++)s[i]+=(z[i]-mu[i])**2/(rows.length-1);
 return s.map(Math.sqrt);};
function trimmed(rows){
  const Z=cov.relativeDeviations(rows,cov.columnMean(rows));
  const m=mcd.fastMCD(Z,mcd.FASTMCD_DEFAULT_ALPHA,mcd.FASTMCD_DEFAULT_SEED,mcd.computeLWWarmSeed(Z));
  if(!m) return rows;
  const rw=mcd.mcdReweight(Z,m.mean,m.cov);
  return rw?rw.kept.map(i=>rows[i]):rows;}
function summarise(xs){const n=xs.length,m=xs.reduce((a,b)=>a+b,0)/n;
 const v=n>1?xs.reduce((a,b)=>a+(b-m)**2,0)/(n-1):0,se=Math.sqrt(v/n);
 return{n,mean:m,se,lower95_one_sided:m-1.645*se,upper95_one_sided:m+1.645*se};}
function runArm(scores,sigma,faultAt){
  const per=[],maxM=[];const params={kind:'shape_kurtosis_e_value',window:W,scores,sigma};
  for(let i=0;i<N;i++){
    const r=mul(SEED+i*7919),g=gf(r);const st=sk.freshShapeKurtosisState();const es=[];let mx=1;
    for(let t=0;t<T;t++){
      const law=(faultAt!==null&&t>=faultAt)?'mix':'gauss';
      const b=st.M; sk.evaluateShapeKurtosisEValue({params,alpha:ALPHA},draw(law,r,g),st);
      if(st.M!==b)es.push(st.M/b); if(st.M>mx)mx=st.M;}
    if(es.length)per.push(es.reduce((x,y)=>x+y,0)/es.length); maxM.push(mx);}
  return{inc:summarise(per),rate:maxM.filter(v=>v>=1/ALPHA).length/maxM.length};}
const cells=[];const t0=Date.now();
console.log('shape    eps    variant   false-alarm   power    calK_med  (cleanK~3)');
for(const shape of SHAPES){
  for(const eps of EPS){
    if(eps===0&&shape==='scatter')continue;
    const rows=baseline(eps,shape,SEED+11);
    const variants={E:rows,T:trimmed(rows)};
    for(const [vid,vr] of Object.entries(variants)){
      const sigma=sigmaOf(vr);
      const scores=sk.buildShapeKurtosisCalibrationEmpirical(vr,W,sigma,1);
      if(!scores.length)continue;
      const fa=runArm(scores,sigma,null), pw=runArm(scores,sigma,300);
      const med=scores[Math.floor(scores.length/2)];
      cells.push({shape:eps===0?'none':shape,eps,variant:vid,kept:vr.length,
        false_alarm:fa.rate,fa_increment:fa.inc,power:pw.rate,cal_median_K:med});
      console.log(`${(eps===0?'none':shape).padEnd(8)} ${eps.toFixed(2)}   ${vid}         ${fa.rate.toFixed(4)}      ${pw.rate.toFixed(4)}   ${med.toFixed(3)}`);
    }
  }
}
const gitSha=execSync('git rev-parse HEAD',{cwd:ENGINE_ROOT}).toString().trim();
const out=path.join(STUDY,'results',MODE==='live'?'live':'sim',`cont-${new Date().toISOString().replace(/[-:.]/g,'').slice(0,15)}Z`);
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'summary.json'),`${JSON.stringify({cells},null,1)}\n`);
fs.writeFileSync(path.join(out,'manifest.json'),`${JSON.stringify({study:'shape-contamination',
 prereg:'../CONTAMINATION-PREREG.md',seed:SEED,n:N,ticks:T,window:W,alpha:ALPHA,eps:EPS,shapes:SHAPES,
 git_sha:gitSha,mode:MODE,elapsed_s:(Date.now()-t0)/1000},null,1)}\n`);
console.log(`\nwrote ${out}`);
