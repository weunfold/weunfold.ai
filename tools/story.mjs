// The auto story's sound and cue sheet, made at build time. The narrator reads the page's own words: the .beat / .ln
// text of #top and #today in site/index.html, in order. Writes site/assets/story/: voice.mp3 (every line in one
// Text to Dialogue request with timestamps, eleven_v3, one Voice Design voice), bed.mp3 (Eleven Music, instrumental),
// sfx-bang.mp3 and sfx-doors.mp3 (sound effects), and pilot.json (line cues timed inside voice.mp3, hold cues with their
// lengths, scroll targets and camera moves). No dependencies.
//
// Usage: node tools/story.mjs                generate with ElevenLabs (paid plan: Music API, 192 kbps MP3)
//        node tools/story.mjs --voice-only    regenerate the narration only, keep bed and effects
//        node tools/story.mjs --placeholder   synthetic tones instead of ElevenLabs (needs ffmpeg), for building the player
//        node tools/story.mjs --plan          print the cue sheet with estimated speech, call nothing, write nothing
// Key and voice: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID from the environment or an ignored .env at the repo root.
// The key is only sent to api.elevenlabs.io; this tool never writes or prints it.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site/assets/story");
const API = "https://api.elevenlabs.io/v1";
const FORMAT = "mp3_44100_192"; // constant bitrate, so seeking to a line's start is exact
const FILM = 90; // seconds from Play to the choice
const GAP = 0.7; // the pause between two lines that have no hold between them
const LEAD = 0.5; // a hold reaches its scroll target this long before the next line starts (the field trails the scroll)
const GAP_LEAD = 0.2; // a gap is short: it moves over most of its length
const CHOICE_AT = "today@0.68"; // "What if we could help shape what comes next?": the choice follows this line
const CHOICE_SECONDS = 10;
const args = new Set(process.argv.slice(2));

// Holds: where the film waits for the scene. `before` names the line the hold leads into (section@data-in), so a change
// of copy keeps its holds. `to` overrides the scroll target (default: the next line's). w shares out the time left once
// speech, gaps and every hold's min are counted; cam is the camera offset the hold drifts toward (x, y, z: z < 0 pushes in).
const HOLDS = [
  { before: "top@0", name: "singularity", to: ["top", 0], min: 3, w: 0, cam: [0, 0, -0.2] },
  { before: "top@0", name: "burst", to: ["top", 0.13], min: 4, w: 2, sfx: "bang", sfxAt: 0, cam: [0.1, 0.03, -0.45] },
  { before: "top@0.3", name: "galaxy", min: 4, w: 3, cam: [-0.12, 0.05, -0.5] },
  { before: "top@0.62", name: "web", min: 3, w: 2, cam: [0.1, -0.04, -0.35] },
  { before: "today@0", name: "into capture", min: 3, w: 1.5, cam: [0, 0.04, -0.3] },
  { before: "today@0.3", name: "wells", min: 2.5, w: 1.5, cam: [-0.08, 0, -0.4] },
  { before: "today@0.52", name: "doors", min: 3.5, w: 2, sfx: "doors", sfxAt: 0.7, cam: [0.06, -0.03, -0.25] },
  { before: "today@0.68", name: "dawn", min: 3, w: 1.5, cam: [0, 0.06, -0.35] },
];
// after Shape it: the last beat, then into the start of Open Intelligence (these do not count toward FILM)
const SHAPE_HOLDS = [{ before: "today@0.84", name: "the choice made", min: 2, w: 0, cam: [0, 0, -0.2] }];
const OUTRO = { name: "open intelligence", to: ["oi", 0.03], min: 4, cam: [0, 0, -0.4] };
// audio tags (pace and tone only), keyed like the holds
const TAGS = { "top@0": "[calm]", "today@0.14": "[thoughtful]", "today@0.52": "[quietly]", "today@0.68": "[hopeful]" };
const BED_PROMPT = "Slow ambient instrumental score for a quiet cosmic opening that turns into dawn: deep warm pads, soft low strings, sparse felt piano, no drums, no vocals. It begins almost silent, swells gently around the middle, grows darker and tighter for a while, then opens into a calm, hopeful, warm ending. It leaves room for a narrator.";
const SFX = {
  bang: { text: "A deep, soft cosmic burst: a low boom swelling out of silence with a long shimmering tail, cinematic, not harsh", seconds: 4 },
  doors: { text: "Heavy doors closing slowly in a vast empty hall, one deep echoing thud, cinematic", seconds: 3 },
};

// ---- the script, from the page ----
function decode(s) { return s.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "’").replace(/\s+/g, " ").trim(); }
function lines(html, id) {
  const m = html.match(new RegExp(`<section id="${id}"[^>]*>([\\s\\S]*?)</section>`));
  if (!m) throw new Error(`no #${id} in site/index.html`);
  const out = [];
  for (const b of m[1].matchAll(/<div class="beat" data-in="([\d.]+)" data-out="[\d.]+">(.*?)<\/div>/g)) {
    const at = +b[1], body = b[2], re = /<span class="ln" data-in="([\d.]+)">(.*?)<\/span>/g;
    let last = 0, free = "", r;
    while ((r = re.exec(body))) { free += body.slice(last, r.index); last = re.lastIndex; }
    free += body.slice(last);
    const t = decode(free); if (t) out.push({ sec: id, in: at, text: t });
    for (const l of body.matchAll(/<span class="ln" data-in="([\d.]+)">(.*?)<\/span>/g)) out.push({ sec: id, in: +l[1], text: decode(l[2]) });
  }
  return out;
}
const key = (l) => `${l.sec}@${+l.in}`;

// ---- the cue sheet ----
// line cues: {kind:"line", text, start, end, dur, from, to}; holds: {kind:"hold", name, dur, from, to, cam, sfx?, sfxAt?};
// one {kind:"choice"} between the main film and the Shape it track. Targets are [section id, progress in the section].
function sheet(script, speech) {
  const ci = script.findIndex((l) => key(l) === CHOICE_AT);
  if (ci < 0) throw new Error(`the choice line ${CHOICE_AT} is not in the page`);
  for (const h of [...HOLDS, ...SHAPE_HOLDS]) if (!script.some((l) => key(l) === h.before)) throw new Error(`hold "${h.name}" leads into ${h.before}, which is not in the page`);
  const target = (l) => [l.sec, +(l.in + 0.008).toFixed(3)];
  const main = script.slice(0, ci + 1), shape = script.slice(ci + 1);
  // the time the holds can share: FILM minus speech and gaps, after each hold's minimum
  const speak = main.reduce((a, l, i) => a + speech[i].dur, 0);
  const gaps = main.filter((l, i) => i > 0 && !HOLDS.some((h) => h.before === key(l))).length * GAP;
  const mins = HOLDS.reduce((a, h) => a + h.min, 0), wsum = HOLDS.reduce((a, h) => a + h.w, 0);
  const spare = Math.max(0, FILM - speak - gaps - mins);
  const cues = []; let pos = ["top", 0];
  function hold(h, to, dur) { cues.push({ kind: "hold", name: h.name, dur: +dur.toFixed(2), lead: h.name === "gap" ? GAP_LEAD : LEAD, from: pos, to, cam: h.cam || [0, 0, 0], ...(h.sfx ? { sfx: h.sfx, sfxAt: h.sfxAt } : {}) }); pos = to; }
  function track(list, holds, offset, flexible) {
    list.forEach((l, i) => {
      const own = holds.filter((h) => h.before === key(l)), t = target(l);
      if (own.length) own.forEach((h) => hold(h, h.to || t, h.min + (flexible && wsum ? spare * h.w / wsum : 0)));
      else if (cues.length) hold({ name: "gap" }, t, GAP);
      const next = list[i + 1], s = speech[offset + i];
      // while the line is spoken the scene keeps moving a little toward the next line, never reaching it
      let to = pos;
      if (next && next.sec === l.sec) to = [l.sec, +(pos[1] + Math.min(0.04, 0.4 * (next.in + 0.008 - pos[1]))).toFixed(3)];
      cues.push({ kind: "line", key: key(l), text: l.text, start: s.start, end: s.end, dur: +(s.end - s.start).toFixed(3), from: pos, to });
      pos = to;
    });
  }
  track(main, HOLDS, 0, true);
  const film = cues.reduce((a, c) => a + c.dur, 0);
  cues.push({ kind: "choice", dur: CHOICE_SECONDS, from: pos, to: pos, cam: [0, 0.03, -0.3] });
  track(shape, SHAPE_HOLDS, main.length, false);
  hold(OUTRO, OUTRO.to, OUTRO.min);
  return { cues, film: +film.toFixed(2) };
}

// ---- ElevenLabs ----
async function env() {
  const e = { ...process.env };
  try {
    for (const line of (await readFile(join(ROOT, ".env"), "utf8")).split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in e)) e[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  if (!e.ELEVENLABS_API_KEY || !e.ELEVENLABS_VOICE_ID) throw new Error("set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (environment or .env at the repo root)");
  return { key: e.ELEVENLABS_API_KEY, voice: e.ELEVENLABS_VOICE_ID };
}
async function call(path, body, cred) {
  const res = await fetch(`${API}${path}${path.includes("?") ? "&" : "?"}output_format=${FORMAT}`, { method: "POST", headers: { "xi-api-key": cred.key, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0, 400)}`);
  return res;
}
async function narrate(script, cred) {
  const inputs = script.map((l) => ({ text: `${TAGS[key(l)] ? TAGS[key(l)] + " " : ""}${l.text}`, voice_id: cred.voice }));
  const chars = inputs.reduce((a, i) => a + i.text.length, 0);
  if (chars > 2000) throw new Error(`${chars} characters: over the 2,000 a dialogue request handles reliably`);
  const r = await (await call("/text-to-dialogue/with-timestamps", { model_id: "eleven_v3", inputs }, cred)).json();
  const speech = script.map(() => ({ start: Infinity, end: -Infinity }));
  for (const s of r.voice_segments) { const x = speech[s.dialogue_input_index]; x.start = Math.min(x.start, s.start_time_seconds); x.end = Math.max(x.end, s.end_time_seconds); }
  // a line with no voice segment: find its words in the character alignment instead (the request is paid either way)
  const al = r.alignment, said = al ? al.characters.join("") : "";
  let from = 0;
  speech.forEach((s, i) => {
    const at = said.indexOf(script[i].text, from);
    if (at >= 0) { from = at + script[i].text.length; if (!isFinite(s.start)) { s.start = al.character_start_times_seconds[at]; s.end = al.character_end_times_seconds[from - 1]; } }
    if (!isFinite(s.start)) throw new Error(`no timing for line ${i + 1}: ${script[i].text}`);
    s.start = +s.start.toFixed(3); s.end = +s.end.toFixed(3); s.dur = s.end - s.start;
  });
  return { audio: Buffer.from(r.audio_base64, "base64"), speech };
}

// ---- placeholder audio: synthetic tones, so the player can be built before the voice exists ----
const run = promisify(execFile), RATE = 44100;
async function mp3(name, samples) {
  const pcm = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const raw = join(tmpdir(), `story-${process.pid}-${name}.raw`);
  await writeFile(raw, pcm);
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "s16le", "-ar", String(RATE), "-ac", "1", "-i", raw, "-codec:a", "libmp3lame", "-b:a", "192k", join(OUT, name)]);
  await rm(raw);
}
function synth(seconds, f) { const a = new Float32Array(Math.round(seconds * RATE)); for (let i = 0; i < a.length; i++) a[i] = f(i / RATE); return a; }
async function placeholder(script) {
  // each line is a soft tone as long as the words would take to say (about 2.4 words a second), with short silences between
  const speech = []; let t = 0.3; const parts = [];
  for (const l of script) { const dur = +(l.text.split(/\s+/).length / 2.4 + 0.35).toFixed(3); speech.push({ start: +t.toFixed(3), end: +(t + dur).toFixed(3), dur }); t += dur + 0.4; }
  const voice = synth(t + 0.3, (s) => {
    const x = speech.find((p) => s >= p.start && s < p.end); if (!x) return 0;
    const u = s - x.start, env = Math.min(1, u / 0.04, (x.end - s) / 0.08);
    return 0.18 * env * Math.sin(2 * Math.PI * 330 * s) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 3 * u));
  });
  parts.push(mp3("voice.mp3", voice));
  return { speech, write: async (bedSeconds) => {
    parts.push(mp3("bed.mp3", synth(bedSeconds, (s) => { const env = Math.min(1, s / 4, (bedSeconds - s) / 4); return env * 0.06 * (Math.sin(2 * Math.PI * 110 * s) + 0.6 * Math.sin(2 * Math.PI * 165 * s) + 0.4 * Math.sin(2 * Math.PI * 220.5 * s)) * (0.7 + 0.3 * Math.sin(2 * Math.PI * s / 9)); })));
    let n = 0; parts.push(mp3("sfx-bang.mp3", synth(3, (s) => { n = 0.97 * n + 0.03 * (Math.random() * 2 - 1); return 6 * n * Math.exp(-s * 1.6) * Math.min(1, s / 0.05); })));
    parts.push(mp3("sfx-doors.mp3", synth(2, (s) => 0.5 * Math.sin(2 * Math.PI * 55 * s) * Math.exp(-s * 3.5) * Math.min(1, s / 0.01))));
    await Promise.all(parts);
  } };
}

// ---- main ----
const html = await readFile(join(ROOT, "site/index.html"), "utf8");
const script = [...lines(html, "top"), ...lines(html, "today")];
const words = script.reduce((a, l) => a + l.text.split(/\s+/).length, 0);
console.log(`script: ${script.length} lines, ${words} words, ${script.reduce((a, l) => a + l.text.length, 0)} characters`);

if (args.has("--plan")) {
  const speech = script.map((l) => { const dur = l.text.split(/\s+/).length / 2.4 + 0.35; return { start: 0, end: dur, dur }; });
  const { cues, film } = sheet(script, speech);
  for (const c of cues) console.log(`${c.kind.padEnd(6)} ${String(c.dur.toFixed ? c.dur.toFixed(2) : c.dur).padStart(6)} s  ${c.from.join("@")} → ${c.to.join("@")}  ${c.text || c.name || ""}`);
  console.log(`film to the choice: ${film} s (target ${FILM})`);
  process.exit(0);
}

await mkdir(OUT, { recursive: true });
let speech, placeholderMode = args.has("--placeholder"), finish;
if (placeholderMode) { const p = await placeholder(script); speech = p.speech; finish = p.write; }
else {
  const cred = await env();
  const v = await narrate(script, cred); speech = v.speech;
  await writeFile(join(OUT, "voice.mp3"), v.audio);
  finish = async (bedSeconds) => {
    if (args.has("--voice-only")) return;
    const bed = await call("/music", { prompt: BED_PROMPT, music_length_ms: Math.round(bedSeconds * 1000), model_id: "music_v2_5", force_instrumental: true }, cred);
    await writeFile(join(OUT, "bed.mp3"), Buffer.from(await bed.arrayBuffer()));
    for (const [k, s] of Object.entries(SFX)) {
      const r = await call("/sound-generation", { text: s.text, duration_seconds: s.seconds, prompt_influence: 0.5 }, cred);
      await writeFile(join(OUT, `sfx-${k}.mp3`), Buffer.from(await r.arrayBuffer()));
    }
  };
}
const { cues, film } = sheet(script, speech);
const total = cues.reduce((a, c) => a + c.dur, 0);
await finish(Math.ceil(total + 20)); // the bed covers the film, the whole choice timer and the end, with room to spare
const pilot = {
  version: 1,
  placeholder: placeholderMode, // true: synthetic tones, not a voice; the player says so instead of crediting an AI voice
  generated: new Date().toISOString().slice(0, 10),
  model: placeholderMode ? null : { voice: "eleven_v3 (Text to Dialogue, Voice Design voice)", music: "music_v2_5", format: FORMAT },
  files: { voice: "voice.mp3", bed: "bed.mp3", bang: "sfx-bang.mp3", doors: "sfx-doors.mp3" },
  bedVolume: 0.45,
  film, choiceSeconds: CHOICE_SECONDS,
  cues,
};
await writeFile(join(OUT, "pilot.json"), JSON.stringify(pilot, null, 1) + "\n");
console.log(`wrote site/assets/story/ · film to the choice ${film} s · with the choice and Shape it ${total.toFixed(1)} s${placeholderMode ? " · PLACEHOLDER audio" : ""}`);
