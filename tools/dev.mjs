// Live preview while editing: serves site/, rebuilds when content/ or the partials change, and reloads the
// open pages (keeping their scroll position) whenever anything under site/ changes. No dependencies.
// Also serves the opening's tuning panel (tools/tune.js, press T) and saves its values (POST /__tune).
// Usage: node tools/dev.mjs [port]   (default 3000)
import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { execFile } from "node:child_process";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { ROLES, LINES, PREVIEW_TEXT, DESIGN_MODEL, parseCast, lines } from "./story-cast.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");
const PORT = +(process.argv[2] || 3000);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };
// injected into every HTML page: reload on change, and come back to the same scroll position
const CLIENT = `<script src="/__tune.js" defer></script><script>(function(){var k="dev-scroll:"+location.pathname;try{var y=sessionStorage.getItem(k);if(y!==null){sessionStorage.removeItem(k);addEventListener("load",function(){scrollTo(0,+y)})}}catch(e){}new EventSource("/__dev").onmessage=function(){try{sessionStorage.setItem(k,scrollY)}catch(e){}location.reload()}})();</script>`;

// the ignored .env at the repo root, for tools/story.mjs: read one value, or set one (other lines kept, owner-only)
async function envValue(k) { try { const m = (await readFile(join(ROOT, ".env"), "utf8")).match(new RegExp(`^${k}=(.*)$`, "m")); return m ? m[1].trim() : ""; } catch { return ""; } }
async function envSet(k, v) {
  let lines = []; try { lines = (await readFile(join(ROOT, ".env"), "utf8")).split("\n").filter((l) => l && !l.startsWith(`${k}=`)); } catch {}
  await writeFile(join(ROOT, ".env"), [...lines, `${k}=${v}`].join("\n") + "\n", { mode: 0o600 });
}
async function voicesPage() {
  const html = await readFile(join(SITE, "index.html"), "utf8"), said = {};
  for (const l of [...lines(html, "top"), ...lines(html, "today")]) said[`${l.sec}@${+l.in}`] = l.text;
  const roles = ROLES.map((r) => ({ ...r, lines: Object.entries(LINES).filter(([, v]) => v === r.id).map(([k]) => "“" + (said[k] || k) + "”") }));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Story voices</title>
<style>body{margin:0;background:#0b0d12;color:#ebe6da;font:15px/1.5 Spectral,Georgia,serif;padding:34px 16px 120px}main{max-width:1100px;margin:0 auto}
h1{font-weight:300;font-size:32px;margin:0 0 8px}p{color:#a7abb9;margin:0 0 21px;max-width:60em}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px}
.card{border:1px solid #2a2f3a;border-radius:12px;padding:16px;background:#12151d;display:flex;flex-direction:column;gap:10px}.card.done{border-color:#d9b45a}
h2{margin:0;font:600 12px "IBM Plex Mono",monospace;letter-spacing:.16em;text-transform:uppercase;color:#d9b45a}.says{font-size:14px;color:#a7abb9}
textarea{font:13px/1.45 "IBM Plex Mono",monospace;min-height:96px;padding:10px;border-radius:8px;border:1px solid #2a2f3a;background:#0b0d12;color:#ebe6da;resize:vertical}
button{font:11px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;padding:11px 14px;border-radius:999px;border:1px solid #3a4050;background:none;color:#ebe6da;cursor:pointer}
button.main{background:#ebe6da;color:#0b0d12;border-color:transparent}button:disabled{opacity:.4;cursor:default}
.pv{display:flex;align-items:center;gap:8px}.pv audio{flex:1;height:34px}.pv label{font:11px "IBM Plex Mono",monospace;display:flex;gap:6px;align-items:center;cursor:pointer}
.msg{font:12px "IBM Plex Mono",monospace;color:#d9b45a;min-height:1.4em}.foot{position:fixed;left:0;right:0;bottom:0;padding:13px 16px;background:#0b0d12ee;border-top:1px solid #2a2f3a;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap}</style></head>
<body><main><h1>The voices of the story</h1>
<p>Ten voices from ten places, one per line, so the film is spoken by many of us, never one. Each is designed by ElevenLabs Voice Design from the description (no real person's voice is copied). Edit a description if you like, generate three previews, listen, pick one. Every preview reads the same words. Saving creates the picked voices in your ElevenLabs account and writes their ids to .env.</p>
<div style="display:flex;gap:10px;margin-bottom:21px"><button id="all">Generate all previews</button></div>
<div class="grid" id="grid"></div></main>
<div class="foot"><span class="msg" id="count"></span><button class="main" id="save" disabled>Save the cast</button><span class="msg" id="smsg"></span></div>
<script>var R=${JSON.stringify(roles)},picks={};
var g=document.getElementById("grid");
R.forEach(function(r){var c=document.createElement("div");c.className="card";c.id="c-"+r.id;
c.innerHTML='<h2>'+r.name+'</h2><div class="says">'+r.lines.join(" · ")+'</div><textarea>'+r.prompt+'</textarea><button>Generate 3 previews</button><div class="pvs"></div><div class="msg"></div>';
c.querySelector("button").onclick=function(){design(r)};g.appendChild(c);});
async function design(r){var c=document.getElementById("c-"+r.id),m=c.querySelector(".msg"),b=c.querySelector("button");b.disabled=true;m.textContent="Designing…";
try{var res=await fetch("/__voices/design",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({role:r.id,prompt:c.querySelector("textarea").value})});
if(!res.ok)throw new Error(await res.text());var pv=await res.json(),box=c.querySelector(".pvs");box.innerHTML="";delete picks[r.id];c.classList.remove("done");
pv.forEach(function(p,i){var d=document.createElement("div");d.className="pv";d.innerHTML='<audio controls preload="auto" src="'+p.audio+'"></audio><label><input type="radio" name="'+r.id+'"> use</label>';
d.querySelector("input").onchange=function(){picks[r.id]={id:p.id,prompt:c.querySelector("textarea").value};c.classList.add("done");upd();};box.appendChild(d);});m.textContent="";}
catch(e){m.textContent=e.message;}b.disabled=false;b.textContent="Generate again";upd();}
document.getElementById("all").onclick=async function(){this.disabled=true;for(var i=0;i<R.length;i++)await design(R[i]);this.disabled=false;};
function upd(){var n=Object.keys(picks).length;document.getElementById("count").textContent=n+" of "+R.length+" picked";document.getElementById("save").disabled=n===0;}
document.getElementById("save").onclick=async function(){var m=document.getElementById("smsg");this.disabled=true;m.textContent="Creating voices…";
var res=await fetch("/__voices/save",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({picks:picks})});
m.textContent=res.ok?"Saved: "+(await res.json()).saved.join(", "):await res.text();this.disabled=false;};upd();</script></body></html>`;
}

const KEY_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Story key</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d12;color:#ebe6da;font:16px/1.5 Spectral,Georgia,serif}
form{width:min(460px,calc(100vw - 32px));display:flex;flex-direction:column;gap:13px}h1{font-weight:300;font-size:28px;margin:0}
label{font:11px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#a7abb9}
input{font:14px "IBM Plex Mono",monospace;padding:12px;border-radius:8px;border:1px solid #2a2f3a;background:#12151d;color:#ebe6da}
button{font:12px "IBM Plex Mono",monospace;letter-spacing:.16em;text-transform:uppercase;padding:13px;border-radius:999px;border:0;background:#ebe6da;color:#0b0d12;cursor:pointer}
p{margin:0;color:#a7abb9;font-size:14px}#msg{min-height:1.5em;color:#d9b45a}</style></head><body>
<form id="f" autocomplete="off"><h1>ElevenLabs for the story</h1>
<p>Saved only to <code>.env</code> in this worktree (ignored by git). It is checked with ElevenLabs, then never shown again.</p>
<label for="k">API key</label><input id="k" type="password" required spellcheck="false">
<label for="v">Voice ID (your Voice Design voice; optional)</label><input id="v" type="text" spellcheck="false" placeholder="leave empty to choose later">
<button>Save key</button><p id="msg" aria-live="polite"></p></form>
<script>document.getElementById("f").onsubmit=async function(e){e.preventDefault();var m=document.getElementById("msg");m.textContent="Checking with ElevenLabs…";
var r=await fetch("/__story-key",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:k.value.trim(),voice:v.value.trim()})});
if(!r.ok){m.textContent=await r.text();return;}var d=await r.json();k.value="";m.textContent="Saved. Plan: "+d.tier+" · "+d.used+" of "+d.limit+" characters used this period."+(d.voice?"":" No voice ID yet: Claude will list your voices.");};</script></body></html>`;

const clients = new Set();
function reload(why) { console.log(`reload · ${why}`); for (const res of clients) res.write("data: reload\n\n"); }

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__dev") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write(": live\n\n"); clients.add(res); req.on("close", () => clients.delete(res)); return;
  }
  if (url.pathname === "/__tune.js") { res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" }).end(await readFile(join(ROOT, "tools/tune.js"))); return; }
  if (url.pathname === "/__story-key") { // paste the ElevenLabs key for tools/story.mjs: written to the ignored .env, never sent back
    const local = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || "");
    if (!local) { res.writeHead(403).end(); return; }
    if (req.method === "GET") { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(KEY_PAGE); return; }
    if (req.method !== "POST" || req.headers.origin !== `http://${req.headers.host}`) { res.writeHead(403).end(); return; }
    let raw = ""; for await (const c of req) raw += c;
    try {
      const { key, voice } = JSON.parse(raw), env = join(ROOT, ".env");
      if (!/^[A-Za-z0-9_-]{20,200}$/.test(key || "")) throw new Error("That doesn't look like an ElevenLabs API key.");
      if (voice && !/^[A-Za-z0-9]{10,64}$/.test(voice)) throw new Error("That doesn't look like a voice ID.");
      // check the key with ElevenLabs before saving it
      const me = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } });
      if (!me.ok) throw new Error(`ElevenLabs refused the key (${me.status}).`);
      const sub = await me.json();
      let keep = ""; try { keep = (await readFile(env, "utf8")).split("\n").filter((l) => l && !/^\s*ELEVENLABS_(API_KEY|VOICE_ID)\s*=/.test(l)).join("\n"); } catch {}
      await writeFile(env, [keep, `ELEVENLABS_API_KEY=${key}`, voice ? `ELEVENLABS_VOICE_ID=${voice}` : ""].filter(Boolean).join("\n") + "\n", { mode: 0o600 });
      console.log(`story-key · saved to .env (plan: ${sub.tier})`);
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ tier: sub.tier, used: sub.character_count, limit: sub.character_limit, voice: !!voice }));
    } catch (e) { res.writeHead(400, { "content-type": "text/plain" }).end(e.message); }
    return;
  }
  if (url.pathname.startsWith("/__voices")) { // the story's cast: design ten voices, listen, pick, save their ids to .env
    const local = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || "");
    if (!local) { res.writeHead(403).end(); return; }
    if (req.method === "GET" && url.pathname === "/__voices") { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(await voicesPage()); return; }
    if (req.method !== "POST" || req.headers.origin !== `http://${req.headers.host}`) { res.writeHead(403).end(); return; }
    let raw = ""; for await (const c of req) raw += c;
    try {
      const body = JSON.parse(raw), key = await envValue("ELEVENLABS_API_KEY");
      if (!key) throw new Error("No API key yet: save it at /__story-key first.");
      const api = async (path, payload) => {
        const r = await fetch(`https://api.elevenlabs.io/v1${path}`, { method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error(`ElevenLabs ${path}: ${r.status} ${(await r.text()).slice(0, 300)}`);
        return r.json();
      };
      if (url.pathname === "/__voices/design") {
        const d = await api("/text-to-voice/design", { voice_description: String(body.prompt).slice(0, 1000), model_id: DESIGN_MODEL, text: PREVIEW_TEXT });
        console.log(`voices · 3 previews for ${body.role}`);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(d.previews.map((p) => ({ id: p.generated_voice_id, audio: `data:${p.media_type || "audio/mpeg"};base64,${p.audio_base_64}` }))));
        return;
      }
      if (url.pathname === "/__voices/save") {
        const cast = parseCast(await envValue("ELEVENLABS_CAST"));
        for (const r of ROLES) {
          const p = body.picks && body.picks[r.id]; if (!p) continue;
          const v = await api("/text-to-voice", { voice_name: `we unfold · ${r.name}`, voice_description: String(p.prompt || r.prompt).slice(0, 1000), generated_voice_id: p.id, labels: { project: "weunfold-story" } });
          cast[r.id] = v.voice_id;
        }
        await envSet("ELEVENLABS_CAST", ROLES.filter((r) => cast[r.id]).map((r) => `${r.id}:${cast[r.id]}`).join(","));
        console.log(`voices · cast saved (${Object.keys(cast).length} of ${ROLES.length})`);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ saved: ROLES.filter((r) => cast[r.id]).map((r) => r.name) }));
        return;
      }
      res.writeHead(404).end();
    } catch (e) { console.error(`voices · ${e.message}`); res.writeHead(400, { "content-type": "text/plain" }).end(e.message); }
    return;
  }
  if (url.pathname === "/__tune" && req.method === "POST") { // the tuning panel saves the opening's settings into both copies of the landing
    let raw = ""; for await (const c of req) raw += c;
    try {
      const { tune, height } = JSON.parse(raw), line = `var TUNE = window.__wuTune = ${JSON.stringify(tune)};`, done = [];
      if (!tune || typeof tune !== "object" || !(height > 0)) throw new Error("bad values");
      for (const f of ["site/index.html", "private/artifact-version.html"]) {
        const path = join(ROOT, f); let src; try { src = await readFile(path, "utf8"); } catch { continue; }
        if (!/var TUNE = window\.__wuTune = \{[^\n]*\};/.test(src)) throw new Error(`no TUNE line in ${f}`);
        src = src.replace(/var TUNE = window\.__wuTune = \{[^\n]*\};/, () => line).replace(/\.scene-a \{ height: [\d.]+vh; \}/, `.scene-a { height: ${Math.round(height)}vh; }`);
        await writeFile(path, src); done.push(f);
      }
      console.log(`tune · saved into ${done.join(", ")}`);
      res.writeHead(200, { "content-type": "text/plain" }).end(`saved into ${done.join(" and ")}`);
    } catch (e) { res.writeHead(400, { "content-type": "text/plain" }).end(e.message); }
    return;
  }
  let file = normalize(join(SITE, decodeURIComponent(url.pathname)));
  if (!file.startsWith(SITE)) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    let body = await readFile(file);
    const type = TYPES[extname(file)] || "application/octet-stream";
    if (type.startsWith("text/html")) body = Buffer.from(body.toString().replace(/<\/body>|$/, (m) => CLIENT + m));
    // byte ranges, as GitHub Pages serves them: media can only seek (the auto story's voice, the Tactu video) with these
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range && !type.startsWith("text/html")) {
      const size = body.length, a = range[1] ? +range[1] : size - +range[2], b = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      if (!(a >= 0 && a <= b)) { res.writeHead(416, { "content-range": `bytes */${size}` }).end(); return; }
      res.writeHead(206, { "content-type": type, "cache-control": "no-store", "accept-ranges": "bytes", "content-range": `bytes ${a}-${b}/${size}`, "content-length": b - a + 1 }).end(body.subarray(a, b + 1));
      return;
    }
    res.writeHead(200, { "content-type": type, "cache-control": "no-store", "accept-ranges": "bytes" }).end(body);
  } catch { res.writeHead(404, { "content-type": "text/plain" }).end("not found"); }
}).listen(PORT, () => console.log(`we unfold dev · http://localhost:${PORT}/ · watching site/, content/, tools/build.mjs`));

// content/ and the build script feed generated files: rebuild, and the site/ watcher reloads the pages
let building = false, again = false;
function build(why) {
  if (building) { again = true; return; }
  building = true; console.log(`build · ${why}`);
  execFile(process.execPath, [join(ROOT, "tools/build.mjs")], (err, out, errOut) => {
    building = false; if (err) console.error(errOut || err.message); else process.stdout.write(out.split("\n").filter((l) => l.startsWith("wrote")).map((l) => `  ${l}\n`).join(""));
    if (again) { again = false; build("queued change"); }
  });
}
let timer;
watch(SITE, { recursive: true }, (_, f) => { clearTimeout(timer); timer = setTimeout(() => reload(f || "site"), 120); });
watch(join(ROOT, "content"), { recursive: true }, (_, f) => build(f || "content"));
watch(join(ROOT, "tools/build.mjs"), () => build("tools/build.mjs"));
watch(join(ROOT, "tools/tune.js"), () => reload("tools/tune.js"));
