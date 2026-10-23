const { chromium } = require(process.env.R+'/playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
for (const [w,h,tag,dpr] of [[1440,900,'d',1],[390,844,'m',2]]){
const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('file://'+process.cwd()+'/unfold-with-us.html');await p.waitForTimeout(2000);
await p.evaluate(()=>document.getElementById('genesis').scrollIntoView({block:'center'}));await p.waitForTimeout(2500);await p.screenshot({path:`sc/mk_${tag}_genesis.png`});
await p.evaluate(()=>{const el=document.getElementById('mark');window.scrollTo(0,el.offsetTop+el.offsetHeight-innerHeight)});await p.waitForTimeout(3500);await p.screenshot({path:`sc/mk_${tag}_mark1.png`});
await p.click('.mk[data-v="swirl"] .mk-apply');await p.waitForTimeout(700);await p.screenshot({path:`sc/mk_${tag}_mark_mid.png`});await p.waitForTimeout(2200);
await p.click('.mk[data-v="swirl"] .thumb.up');await p.click('.mk[data-v="seeds"] .thumb.down');await p.waitForTimeout(500);await p.screenshot({path:`sc/mk_${tag}_mark2.png`});
console.log(tag,'tally:',await p.textContent('#tally'));
await p.evaluate(()=>document.getElementById('kit').scrollIntoView());await p.waitForTimeout(1500);
await p.setInputFiles('#avatarFile','testface.png');await p.waitForTimeout(800);
await p.screenshot({path:`sc/mk_${tag}_kit.png`,fullPage:false});
const [d1]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('[data-dl="badge"]')]);
const [d2]=await Promise.all([p.waitForEvent('download',{timeout:8000}).catch(()=>null),p.click('[data-dl="wall"]')]);
const [d3]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('[data-dl="avatar"]')]);
console.log(tag,'downloads',d1&&d1.suggestedFilename(),d2&&d2.suggestedFilename(),d3&&d3.suggestedFilename());
if(d3) await d3.saveAs(`sc/avatar_${tag}.png`);
await p.click('[data-copy="badge"]');await p.waitForTimeout(300);console.log(tag,'msg',await p.textContent('#kitMsg'));
const seal=await p.evaluate(()=>document.querySelector('nav svg[data-seal]').innerHTML.length);console.log(tag,'seal len',seal, 'hash', await p.textContent('#genesisHash'));
console.log(tag,errs);await ctx.close();}
await b.close();})();
