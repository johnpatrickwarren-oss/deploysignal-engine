import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R='/Users/johnwarren/concord/deploysignal-engine/dist/detectors/';
const ui=require(R+'universal-inference-e-value.js');
const st=require(R+'safe-t-e-value.js');
function mul(s0){let s=s0>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);
 t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function gf(r){let sp=null;return()=>{if(sp!==null){const v=sp;sp=null;return v;}
 const u1=Math.max(r(),1e-300),u2=r();const rr=Math.sqrt(-2*Math.log(u1)),th=2*Math.PI*u2;sp=rr*Math.sin(th);return rr*Math.cos(th);};}
const M=100, NT=100, N=2000, ALPHA=0.05;
console.log(' phi     UI exc@.05   UI power    safe-t exc@.05  safe-t power');
for(const phi of [0,0.3,0.6,0.8,0.9,0.95,0.99]){
  const ue=[],up=[],se=[],sp=[];
  for(let i=0;i<N;i++){
    const r=mul(4242+i*7919), g=gf(r);
    let prev=0; const sd=Math.sqrt(1-phi*phi);
    const vals=[]; for(let t=0;t<M+NT;t++){ prev=phi*prev+sd*g(); vals.push(prev); }
    const shifted=vals.map((v,j)=> j>=M ? v+3 : v);
    const cal={start:0,len:M}, tst={start:M,len:NT};
    try{ const e=ui.universalInferenceMeanShiftEValue(vals,cal,tst); if(Number.isFinite(e))ue.push(e);}catch(_){}
    try{ const e=ui.universalInferenceMeanShiftEValue(shifted,cal,tst); if(Number.isFinite(e))up.push(e);}catch(_){}
    try{ const e=st.safeTwoSampleTEValue(vals,cal,tst); if(Number.isFinite(e))se.push(e);}catch(_){}
    try{ const e=st.safeTwoSampleTEValue(shifted,cal,tst); if(Number.isFinite(e))sp.push(e);}catch(_){}
  }
  const rate=a=>a.length? a.filter(e=>e>=1/ALPHA).length/a.length : NaN;
  console.log(`${phi.toFixed(2)}    ${rate(ue).toFixed(4).padStart(9)}  ${rate(up).toFixed(4).padStart(9)}      ${rate(se).toFixed(4).padStart(9)}     ${rate(sp).toFixed(4)}`);
}
