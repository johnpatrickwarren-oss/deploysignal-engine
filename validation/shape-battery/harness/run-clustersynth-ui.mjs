// harness/run-clustersynth-ui.mjs — ../CLUSTERSYNTH-UI-PREREG.md
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE=path.dirname(fileURLToPath(import.meta.url)); const STUDY=path.dirname(HERE);
const ENGINE_ROOT=path.resolve(STUDY,'..','..');
const ui=require(path.join(ENGINE_ROOT,'dist','detectors','universal-inference-e-value.js'));
const sui=require(path.join(ENGINE_ROOT,'dist','detectors','sequential-ui.js'));
const cs=await import(path.resolve(ENGINE_ROOT,'..','clustersynth','dist','index.js'));
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const MODE=arg('--mode','sim'), SHARDS=Number(arg('--shards',120)), ALPHA=0.05;
const CAL=300, TEST=100;
const ARMS=[
 {id:'U1-healthy',            cfg:{faults:false}},
 {id:'U2-heavyTails-df5',     cfg:{faults:false, heavyTails:{df:5}}},
 {id:'U3-no-nonstationarity', cfg:{faults:false, nonstationarity:[]}},
];
function mean(a){return a.reduce((x,y)=>x+y,0)/a.length;}
const cells=[]; const t0=Date.now();
console.log('arm                      counter          UIexc  UIpow   sUIcross  sUIpow   sUI E[E_tau]  fails');
for(const arm of ARMS){
  const sc=cs.buildScenario({family:'gb200',pods:1,seed:7,window:{steps:1400,dt_s:30},...arm.cfg});
  const ids=sc.gpuIds.slice(0,SHARDS);
  const perCounter={};
  for(const gid of ids){
    const rec=cs.realizeShard(sc.seed,gid,sc.ctx,sc.graph,sc.applier,undefined,arm.cfg.heavyTails?.df);
    for(const [name,series] of Object.entries(rec)){
      perCounter[name] ??= {uiE:[], uiFail:0, suiTerm:[], suiCross:0, n:0,
                            uiPow:[], suiPowCross:0, nPow:0};
      const b=perCounter[name];
      // terminal UI: calibration prefix + test block
      const vals=series.slice(0,CAL+TEST);
      if(vals.length>=CAL+TEST){
        // Window objects, not integers -- a first version passed numbers, every
        // call threw, and the catch hid it as NaN. Failures are counted now.
        try{ const e=ui.universalInferenceMeanShiftEValue(
               vals,{start:0,len:CAL},{start:CAL,len:TEST});
             if(Number.isFinite(e)) b.uiE.push(e); else b.uiFail++; }catch(_){ b.uiFail++; }
      }
      // VACUOUS-PASS GUARD: same series with a +3 sd mean shift over the test
      // block. A detector that is 'not refuted' because it is inert must not be
      // reported as valid (h0-battery P2).
      const sd0=Math.sqrt(vals.reduce((a,v)=>a+(v-vals.reduce((x,y)=>x+y,0)/vals.length)**2,0)/Math.max(1,vals.length-1));
      const shifted=vals.map((v,i)=> i>=CAL ? v+3*sd0 : v);
      try{ const e=ui.universalInferenceMeanShiftEValue(
             shifted,{start:0,len:CAL},{start:CAL,len:TEST});
           if(Number.isFinite(e)) b.uiPow.push(e); }catch(_){}
      try{ const rp=sui.sequentialUiMeanShiftEProcess(
             series.map((v,i)=> i>=Math.floor(series.length/2) ? v+3*sd0 : v));
           const lp=rp.logE||[]; let mp=-Infinity;
           for(const v of lp) if(Number.isFinite(v)&&v>mp)mp=v;
           if(mp>=Math.log(1/ALPHA)) b.suiPowCross++; b.nPow++; }catch(_){}
      // e-process sequential UI over the whole series
      try{
        const r=sui.sequentialUiMeanShiftEProcess(series);
        const le=r.logE||[]; let mx=-Infinity, last=0;
        for(const v of le){ if(Number.isFinite(v)){ if(v>mx)mx=v; last=v; } }
        if(Number.isFinite(last)){ b.suiTerm.push(Math.exp(Math.min(last,700)));
          if(mx>=Math.log(1/ALPHA)) b.suiCross++; b.n++; }
      }catch(_){}
    }
  }
  for(const [name,b] of Object.entries(perCounter)){
    const exc=b.uiE.length? b.uiE.filter(e=>e>=1/ALPHA).length/b.uiE.length : NaN;
    const uiPow=b.uiPow.length? b.uiPow.filter(e=>e>=1/ALPHA).length/b.uiPow.length : NaN;
    const suiPow=b.nPow? b.suiPowCross/b.nPow : NaN;
    const um=b.uiE.length? mean(b.uiE):NaN;
    const cross=b.n? b.suiCross/b.n : NaN;
    const st=b.suiTerm.length? mean(b.suiTerm):NaN;
    cells.push({arm:arm.id,counter:name,ui_exceedance:exc,ui_mean_e:um,
      sui_crossing:cross,sui_stopped_mean:st,n_ui:b.uiE.length,n_sui:b.n,
      ui_fail_count:b.uiFail, ui_power:uiPow, sui_power:suiPow,
      ui_verdict: exc>ALPHA?'REFUTED':(uiPow<0.5?'not-refuted BUT INERT':'not-refuted'),
      sui_verdict: (cross>ALPHA||st>1)?'REFUTED':(suiPow<0.5?'not-refuted BUT INERT':'not-refuted')});
    console.log(`${arm.id.padEnd(24)} ${name.padEnd(16)} ${exc.toFixed(3)}  ${uiPow.toFixed(3)}   ${cross.toFixed(4)}    ${suiPow.toFixed(3)}   ${st.toExponential(2).padStart(10)}  ${b.uiFail}`);
  }
}
const gitSha=execSync('git rev-parse HEAD',{cwd:ENGINE_ROOT}).toString().trim();
const out=path.join(STUDY,'results',MODE==='live'?'live':'sim',`csui-${new Date().toISOString().replace(/[-:.]/g,'').slice(0,15)}Z`);
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'summary.json'),`${JSON.stringify({cells},null,1)}\n`);
fs.writeFileSync(path.join(out,'manifest.json'),`${JSON.stringify({study:'clustersynth-ui',
 prereg:'../CLUSTERSYNTH-UI-PREREG.md',alpha:ALPHA,cal:CAL,test:TEST,shards:SHARDS,
 git_sha:gitSha,mode:MODE,elapsed_s:(Date.now()-t0)/1000},null,1)}\n`);
console.log(`\nwrote ${out}`);
