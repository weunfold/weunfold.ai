const { chromium } = require(process.env.R+'/playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1280,height:800}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/unfold-with-us.html');await p.waitForTimeout(2000);
const Ps=[0,0.15,0.3,0.4,0.5,0.6,0.68,0.74,0.8,0.86,0.92,1];
for(const P of Ps){await p.evaluate(P=>{const t=document.getElementById('today');window.scrollTo(0,t.offsetTop+P*(t.offsetHeight-innerHeight))},P);
 const t0=Date.now(); await p.waitForTimeout(2200); await p.screenshot({path:`kf/p${String(Math.round(P*100)).padStart(3,'0')}.png`});}
console.log(errs);await b.close();})();
