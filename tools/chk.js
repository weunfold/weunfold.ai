const { chromium } = require(process.env.R+'/playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader']});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/unfold-with-us.html');await p.waitForTimeout(2000);
await p.evaluate(()=>document.getElementById('dlSeal').scrollIntoView());const [d]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('#dlSeal')]);
console.log('download',d&&d.suggestedFilename(),'errors',errs);await b.close();})();
