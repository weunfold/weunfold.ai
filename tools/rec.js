const { chromium } = require(process.env.R+'/playwright');
const SEQ={
 forward:[['s',0],[0,2500],[1,13000],['b',3000],['b',800]],
 backward:[['b',0],[1,2500],[0,13000],['s',3000],['s',800]],
 reversals:[['s',0],[0,2000],[0.45,4500],[0.22,3000],[0.6,4000],[0.84,4000],[0.7,2500],[1,3500],['b',2500],['b',800]]
};
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
for(const name of Object.keys(SEQ)){
 const ctx=await b.newContext({viewport:{width:1280,height:720},recordVideo:{dir:'vid/'+name,size:{width:1280,height:720}}});
 const p=await ctx.newPage();
 await p.goto('file://'+process.cwd()+'/unfold-with-us.html');await p.waitForTimeout(1500);
 await p.evaluate(async ([name,seq])=>{
  const t=document.getElementById('today'),bl=document.getElementById('believe');
  const Y=v=>v==='s'?t.offsetTop-innerHeight*0.7:v==='b'?bl.offsetTop+bl.offsetHeight/2-innerHeight/2:t.offsetTop+v*(t.offsetHeight-innerHeight);
  const lab=document.createElement('div');lab.style.cssText='position:fixed;top:14px;right:18px;z-index:99;font:500 13px IBM Plex Mono,monospace;letter-spacing:.12em;color:#ebe6da;background:rgba(11,13,18,.8);border:1px solid #222632;padding:8px 12px;text-transform:uppercase';document.body.appendChild(lab);
  const P=()=>{const r=t.getBoundingClientRect();return r.top>0?'before scene':(-r.top/(r.height-innerHeight)>=1?'after scene':'P '+(-r.top/(r.height-innerHeight)).toFixed(2));};
  window.scrollTo(0,Y(seq[0][0]));
  for(const [to,ms] of seq.slice(1)){const y0=scrollY,y1=Y(to),t0=performance.now();
   await new Promise(res=>{function f(now){const k=Math.min(1,(now-t0)/ms),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;window.scrollTo(0,y0+(y1-y0)*e);lab.textContent=name+' · '+(y1>y0?'scrolling down':y1<y0?'scrolling up':'holding')+' · '+P();if(k<1)requestAnimationFrame(f);else res();}requestAnimationFrame(f);});}
 },[name,SEQ[name]]);
 await p.waitForTimeout(600); const v=p.video(); await ctx.close(); console.log(name, await v.path());
}
await b.close();})();
