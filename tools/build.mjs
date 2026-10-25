// Builds every copy of the manifesto from content/manifesto.md, so they never drift:
//   template#book in site/index.html and private/artifact-version.html if present (the reader + genesis hash),
//   site/manifesto.html (plain text page), site/manifesto.md, site/llms.txt, site/llms-full.txt.
// Also stamps the shared top bar and footer (content/partials/) into every page.
// Usage: node tools/build.mjs        (no dependencies)
//        node tools/build.mjs --check (exit 1 if any generated file is out of date)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "content/manifesto.md");
// the claude.ai artifact copy lives in private/ (never published) and is only rebuilt where it exists
const PAGES = ["site/index.html", "private/artifact-version.html"].filter((p) => existsSync(join(ROOT, p)));
const CHECK = process.argv.includes("--check");

// ---- parse ----
const raw = readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
if (!fm) throw new Error("content/manifesto.md: missing front matter");
const meta = Object.fromEntries(fm[1].split("\n").map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
for (const k of ["version", "date", "status"]) if (!meta[k]) throw new Error(`front matter needs ${k}`);
const body = raw.slice(fm[0].length).replace(/<!--[\s\S]*?-->/g, "");

// parts → sections → blocks. Block: {t:"p"|"h3"|"ul"|"ol"|"table", text|items|rows, cls}
const parts = [];
let part, sec;
const attr = (s) => { const m = s.match(/\s*\{((?:\.[\w-]+\s*)+)\}\s*$/); return m ? [s.slice(0, m.index), m[1].trim().split(/\s+/).map((c) => c.slice(1))] : [s, []]; };
for (const chunk of body.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean)) {
  const lines = chunk.split("\n");
  let m;
  if ((m = chunk.match(/^# (.+)$/))) { parts.push((part = { title: m[1], sections: [] })); sec = null; continue; }
  if ((m = chunk.match(/^## (.+)$/))) { if (!part) throw new Error("## before any # part"); part.sections.push((sec = { title: m[1], blocks: [] })); continue; }
  if (!sec) throw new Error(`text outside a section: ${chunk.slice(0, 40)}`);
  if ((m = chunk.match(/^### (.+)$/))) { sec.blocks.push({ t: "h3", text: m[1] }); continue; }
  if (lines.every((l) => l.startsWith("|"))) {
    const cells = (l) => l.slice(1, -1).split("|").map((c) => c.trim());
    sec.blocks.push({ t: "table", head: cells(lines[0]), rows: lines.slice(2).map(cells) });
    continue;
  }
  if (/^(- |\d+\. )/.test(lines[0])) {
    const ordered = /^\d+\. /.test(lines[0]);
    const [last, cls] = attr(lines[lines.length - 1]);
    const items = [...lines.slice(0, -1), last].map((l) => l.replace(/^(- |\d+\. )/, ""));
    sec.blocks.push({ t: ordered ? "ol" : "ul", items, cls });
    continue;
  }
  const [text, cls] = attr(lines.join(" "));
  sec.blocks.push({ t: "p", text, cls });
}

// ---- render: reader HTML (matches the original hand-written template#book) ----
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
const clsAttr = (cls) => (cls && cls.length ? ` class="${cls.join(" ")}"` : "");
const slug = (s) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function blockHtml(b, ind = "  ") {
  if (b.t === "h3" || b.t === "h4") return `${ind}<${b.t}>${inline(b.text)}</${b.t}>`;
  if (b.t === "p") return `${ind}<p${clsAttr(b.cls)}>${inline(b.text)}</p>`;
  if (b.t === "ul" || b.t === "ol") return [`${ind}<${b.t}${clsAttr(b.cls)}>`, ...b.items.map((i) => `${ind}  <li>${inline(i)}</li>`), `${ind}</${b.t}>`].join("\n");
  if (b.t === "table") {
    const rows = b.rows.map((r) => `${ind}  <div><dt>${inline(r[0])}</dt>${r.slice(1).map((c, k) => `<dd><span>${inline(b.head[k + 1])}</span>${inline(c)}</dd>`).join("")}</div>`);
    return [`${ind}<dl class="roles">`, ...rows, `${ind}</dl>`].join("\n");
  }
  throw new Error(`unknown block ${b.t}`);
}

// The reader's buttons: "Stay close" ends each part, "Read the charter" leads from one part to the next.
// They come from the build, not the Markdown, because the reader wires them (data-join / data-next).
function endButtons(pi) {
  const next = parts[pi + 1];
  return `  <div class="end"><button type="button" class="pill" data-join>Stay close</button>${next ? `<button type="button" class="pill ghost" data-next>Read the ${esc(next.title.replace(/^The /, "").toLowerCase())}</button>` : ""}</div>`;
}

const bookSections = [];
parts.forEach((p, pi) => p.sections.forEach((s, si) => {
  const lines = [`<section data-part="${escAttr(p.title)}" data-title="${escAttr(s.title)}">`, ...s.blocks.map((b) => blockHtml(b))];
  if (si === p.sections.length - 1) lines.push(endButtons(pi));
  lines.push("</section>");
  bookSections.push({ title: s.title, html: lines.join("\n") });
}));
const book = `<template id="book">\n${bookSections.map((s) => s.html).join("\n")}\n</template>`;

// ---- fingerprint: reproduces genesis() in site/index.html exactly ----
// browser: data-title + "\n" + section.textContent.replace(/\s+/g, " ").trim(), sections joined by "\n\n"
const textContent = (html) => html.replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const hashText = bookSections.map((s) => s.title + "\n" + textContent(s.html).replace(/\s+/g, " ").trim()).join("\n\n");
const sha = createHash("sha256").update(hashText, "utf8").digest("hex");

// ---- render: Markdown twin ----
function blockMd(b) {
  if (b.t === "h3") return `### ${b.text}`;
  if (b.t === "p") return b.text;
  if (b.t === "ul") return b.items.map((i) => `- ${i}`).join("\n");
  if (b.t === "ol") return b.items.map((i, k) => `${k + 1}. ${i}`).join("\n");
  if (b.t === "table") return [b.head, b.head.map(() => "---"), ...b.rows].map((r) => `| ${r.join(" | ")} |`).join("\n");
}
const partsMd = (lvl) => parts.map((p) => [`${"#".repeat(lvl)} ${p.title}`, ...p.sections.map((s) => [`${"#".repeat(lvl + 1)} ${s.title}`, ...s.blocks.map((b) => (b.t === "h3" ? `${"#".repeat(lvl + 2)} ${b.text}` : blockMd(b)))].join("\n\n"))].join("\n\n")).join("\n\n");
const stamp = `${meta.version} · ${meta.date} · ${meta.status}`;
const manifestoMd = `# Open Intelligence

> The manifesto and charter of the Open Intelligence movement. ${meta.version}, ${meta.date}. ${meta.status}

SHA-256 of the reader text: \`${sha}\`. This fingerprint is not anchored anywhere yet.

${partsMd(2)}
`;

// ---- render: text page ----
const toc = parts.map((p) => `      <li><a href="#${slug(p.title)}">${esc(p.title)}</a>\n        <ol>\n${p.sections.map((s) => `          <li><a href="#${slug(s.title)}">${esc(s.title)}</a></li>`).join("\n")}\n        </ol>\n      </li>`).join("\n");
const article = parts.map((p) => [
  `    <h2 id="${slug(p.title)}">${esc(p.title)}</h2>`,
  ...p.sections.map((s) => [`    <section aria-labelledby="${slug(s.title)}">`, `      <h3 id="${slug(s.title)}"><a class="anchor" href="#${slug(s.title)}" aria-label="Link to this section">#</a>${inline(s.title)}</h3>`, ...s.blocks.map((b) => blockHtml(b.t === "h3" ? { ...b, t: "h4" } : b, "      ")), "    </section>"].join("\n")),
].join("\n")).join("\n");

const textPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open Intelligence — manifesto</title>
<meta name="description" content="The Open Intelligence manifesto and charter, as plain text. ${escAttr(meta.version)}, ${escAttr(meta.date)}.">
<link rel="alternate" type="text/markdown" href="manifesto.md">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Spectral:ital,wght@0,300;0,400;0,500;1,400&display=swap">
<style>
:root { --bg: #f5efe4; --text: #1d1b19; --muted: #57514a; --faint: #7a7268; --line: #ddd3c4; --accent: #8a6a1f;
  --serif: Spectral, "Iowan Old Style", Georgia, serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg: #0b0d12; --text: #ebe6da; --muted: #a7abb9; --faint: #8a8f9e; --line: #222632; --accent: #d9b45a; color-scheme: dark; } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--text); font: 300 1.2rem/1.65 var(--serif); }
main { max-width: 38rem; margin: 0 auto; padding: 3rem 1rem 5rem; }
a { color: inherit; text-underline-offset: 0.18em; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.skip { position: absolute; left: -999px; } .skip:focus { left: 1rem; top: 1rem; background: var(--bg); padding: 0.4rem 0.6rem; }
.eyebrow, .meta, nav, .anchor, .roles span, footer { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.08em; }
.eyebrow { text-transform: uppercase; letter-spacing: 0.24em; color: var(--muted); margin: 0 0 0.6rem; }
h1 { font-weight: 300; font-size: clamp(2.4rem, 7vw, 3.4rem); line-height: 1.05; margin: 0 0 1.2rem; }
h1 i { font-weight: 300; }
.meta { color: var(--muted); line-height: 1.7; margin: 0 0 2.4rem; }
.meta code { word-break: break-all; color: var(--text); }
nav { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 1rem 0; margin-bottom: 3rem; }
nav ol { list-style: none; padding: 0; margin: 0; } nav ol ol { padding-left: 1.2rem; margin: 0.2rem 0 0.6rem; }
nav a { text-decoration: none; } nav a:hover { text-decoration: underline; }
h2 { font-family: var(--mono); font-weight: 500; font-size: 0.78rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted); margin: 4rem 0 0; padding-top: 1rem; border-top: 1px solid var(--line); }
h3 { font-weight: 400; font-size: 1.55rem; line-height: 1.25; margin: 2.4rem 0 1rem; position: relative; }
h4 { font-weight: 500; font-size: 1.15rem; margin: 2rem 0 0.6rem; }
.anchor { position: absolute; left: -1.4rem; top: 0.45em; color: var(--faint); text-decoration: none; opacity: 0; }
h3:hover .anchor, .anchor:focus { opacity: 1; }
p { margin: 0 0 1.1rem; }
.lead { font-size: 1.32rem; }
.key { font-style: italic; color: var(--accent); }
.small { font-size: 1.05rem; }
.sign { font-weight: 500; margin: 0; }
.sign + :not(.sign) { margin-top: 1.1rem; }
.flow { font-family: var(--mono); font-size: 0.85rem; }
ul, ol { padding-left: 1.3rem; } li { margin-bottom: 0.5rem; }
.roles { margin: 1.4rem 0; } .roles > div { border-top: 1px solid var(--line); padding: 0.8rem 0; }
.roles dt { font-weight: 500; } .roles dd { margin: 0.2rem 0 0; font-size: 1.05rem; }
.roles span { display: block; color: var(--faint); text-transform: uppercase; }
footer { margin-top: 4rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--muted); line-height: 1.8; }
@media (max-width: 40rem) { .anchor { display: none; } }
@media print {
  :root { --bg: #fff; --text: #000; --muted: #444; --faint: #666; --line: #bbb; --accent: #000; }
  body { font-size: 11pt; } main { max-width: none; padding: 0; } nav, .skip, .anchor, .noprint { display: none; }
  h2 { break-before: page; } h3, h4 { break-after: avoid; } p, li, .roles > div { break-inside: avoid; }
  a { text-decoration: none; }
}
</style>
</head>
<body>
<a class="skip" href="#text">Skip to the text</a>
<main>
  <header>
    <p class="eyebrow">we unfold · ${esc(meta.status)}</p>
    <h1>Open <i>Intelligence</i></h1>
    <p class="meta">${esc(meta.version)} · <time datetime="${escAttr(meta.date)}">${esc(meta.date)}</time><br>
      SHA-256 <code>${sha}</code><br>
      Not anchored yet. This is the fingerprint the reader on the main page computes from the same text.<br>
      <span class="noprint"><a href="manifesto.md">Markdown</a> · <a href="./">The experience</a></span></p>
  </header>
  <nav aria-label="Contents">
    <ol>
${toc}
    </ol>
  </nav>
  <article id="text">
${article}
  </article>
  <footer>${esc(stamp)}<br>Generated from content/manifesto.md. Do not edit this file.</footer>
</main>
</body>
</html>
`;

// ---- render: llms.txt / llms-full.txt (llmstxt.org format; relative links only until weunfold.ai is verified) ----
const llms = `# we unfold — Open Intelligence

> Home of the Open Intelligence movement and its economic dimension, Open Economy. This is a preview: the manifesto is ${meta.version} (${meta.date}), proposed for review, and nothing here has been launched or approved.

Every figure on the site carries its state: Proposal, Example, Not measured yet, or Sample data. There are no live member counts, funding totals or votes. Proposed initiatives and their terms are proposals, not offers.

## Manifesto

- [Manifesto and charter (Markdown)](manifesto.md): the full text, ${meta.version}. SHA-256 \`${sha}\`, not anchored yet.
- [Manifesto and charter (plain page)](manifesto.html): the same text as an accessible HTML page with a contents list.
- [Everything in one file](llms-full.txt): the manifesto and charter in a single Markdown file.

## Optional

- [The experience](./): the scroll-driven page. It needs WebGL. Its scenes quote the manifesto and add previews (Open Economy, Tactu, participants, Proof of Progress) that are not in the files above.
`;
const llmsFull = `# we unfold — Open Intelligence

> The full text of the Open Intelligence manifesto and charter. ${meta.version}, ${meta.date}. ${meta.status}

SHA-256 of the reader text: \`${sha}\`. Not anchored yet.

Not included: participants, initiatives and Proof of Progress. They are previews on the page and nothing about them has been confirmed for publication.

${partsMd(2)}
`;

// ---- the shared shell: top bar (markup, style, script) and footer on every page ----
// Pages carry markers: <!-- build:header -->…<!-- /build:header -->, <style data-build="header">…</style>,
// <script data-build="head"> and <script data-build="header">…</script>, and <!-- build:footer -->…<!-- /build:footer -->.
const SHELL = {
  "site/index.html": { root: "", landing: true },
  "private/artifact-version.html": { root: "", landing: true },
  "site/initiatives/index.html": { root: "../", current: "index" },
  "site/initiatives/alexandria/index.html": { root: "../../", current: "alexandria" },
  "site/bench/index.html": { root: "../", current: "bench" },
};
const partial = (name) => readFileSync(join(ROOT, "content/partials", name), "utf8").replace(/^<!--[\s\S]*?-->\n/, "");
const HEADER = { html: partial("header.html"), css: partial("header.css"), head: partial("head.js"), js: partial("header.js"), footer: partial("footer.html"), capacity: partial("capacity.js") };
function stampShell(html, rel) {
  const p = SHELL[rel], home = p.landing ? "" : p.root, cur = (k) => (p.current === k ? ' aria-current="page"' : "");
  const fill = (s) => s.replace(/\{BRAND_HREF\}/g, p.landing ? "#top" : p.root).replace(/\{HOME\}/g, home).replace(/\{ROOT\}/g, p.root)
    .replace(/\{READ\}/g, p.landing ? " data-read" : "").replace(/\{CUR_INDEX\}/g, cur("index")).replace(/\{CUR_ALEXANDRIA\}/g, cur("alexandria")).replace(/\{VERSION\}/g, esc(meta.version));
  const swap = (re, repl, what) => { if (!re.test(html)) throw new Error(`${rel}: missing ${what} marker`); html = html.replace(re, () => repl); };
  swap(/<!-- build:header -->[\s\S]*?<!-- \/build:header -->/, `<!-- build:header -->\n${fill(HEADER.html)}  <!-- /build:header -->`, "build:header");
  swap(/<style data-build="header">[\s\S]*?<\/style>/, `<style data-build="header">\n${HEADER.css}</style>`, 'style data-build="header"');
  swap(/<script data-build="head">[\s\S]*?<\/script>/, `<script data-build="head">\n${HEADER.head}</script>`, 'script data-build="head"');
  swap(/<script data-build="header">[\s\S]*?<\/script>/, `<script data-build="header">\n${HEADER.js}</script>`, 'script data-build="header"');
  if (/<script data-build="capacity">/.test(html)) swap(/<script data-build="capacity">[\s\S]*?<\/script>/, `<script data-build="capacity">\n${HEADER.capacity}</script>`, 'script data-build="capacity"');
  swap(/<!-- build:footer -->[\s\S]*?<!-- \/build:footer -->/, `<!-- build:footer -->\n${fill(HEADER.footer)}  <!-- /build:footer -->`, "build:footer");
  return html;
}

// ---- write ----
const outputs = { "site/manifesto.md": manifestoMd, "site/manifesto.html": textPage, "site/llms.txt": llms, "site/llms-full.txt": llmsFull };
for (const rel of Object.keys(SHELL)) if (!PAGES.includes(rel) && existsSync(join(ROOT, rel))) outputs[rel] = stampShell(readFileSync(join(ROOT, rel), "utf8"), rel);
for (const page of PAGES) {
  let html = stampShell(readFileSync(join(ROOT, page), "utf8"), page);
  if (!/<template id="book">[\s\S]*?<\/template>/.test(html)) throw new Error(`${page}: no template#book`);
  html = html.replace(/<template id="book">[\s\S]*?<\/template>/, () => book)
    .replace(/(<span id="genesisVer">)[^<]*(<\/span>)/, (_, a, b) => a + esc(meta.version) + b)
    .replace(/(<span data-build="version">)[^<]*(<\/span>)/g, (_, a, b) => a + esc(meta.version) + b);
  outputs[page] = html;
}
let stale = 0;
for (const [rel, content] of Object.entries(outputs)) {
  const file = join(ROOT, rel);
  let prev = null;
  try { prev = readFileSync(file, "utf8"); } catch {}
  if (prev === content) continue;
  stale++;
  if (CHECK) console.log(`out of date: ${rel}`);
  else { writeFileSync(file, content); console.log(`wrote ${rel}`); }
}
console.log(`${meta.version} · ${bookSections.length} sections · sha256 ${sha}`);
if (CHECK && stale) process.exit(1);
