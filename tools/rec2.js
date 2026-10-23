const { chromium } = require(process.env.R+'/playwright');
const FPS=20;
const SEQ={
 forward:[['s',0],[0,1500],[1,11000],['b',2000],['b',700]],
 backward:[['b',0],[1,1500],[0,11000],['s',2000],['s',700]],
 reversals:[['s',0],[0,1200],[0.45,4000],[0.22,2500],[0.6,3500],[0.84,3500],[0.7,2200],[1,3000],['b',1800],['b',700]]
};
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
for(const name of Object.keys(SEQ)){
 const p=await b.newPage({viewport:{width:1280,height:720}});
 await p.goto('file://'+process.cwd()+'/unfold-with-us.html');await p.waitForTimeout(2500);
 await p.evaluate(()=>{window.__wuManual=true;document.documentElement.style.scrollBehavior='auto';
   const lab=document.createElement('div');lab.id='lab';lab.style.cssText='position:fixed;top:14px;right:18px;z-index:99;font:500 13px IBM Plex Mono,monospace;letter-spacing:.12em;color:#ebe6da;background:rgba(11,13,18,.85);border:1px solid #222632;padding:8px 12px;text-transform:uppercase';document.body.appendChild(lab);
   const st=document.createElement('style');st.textContent='.counter,.folds{display:none!important}';document.head.appendChild(st);});
 await p.waitForTimeout(300);
 // build the timeline of scroll targets, one per video frame
 const seq=SEQ[name]; let frames=[]; let prev=seq[0][0];
 for(const [to,ms] of seq.slice(1)){const n=Math.max(1,Math.round(ms/1000*FPS));for(let k=1;k<=n;k++){const x=k/n,e=x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;frames.push([prev,to,e]);}prev=to;}
 let simT=10000, i=0;
 for(const [a,bb,e] of frames){
  simT+=1000/FPS;
  await p.evaluate(([a,bb,e,simT,name])=>{const t=document.getElementById('today'),bl=document.getElementById('believe');
   const Y=v=>v==='s'?t.offsetTop-innerHeight*0.7:v==='b'?bl.offsetTop+bl.offsetHeight/2-innerHeight/2:t.offsetTop+v*(t.offsetHeight-innerHeight);
   const y0=Y(a),y1=Y(bb);window.scrollTo(0,y0+(y1-y0)*e);
   const r=t.getBoundingClientRect(),P=-r.top/(r.height-innerHeight);
   document.getElementById('lab').textContent=name+' · '+(y1>y0?'scrolling down':y1<y0?'scrolling up':'holding')+' · '+(r.top>0?'before scene':P>=1?'after scene':'P '+P.toFixed(2));
   window.__wuFrame(simT);},[a,bb,e,simT,name]);
  await p.screenshot({path:`vid2/${name}_${String(i++).padStart(4,'0')}.jpg`,type:'jpeg',quality:88});
 }
 console.log(name,i);await p.close();
}
await b.close();})();
