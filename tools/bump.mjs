// Bumps the version by one minor step (Draft 0.4 → Draft 0.5) in content/manifesto.md and sets today's date.
// One number covers the site and the manifesto until v1.0, which is set by hand at launch.
// Usage: node tools/bump.mjs   (prints the new version, e.g. 0.5; run tools/build.mjs afterwards)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "content/manifesto.md");
let src = readFileSync(file, "utf8");
const m = src.match(/^version: (.*?)(\d+)\.(\d+)\s*$/m);
if (!m) throw new Error("content/manifesto.md: no `version: … X.Y` line in the front matter");
const [line, label, major, minor] = m;
if (+major >= 1) throw new Error(`version is ${major}.${minor}: automatic bumps stop at 1.0`);
const next = `${major}.${+minor + 1}`;
src = src.replace(line, `version: ${label}${next}`).replace(/^date: .*$/m, `date: ${new Date().toISOString().slice(0, 10)}`);
writeFileSync(file, src);
console.log(next);
