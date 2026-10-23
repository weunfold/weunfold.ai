const { chromium } = require(process.env.R+'/playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('file://'+process.cwd()+'/unfold-with-us.html');await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
  const W=window.__wu; if(!W) return 'no hook';
  const N=W.N, web=W.web(), mark=W.mark();
  const maxd=(a,b)=>{let m=0;for(let i=0;i<a.length;i++)m=Math.max(m,Math.abs(a[i]-b[i]));return m;};
  const s0=W.sceneAt(0,0), s1=W.sceneAt(1,0);
  const out={info:W.info(), start_vs_web:maxd(s0.pos,web), end_vs_mark:maxd(s1.pos,mark)};
  // step continuity at two resolutions; for a continuous path the largest step halves when the step halves
  function maxStep(dP){let prev=W.sceneAt(0,0).pos,m=0,at=0;for(let P=dP;P<=1+1e-9;P+=dP){const q=W.sceneAt(Math.min(1,P),0).pos;for(let i=0;i<N;i++){const d=Math.hypot(q[3*i]-prev[3*i],q[3*i+1]-prev[3*i+1],q[3*i+2]-prev[3*i+2]);if(d>m){m=d;at=P;}}prev=q;}return [m,at];}
  out.step_002=maxStep(0.002); out.step_001=maxStep(0.001);
  // reversibility: same P, reached forwards or backwards, gives the same field
  const f=W.sceneAt(0.47,0).pos, back=(W.sceneAt(0.9,0),W.sceneAt(0.47,0)).pos; out.reverse_diff=maxd(f,back);
  // core sizes over P
  out.cores=[0,0.2,0.4,0.6,0.7,0.8,0.9,0.98,1].map(P=>[P,W.sceneAt(P,0).rh.map(x=>+x.toFixed(3))]);
  return out;});
console.log(JSON.stringify(r,null,1),errs);await b.close();})();
