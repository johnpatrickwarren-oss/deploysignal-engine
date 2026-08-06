import path from 'node:path';
import { createRequire } from 'node:module';
import {
  ENGINE_ROOT, buildBundle, rowsFromDeviations, liveMetricsFrom, EVAL_CTX,
  bettingC, CELL_KEY, covarianceCorr,
} from '/Users/johnwarren/concord/deploysignal-engine/validation/family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream } from '/Users/johnwarren/concord/deploysignal-engine/validation/family-ce-nulls/harness/nulls.mjs';
const require = createRequire(import.meta.url);
const rff = require(path.join(ENGINE_ROOT,'dist','detectors','family-c-rff.js'));
const smmd = require(path.join(ENGINE_ROOT,'dist','detectors','sequential-mmd.js'));
const trace=(S)=>S.reduce((a,r,i)=>a+r[i],0);
const g=NULLS.find(s=>s.law==='gauss'&&s.sigma==='corr'), mx=NULLS.find(s=>s.law==='mix'&&s.sigma==='corr');
const ST=covarianceCorr(), trTrue=trace(ST);
const baseDraw=deviationStream(g,20260803+1000003);
const rows=rowsFromDeviations(Array.from({length:600},baseDraw));
console.log('m      log-wealth at T=300 (mean over 60 traj):  healthy      fault      delta');
for (const m of [0.05,0.10,0.15,0.22,0.32,0.46,0.68,1.00,1.50]) {
  const { cfg, famC } = buildBundle(rows);
  const bp=famC.betting_e_process_params;
  const sigmaBase=bp.kernel_bandwidth_sigma;
  bp.kernel_bandwidth_sigma=m*sigmaBase;
  const k=trTrue/trace(famC.covariance);
  const fm=rff.computeRffFeatureMap(bp.rff_seed,bp.rff_dim,famC.mean_vector.length,bp.kernel_bandwidth_sigma);
  const scaled={...famC,covariance:famC.covariance.map(r=>r.map(v=>v*k))};
  const pool=smmd.generateBaselinePool(scaled,500,smmd.baselinePoolSeed({hour_of_day:CELL_KEY.hour_of_day,day_of_week:CELL_KEY.day_of_week}));
  const acc=new Float64Array(fm.D);
  for(const x of pool){const p=rff.applyRffFeatureMap(x,fm);for(let i=0;i<fm.D;i++)acc[i]+=p[i];}
  bp.baseline_rff_mean=Array.from({length:fm.D},(_,i)=>acc[i]/pool.length);
  const run=(faulty)=>{
    const out=[];
    for(let tr=0;tr<60;tr++){
      const pre=deviationStream(g,777+tr), post=deviationStream(mx,999+tr);
      const st={};
      for(let t=0;t<300;t++){
        const dev=(faulty&&t>=100)?post():pre();
        bettingC.evaluateFamilyCBettingEProcess(cfg,liveMetricsFrom(dev,famC.mean_vector),st,EVAL_CTX);
      }
      const kk=Object.keys(st).find(s=>s.startsWith('__fc_betting'));
      out.push(st[kk].log_S_t);
    }
    return out.reduce((a,b)=>a+b,0)/out.length;
  };
  const h=run(false), f=run(true);
  console.log(`${m.toFixed(2)}  ${h.toFixed(4).padStart(12)} ${f.toFixed(4).padStart(11)} ${(f-h).toFixed(4).padStart(10)}   (threshold=${Math.log(20).toFixed(2)})`);
}
