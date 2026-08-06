import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sk = require('/Users/johnwarren/concord/deploysignal-engine/dist/detectors/shape-kurtosis-e-value.js');
const P=11, SD=0.05, RHO=0.3, ALPHA=0.05;
function sigmaTrue(){const S=[];for(let i=0;i<P;i++){S.push([]);for(let j=0;j<P;j++)S[i].push(SD*SD*Math.pow(RHO,Math.abs(i-j)));}return S;}
function chol(A){const n=A.length,L=Array.from({length:n},()=>new Array(n).fill(0));
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=A[i][j];for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];
 L[i][j]= i===j?Math.sqrt(Math.max(s,1e-18)):s/L[j][j];}return L;}
function mul(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);
 t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function gf(r){let sp=null;return()=>{if(sp!==null){const v=sp;sp=null;return v;}
 const u1=Math.max(r(),1e-300),u2=r();const rr=Math.sqrt(-2*Math.log(u1)),th=2*Math.PI*u2;sp=rr*Math.sin(th);return rr*Math.cos(th);};}
const L=chol(sigmaTrue());
function draw(r,g){const u=Array.from({length:P},()=>g());const z=new Array(P);
 for(let i=0;i<P;i++){let s=0;for(let j=0;j<=i;j++)s+=L[i][j]*u[j];z[i]=s;}return z;}
console.log(' W   cal-draws   E[e_t] (increment)      95% lower    verdict');
for (const [W,CAL] of [[30,4000],[30,40000],[60,4000],[60,40000]]) {
  const cal=sk.buildShapeKurtosisCalibration(L,W,CAL,mul(12345));
  const params={kind:'shape_kurtosis_e_value',window:W,scores:cal.scores,sigma:cal.sigma};
  const per=[];
  for(let i=0;i<2000;i++){
    const r=mul(50021+i*7919), g=gf(r);
    const st=sk.freshShapeKurtosisState(); const es=[];
    for(let t=0;t<1200;t++){
      const before=st.M;
      sk.evaluateShapeKurtosisEValue({params,alpha:ALPHA}, draw(r,g), st);
      if(st.M!==before) es.push(st.M/before);
    }
    if(es.length) per.push(es.reduce((a,b)=>a+b,0)/es.length);
  }
  const n=per.length, m=per.reduce((a,b)=>a+b,0)/n;
  const sd=Math.sqrt(per.reduce((a,b)=>a+(b-m)**2,0)/(n-1)), se=sd/Math.sqrt(n);
  const lo=m-1.645*se;
  console.log(`${String(W).padStart(2)}   ${String(CAL).padStart(7)}    ${m.toFixed(6)}          ${lo.toFixed(6)}    ${lo>1?'REFUTED':(m+1.645*se<1.0005?'CLEARED':'inconclusive')}`);
}
