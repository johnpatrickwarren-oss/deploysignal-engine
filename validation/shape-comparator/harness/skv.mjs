import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R='/Users/johnwarren/concord/deploysignal-engine/dist/detectors/shape-kurtosis-e-value.js';
const sk = require(R);
const P=11, SD=0.05, RHO=0.3, ALPHA=0.05;
let W=120;
function sigmaTrue(){const S=[];for(let i=0;i<P;i++){S.push([]);for(let j=0;j<P;j++)S[i].push(SD*SD*Math.pow(RHO,Math.abs(i-j)));}return S;}
function chol(A){const n=A.length,L=Array.from({length:n},()=>new Array(n).fill(0));
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=A[i][j];for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];
 L[i][j]= i===j?Math.sqrt(Math.max(s,1e-18)):s/L[j][j];}return L;}
function mul(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);
 t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const L=chol(sigmaTrue());


function gaussFactory(r){let sp=null;return()=>{if(sp!==null){const v=sp;sp=null;return v;}
 const u1=Math.max(r(),1e-300),u2=r();const rr=Math.sqrt(-2*Math.log(u1)),th=2*Math.PI*u2;sp=rr*Math.sin(th);return rr*Math.cos(th);};}
const MA=0.9, MS=Math.sqrt(1-0.81);
function draw(law,r,g){const u=new Array(P);for(let k=0;k<P;k++)u[k]= law==='gauss'?g():((r()<0.5?-1:1)*MA+MS*g());
 const z=new Array(P);for(let i=0;i<P;i++){let s=0;for(let j=0;j<=i;j++)s+=L[i][j]*u[j];z[i]=s;}return z;}

function run(law,faultAt,scale){
  let fires=0; const N=1000, T=600;
  for(let i=0;i<N;i++){
    const r=mul(999+i*7919), g=gaussFactory(r);
    const st=sk.freshShapeKurtosisState();
    const pp={...params, sigma: params.sigma.map(s=>s*scale)};
    for(let t=0;t<T;t++){
      const lw = (faultAt!==null && t>=faultAt)?'mix':law;
      const v=sk.evaluateShapeKurtosisEValue({params:pp,alpha:ALPHA}, draw(lw,r,g), st);
      if(v.verdict==='fire'){fires++;break;}
    }
  }
  return fires/N;
}

console.log('  W   windows/600   false-alarm(healthy G)   power(fault@100)   k-invariance');
let params;
for (const w of [15,20,30,40,60,120]) {
  W=w;
  const cal=sk.buildShapeKurtosisCalibration(L,W,4000,mul(12345));
  params={kind:'shape_kurtosis_e_value',window:W,scores:cal.scores,sigma:cal.sigma};
  const fa=run('gauss',null,1.00), pw=run('gauss',100,1.00);
  const fa85=run('gauss',null,0.85), pw85=run('gauss',100,0.85);
  const inv=(fa===fa85&&pw===pw85)?'exact':'MOVED';
  console.log(`${String(w).padStart(3)}   ${String(Math.floor(600/w)).padStart(6)}        ${fa.toFixed(4).padStart(10)}          ${pw.toFixed(4).padStart(8)}        ${inv}`);
}
