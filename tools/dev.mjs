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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");
const PORT = +(process.argv[2] || 3000);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };
// injected into every HTML page: reload on change, and come back to the same scroll position
const CLIENT = `<script src="/__tune.js" defer></script><script>(function(){var k="dev-scroll:"+location.pathname;try{var y=sessionStorage.getItem(k);if(y!==null){sessionStorage.removeItem(k);addEventListener("load",function(){scrollTo(0,+y)})}}catch(e){}new EventSource("/__dev").onmessage=function(){try{sessionStorage.setItem(k,scrollY)}catch(e){}location.reload()}})();</script>`;

const clients = new Set();
function reload(why) { console.log(`reload · ${why}`); for (const res of clients) res.write("data: reload\n\n"); }

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__dev") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write(": live\n\n"); clients.add(res); req.on("close", () => clients.delete(res)); return;
  }
  if (url.pathname === "/__tune.js") { res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" }).end(await readFile(join(ROOT, "tools/tune.js"))); return; }
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
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(body);
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
