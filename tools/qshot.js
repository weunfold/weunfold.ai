const { chromium } = require(process.env.R+'/playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
for (const [w,h,tag,dpr] of [[1440,900,'d',2],[400,860,'m',3]]){
const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
await p.goto('file://'+process.cwd()+'/unfold-with-us.html');await p.waitForTimeout(1500);
await p.evaluate(()=>{document.getElementById('join').scrollIntoView()});await p.waitForTimeout(5000);
const el=await p.$('#qr');await el.screenshot({path:`qq_${tag}.png`});await p.close();}
await b.close();})();
