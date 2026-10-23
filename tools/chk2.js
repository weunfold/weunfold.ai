const { chromium } = require(process.env.R+'/playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('file://'+process.cwd()+'/unfold-with-us.html');await p.waitForTimeout(3000);
const r=await p.evaluate(()=>{const W=window.__wu;if(!W)return 'nohook';const N=W.N;const md=(a,b)=>{let m=0;for(let i=0;i<a.length;i++)m=Math.max(m,Math.abs(a[i]-b[i]));return m;};
 const out={};out.field1_vs_web=md(W.fieldAt(1),W.web());out.scene0_vs_web=md(W.sceneAt(0).pos,W.web());out.scene1_vs_mark=md(W.sceneAt(1).pos,W.mark());out.commit0_vs_mark=md(W.commitAt(0),W.mark());out.commit5_vs_cq=md(W.commitAt(5),W.cq());
 function steps(f,dP){let prev=f(0),m=0,at=0;for(let P=dP;P<=1+1e-9;P+=dP){const q=f(Math.min(1,P));for(let i=0;i<N;i++){const d=Math.hypot(q[3*i]-prev[3*i],q[3*i+1]-prev[3*i+1],q[3*i+2]-prev[3*i+2]);if(d>m){m=d;at=P;}}prev=q;}return [+m.toFixed(4),+at.toFixed(3)];}
 out.field_step=[steps(W.fieldAt,0.004),steps(W.fieldAt,0.002)];
 out.commit_step=[steps(Q=>W.commitAt(Q*5),0.004),steps(Q=>W.commitAt(Q*5),0.002)];
 return out;});
console.log(JSON.stringify(r),errs);await b.close();})();
