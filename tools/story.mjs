// The auto story's sound and cue sheet, made at build time. The film speaks the page's own words: the .beat / .ln
// text of #top and #today in site/index.html, in order, each line in one of ten Voice Design voices from around the
// world (tools/story-cast.mjs); at the end all ten say the name together. Writes site/assets/story/: voice.mp3 (the lines
// in one Text to Dialogue request with timestamps, then the chorus mixed from a second one), bed.mp3 (Eleven Music,
// instrumental), sfx-bang.mp3 and sfx-doors.mp3 (sound effects), and pilot.json (line cues timed inside voice.mp3 down to
// each letter, hold cues with their lengths, scroll targets and camera moves). Needs ffmpeg; no npm dependencies.
//
// Usage: node tools/story.mjs                generate with ElevenLabs (paid plan: Music API, 192 kbps MP3)
//        node tools/story.mjs --voice-only    regenerate the voices only, keep bed and effects
//        node tools/story.mjs --placeholder   synthetic tones instead of ElevenLabs (needs ffmpeg), for building the player
//        node tools/story.mjs --chorus-only   make the chorus again (20 short takes), keep the lines
//        node tools/story.mjs --resheet       rebuild pilot.json's cue sheet from its own voice timings (after a hold change), call nothing
//        node tools/story.mjs --plan          print the cue sheet with estimated speech, call nothing, write nothing
// Key and voices: ELEVENLABS_API_KEY and ELEVENLABS_CAST (role:voice_id,..., saved by the picker at /__voices on
// tools/dev.mjs) from the environment or an ignored .env at the repo root. ELEVENLABS_VOICE_ID alone gives every line one voice.
// The key is only sent to api.elevenlabs.io; this tool never writes or prints it.
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { ROLES, PLACES, LINES, CHORUS, SPEECH, parseCast, lines, spoken } from "./story-cast.mjs";

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
  { before: "top@0.14", name: "singularity", to: ["top", 0], min: 3, w: 0, cam: [0, 0, -0.2] },
  // the burst ends where the page's bang ends (TUNE.bang) and scrolls at an even speed, so the bang starts at full speed and
  // slows by itself (fieldAt eases it); the line after it barely moves (rest), so the dust it leaves stays while it is said
  { before: "top@0.14", name: "burst", to: ["top", "bang"], ease: "linear", rest: 0.004, min: 4, w: 2, sfx: "bang", sfxAt: 0, cam: [0.1, 0.03, -0.45] },
  { before: "top@0.3", name: "galaxy", min: 6, w: 4, cam: [-0.12, 0.05, -0.5] },
  { before: "top@0.62", name: "web", min: 3, w: 2, cam: [0.1, -0.04, -0.35] },
  { before: "today@0", name: "into capture", min: 3, w: 1.5, cam: [0, 0.04, -0.3] },
  { before: "today@0.3", name: "wells", min: 2.5, w: 1.5, cam: [-0.08, 0, -0.4] },
  { before: "today@0.52", name: "doors", min: 3.5, w: 2, sfx: "doors", sfxAt: 0.7, cam: [0.06, -0.03, -0.25] },
  { before: "today@0.68", name: "dawn", min: 3, w: 1.5, cam: [0, 0.06, -0.35] },
];
// after Shape it: the last beat, then into the start of Open Intelligence (these do not count toward FILM)
const SHAPE_HOLDS = [{ before: "today@0.84", name: "the choice made", min: 2, w: 0, cam: [0, 0, -0.2] }];
const OUTRO = { name: "open intelligence", to: ["oi", 0.03], min: 4, cam: [0, 0, -0.4] };
const BED_PROMPT = "Slow ambient instrumental score for a quiet cosmic opening that turns into dawn: deep warm pads, soft low strings, sparse felt piano, no drums, no vocals. It begins almost silent, swells gently around the middle, grows darker and tighter for a while, then opens into a calm, hopeful, warm ending. It leaves room for a narrator.";
const SFX = {
  bang: { text: "A deep, soft cosmic burst: a low boom swelling out of silence with a long shimmering tail, cinematic, not harsh", seconds: 4 },
  doors: { text: "Heavy doors closing slowly in a vast empty hall, one deep echoing thud, cinematic", seconds: 3 },
};

// the end: the chorus says the name as #oi arrives, then a breath before the end card
const ENDING = { name: "the name settles", min: 5, cam: [0, 0, 0.25] };
const CHORUS_GAP = 0.6; // between "we unfold" and "Open Intelligence"

const key = (l) => `${l.sec}@${+l.in}`;

// ---- the cue sheet ----
// line cues: {kind:"line", key, voice, text, sel, t, start, end, dur, from, to}: t holds the start of each non-space letter
// inside voice.mp3, so the player reveals the page's own letters as they are spoken. Holds: {kind:"hold", name, dur, from,
// to, cam, sfx?, sfxAt?}; one {kind:"choice"} between the main film and the Shape it track. Targets: [section, progress].
function sheet(script, speech, chorus) {
  const BANG = +((/"bang":([\d.]+)/.exec(html) || [])[1] || 0.13); // the page's own TUNE.bang
  for (const h of HOLDS) if (h.to && h.to[1] === "bang") h.to = [h.to[0], BANG];
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
  function hold(h, to, dur) { cues.push({ kind: "hold", name: h.name, dur: +dur.toFixed(2), lead: h.name === "gap" ? GAP_LEAD : LEAD, from: pos, to, cam: h.cam || [0, 0, 0], ...(h.ease ? { ease: h.ease } : {}), ...(h.sfx ? { sfx: h.sfx, sfxAt: h.sfxAt } : {}) }); pos = to; }
  function line(l, s, voice, to) { cues.push({ kind: "line", key: l.key || key(l), voice, text: l.text, sel: l.sel, t: s.t, start: s.start, end: s.end, dur: +(s.end - s.start).toFixed(3), from: pos, to }); pos = to; }
  function track(list, holds, offset, flexible) {
    list.forEach((l, i) => {
      const own = holds.filter((h) => h.before === key(l)), t = target(l);
      if (own.length) own.forEach((h) => hold(h, h.to || t, h.min + (flexible && wsum ? spare * h.w / wsum : 0)));
      else if (cues.length) hold({ name: "gap" }, t, GAP);
      // while the line is spoken the scene keeps moving a little toward the next line, never reaching it
      const next = list[i + 1], rest = own.length ? own[own.length - 1].rest : undefined, drift = rest ?? 0.04;
      line(l, speech[offset + i], LINES[key(l)] || null, next && next.sec === l.sec ? [l.sec, +(pos[1] + Math.min(drift, 0.4 * (next.in + 0.008 - pos[1]))).toFixed(3)] : pos);
    });
  }
  track(main, HOLDS, 0, true);
  const film = cues.reduce((a, c) => a + c.dur, 0);
  cues.push({ kind: "choice", dur: CHOICE_SECONDS, from: pos, to: pos, cam: [0, 0.03, -0.3] });
  track(shape, SHAPE_HOLDS, main.length, false);
  hold(OUTRO, OUTRO.to, OUTRO.min);
  CHORUS.forEach((c, i) => { if (i) hold({ name: "gap" }, pos, CHORUS_GAP); line(c, chorus[i], "all", pos); });
  hold(ENDING, pos, ENDING.min);
  return { cues, film: +film.toFixed(2) };
}

// ---- timing: when each letter is spoken ----
// the start of every non-space letter of `text`, found in a dialogue alignment at or after `from`; null if it is not there
function letters(al, text, from) {
  if (!al) return null;
  const said = al.characters.join(""), at = said.indexOf(text, from);
  if (at < 0) return null;
  const t = []; for (let i = 0; i < text.length; i++) if (!/\s/.test(text[i])) t.push(al.character_start_times_seconds[at + i]);
  return { t, at, next: at + text.length, end: al.character_end_times_seconds[at + text.length - 1] };
}
// no alignment for a line: spread its letters evenly over its time
function spread(text, start, end) { const n = text.replace(/\s/g, "").length; return Array.from({ length: n }, (_, i) => start + (end - start - 0.1) * i / Math.max(1, n)); }
const r3 = (x) => +x.toFixed(3);

// ---- ElevenLabs ----
async function env() {
  const e = { ...process.env };
  try {
    for (const line of (await readFile(join(ROOT, ".env"), "utf8")).split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, ""); // .env wins: it is what the key page and the voice picker wrote
    }
  } catch {}
  if (!e.ELEVENLABS_API_KEY) throw new Error("set ELEVENLABS_API_KEY (environment or .env at the repo root)");
  const cast = parseCast(e.ELEVENLABS_CAST), one = e.ELEVENLABS_VOICE_ID;
  const missing = ROLES.filter((r) => !cast[r.id]).map((r) => r.name);
  if (missing.length && !one) throw new Error(`no voice for ${missing.join(", ")}: pick them at http://localhost:3000/__voices (node tools/dev.mjs)`);
  return { key: e.ELEVENLABS_API_KEY, voiceOf: (role) => cast[role] || one };
}
async function call(path, body, cred) {
  const res = await fetch(`${API}${path}${path.includes("?") ? "&" : "?"}output_format=${FORMAT}`, { method: "POST", headers: { "xi-api-key": cred.key, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0, 400)}`);
  return res;
}
async function dialogue(inputs, cred) {
  const chars = inputs.reduce((a, i) => a + i.text.length, 0);
  if (chars > 2000) throw new Error(`${chars} characters: over the 2,000 a dialogue request handles reliably`);
  return (await call("/text-to-dialogue/with-timestamps", { model_id: SPEECH, inputs }, cred)).json();
}
// every line, each in its own voice, in one request; times and letters come back with the audio
async function narrate(script, cred) {
  for (const l of script) if (!LINES[key(l)]) throw new Error(`line ${key(l)} "${l.text}" has no voice in tools/story-cast.mjs`);
  const r = await dialogue(script.map((l) => ({ text: spoken(LINES[key(l)], key(l), l.text), voice_id: cred.voiceOf(LINES[key(l)]) })), cred);
  const speech = script.map(() => ({ start: Infinity, end: -Infinity }));
  for (const s of r.voice_segments) { const x = speech[s.dialogue_input_index]; x.start = Math.min(x.start, s.start_time_seconds); x.end = Math.max(x.end, s.end_time_seconds); }
  let from = 0;
  speech.forEach((s, i) => {
    const f = letters(r.alignment, script[i].text, from);
    if (f) { from = f.next; if (!isFinite(s.start)) { s.start = f.t[0]; s.end = f.end; } } // a line with no voice segment: its letters still say where it is
    if (!isFinite(s.start)) throw new Error(`no timing for line ${i + 1}: ${script[i].text}`);
    s.t = (f ? f.t : spread(script[i].text, s.start, s.end)).map(r3); s.start = r3(s.start); s.end = r3(s.end); s.dur = s.end - s.start;
  });
  return { audio: Buffer.from(r.audio_base64, "base64"), speech };
}
// the chorus: every voice says each phrase in a request of its own, so no shared timeline can misplace a take. Each take
// is trimmed to where its voice is heard, stretched to the phrase's median length so the syllables meet, then all are mixed
async function chorus(cred, dir) {
  const out = [];
  for (const [p, c] of CHORUS.entries()) {
    const takes = [];
    async function take(i, r, n) { // one at a time: the API limits concurrent requests
      const res = await dialogue([{ text: spoken(r.id, c.key, c.text), voice_id: cred.voiceOf(r.id) }], cred);
      const raw = join(dir, `c${p}-${i}-${n}.mp3`), w = join(dir, `c${p}-${i}-${n}.wav`);
      await writeFile(raw, Buffer.from(res.audio_base64, "base64"));
      await ff(["-i", raw, "-ac", "1", "-ar", "44100", "-af", "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.01,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.06,areverse", w]);
      return { w, dur: await seconds(w), role: r.id };
    }
    for (const [i, r] of ROLES.entries()) takes.push(await take(i, r, 0));
    const med = () => { const l = takes.map((t) => t.dur).sort((a, b) => a - b); return l[l.length >> 1]; };
    // a take far from the others (a breath, a pause mid-phrase, a hurried read) is asked for again, twice at most
    for (let n = 1; n <= 2; n++) for (const [i, r] of ROLES.entries()) if (Math.abs(takes[i].dur / med() - 1) > 0.4) { const again = await take(i, r, n); console.log(`  ${r.id}: ${takes[i].dur.toFixed(2)} s, again: ${again.dur.toFixed(2)} s`); if (Math.abs(again.dur / med() - 1) < Math.abs(takes[i].dur / med() - 1)) takes[i] = again; }
    const lens = takes.map((t) => t.dur).sort((a, b) => a - b), target = med();
    const fitted = [];
    for (const [i, t] of takes.entries()) { const f = join(dir, `c${p}-${i}-fit.wav`); await ff(["-i", t.w, "-af", `atempo=${Math.min(2, Math.max(0.5, t.dur / target)).toFixed(4)}`, f]); fitted.push(f); }
    const wav = join(dir, `chorus-${p}.wav`); await mix(fitted, wav);
    const dur = await seconds(wav); out.push({ wav, dur, t: spread(c.text, 0, dur) });
    console.log(`chorus "${c.text}": ${takes.length} takes from ${lens[0].toFixed(2)} to ${lens[lens.length - 1].toFixed(2)} s, stretched to ${target.toFixed(2)} s`);
  }
  return out;
}
// ten takes into one, a few milliseconds apart as people speaking together are
async function mix(files, out) {
  const chain = files.map((_, i) => `[${i}]adelay=${(i * 7) % 22}[a${i}]`).join(";") + ";" + files.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${files.length}:normalize=0:duration=longest,volume=${(1 / Math.sqrt(files.length)).toFixed(3)},alimiter=limit=0.9[m]`;
  await ff([...files.flatMap((w) => ["-i", w]), "-filter_complex", chain, "-map", "[m]", "-ac", "1", "-ar", "44100", out]);
}
const run = promisify(execFile), RATE = 44100;
function ff(a) { return run("ffmpeg", ["-y", "-loglevel", "error", ...a]); }
// eleven_v4's timestamps can run ahead of its own audio (up to a second by the end of a long dialogue), which cuts a line's
// last words and shows its letters early. So every boundary between two lines is moved to the pause the audio really has
// there, and each line's letter times are stretched to its new span
async function pauses(file, upto) {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-i", file, "-t", String(upto), "-af", "silencedetect=n=-40dB:d=0.08", "-f", "null", "-"]);
  const out = [], re = /silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g; let m;
  while ((m = re.exec(stderr))) out.push([+m[1], +m[2]]);
  return out;
}
// the voice's loudness, 25 values a second, as one letter each ("a" quiet … "z" loud): the player turns it into the level
// the particle field responds to while someone speaks
async function envelope(file) {
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { encoding: "buffer", maxBuffer: 1 << 28 });
  const n = 320, out = []; // 8000 / 25 samples a value
  for (let i = 0; i + n * 2 <= stdout.length; i += n * 2) {
    let e = 0; for (let k = 0; k < n; k++) { const x = stdout.readInt16LE(i + k * 2) / 32768; e += x * x; }
    const db = 10 * Math.log10(e / n + 1e-12); out.push(String.fromCharCode(97 + Math.round(25 * Math.min(1, Math.max(0, (db + 46) / 38)))));
  }
  return { fps: 25, v: out.join("") };
}
// the chorus: ten takes mixed, so no single alignment fits; its letters are spread over where the phrase is really heard
function fitChorus(chorus, sil) {
  return chorus.map((c, i) => {
    const on = (sil.find(([a, e]) => e > c.start - 0.3 && e < c.start + 0.5) || [0, c.start])[1], off = (sil.find(([a]) => a > on + 0.2) || [c.end])[0];
    return { ...c, start: r3(Math.max(0, on - 0.04)), end: r3(off + 0.05), dur: r3(off + 0.09 - on), t: spread(CHORUS[i].text, on, off).map(r3) };
  });
}
function realign(speech, sil) {
  let off = 0, moved = 0;
  const cut = speech.map((s, i) => { // where line i really ends (end) and line i + 1 really starts (next)
    if (i === speech.length - 1) { const e = s.end + off, after = sil.find(([a]) => a > e - 0.4 && a < e + 1.2); return { end: after ? after[0] + 0.05 : e, next: null }; } // the last line: the first pause after it
    const own = sil.find(([a, e]) => s.end >= a - 0.01 && s.end <= e + 0.01); // already in a pause (a second run): keep it, no drift
    if (own) { off = 0; return { end: Math.min(s.end, own[0] + 0.05), next: Math.max(own[0] + 0.05, own[1] - 0.06) }; }
    const b = s.end + off, near = sil.filter(([a, e]) => (a + e) / 2 > b - 0.4 && (a + e) / 2 < b + 1.2).sort((x, y) => Math.abs((x[0] + x[1]) / 2 - b) - Math.abs((y[0] + y[1]) / 2 - b))[0];
    if (!near) return { end: b, next: b };
    off = (near[0] + near[1]) / 2 - s.end; return { end: near[0] + 0.05, next: Math.max(near[0] + 0.05, near[1] - 0.06) };
  });
  const out = speech.map((s, i) => {
    const a = i ? cut[i - 1].next : s.start, e = cut[i].end, k = (e - a) / Math.max(1e-3, s.end - s.start);
    if (Math.abs(a - s.start) > 0.05 || Math.abs(e - s.end) > 0.05) moved++;
    return { ...s, start: r3(a), end: r3(e), dur: r3(e - a), t: s.t.map((x) => r3(a + (x - s.start) * k)) };
  });
  realign.moved = moved; // how many lines moved, for the log
  return out;
}
async function seconds(f) { return +(await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f])).stdout.trim(); }
// voice.mp3: the lines as spoken, a breath, then the chorus; constant bitrate so seeking to a line is exact
async function assemble(linesWav, phrases, dir) {
  const linesDur = await seconds(linesWav), sil = (s) => `anullsrc=r=44100:cl=mono:d=${s}`;
  const seq = [[linesWav], [null, 0.8], ...phrases.flatMap((p, i) => [[p.wav], [null, i < phrases.length - 1 ? CHORUS_GAP : 1]])];
  const inputs = [], filters = []; seq.forEach(([f, s], i) => { if (f) inputs.push("-i", f); else inputs.push("-f", "lavfi", "-i", sil(s)); filters.push(`[${i}]aformat=sample_rates=44100:channel_layouts=mono[s${i}]`); });
  await ff([...inputs, "-filter_complex", filters.join(";") + ";" + seq.map((_, i) => `[s${i}]`).join("") + `concat=n=${seq.length}:v=0:a=1[o]`, "-map", "[o]", "-codec:a", "libmp3lame", "-b:a", "192k", join(OUT, "voice.mp3")]);
  let at = linesDur + 0.8;
  return phrases.map((p, i) => { const start = at; at += p.dur + CHORUS_GAP; return { start: r3(start), end: r3(start + p.dur), dur: r3(p.dur), t: p.t.map((x) => r3(start + x)) }; });
}

// ---- placeholder audio: synthetic tones, so the player can be built before the voice exists ----
async function mp3(name, samples) {
  const pcm = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const raw = join(tmpdir(), `story-${process.pid}-${name}.raw`);
  await writeFile(raw, pcm);
  await ff(["-f", "s16le", "-ar", String(RATE), "-ac", "1", "-i", raw, "-codec:a", "libmp3lame", "-b:a", "192k", join(OUT, name)]);
  await rm(raw);
}
function synth(seconds, f) { const a = new Float32Array(Math.round(seconds * RATE)); for (let i = 0; i < a.length; i++) a[i] = f(i / RATE); return a; }
async function placeholder(script) {
  // each line is a soft tone as long as the words would take to say (about 2.4 words a second), with short silences between;
  // the chorus is a chord
  const speech = [], chorusSpeech = []; let t = 0.3;
  for (const l of [...script, ...CHORUS]) {
    const dur = +(l.text.split(/\s+/).length / 2.4 + 0.35).toFixed(3), s = { start: r3(t), end: r3(t + dur), dur, t: spread(l.text, t, t + dur).map(r3) };
    (CHORUS.includes(l) ? chorusSpeech : speech).push(s); t += dur + 0.4;
  }
  const all = [...speech, ...chorusSpeech];
  await mp3("voice.mp3", synth(t + 0.3, (s) => {
    const x = all.find((p) => s >= p.start && s < p.end); if (!x) return 0;
    const u = s - x.start, env = Math.min(1, u / 0.04, (x.end - s) / 0.08), f = chorusSpeech.includes(x) ? [262, 330, 392] : [330];
    return 0.18 / f.length * env * f.reduce((a, hz) => a + Math.sin(2 * Math.PI * hz * s), 0) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 3 * u));
  }));
  return { speech, chorusSpeech, write: async (bedSeconds) => {
    await mp3("bed.mp3", synth(bedSeconds, (s) => { const env = Math.min(1, s / 4, (bedSeconds - s) / 4); return env * 0.06 * (Math.sin(2 * Math.PI * 110 * s) + 0.6 * Math.sin(2 * Math.PI * 165 * s) + 0.4 * Math.sin(2 * Math.PI * 220.5 * s)) * (0.7 + 0.3 * Math.sin(2 * Math.PI * s / 9)); }));
    let n = 0; await mp3("sfx-bang.mp3", synth(3, (s) => { n = 0.97 * n + 0.03 * (Math.random() * 2 - 1); return 6 * n * Math.exp(-s * 1.6) * Math.min(1, s / 0.05); }));
    await mp3("sfx-doors.mp3", synth(2, (s) => 0.5 * Math.sin(2 * Math.PI * 55 * s) * Math.exp(-s * 3.5) * Math.min(1, s / 0.01)));
  } };
}

// ---- main ----
const html = await readFile(join(ROOT, "site/index.html"), "utf8");
const script = [...lines(html, "top"), ...lines(html, "today")];
const words = script.reduce((a, l) => a + l.text.split(/\s+/).length, 0);
console.log(`script: ${script.length} lines, ${words} words, ${script.reduce((a, l) => a + l.text.length, 0)} characters; then the chorus: ${CHORUS.map((c) => c.text).join(" · ")}`);

if (args.has("--plan")) {
  const est = (l) => { const dur = l.text.split(/\s+/).length / 2.4 + 0.35; return { start: 0, end: dur, dur, t: [] }; };
  const { cues, film } = sheet(script, script.map(est), CHORUS.map(est));
  for (const c of cues) console.log(`${c.kind.padEnd(6)} ${String(c.dur.toFixed ? c.dur.toFixed(2) : c.dur).padStart(6)} s  ${c.from.join("@")} → ${c.to.join("@")}  ${c.text || c.name || ""}`);
  console.log(`film to the choice: ${film} s (target ${FILM})`);
  process.exit(0);
}

await mkdir(OUT, { recursive: true });
let chorusNew = null;
if (args.has("--chorus-only")) { // the lines stay as they are; the chorus is made again and voice.mp3 put back together
  const old = JSON.parse(await readFile(join(OUT, "pilot.json"), "utf8")), cred = await env(), dir = await mkdtemp(join(tmpdir(), "story-"));
  const lastEnd = old.cues.filter((c) => c.kind === "line" && c.voice !== "all").pop().end, linesWav = join(dir, "lines.wav");
  await ff(["-i", join(OUT, old.files.voice), "-t", String(lastEnd + 0.25), "-ac", "1", "-ar", "44100", linesWav]);
  chorusNew = await assemble(linesWav, await chorus(cred, dir), dir);
  await rm(dir, { recursive: true, force: true });
}
if (args.has("--resheet") || chorusNew) { // the voice stays as it is: its line timings come back out of pilot.json
  const old = JSON.parse(await readFile(join(OUT, "pilot.json"), "utf8")), said = old.cues.filter((c) => c.kind === "line");
  const of = (k) => { const c = said.find((x) => x.key === k); if (!c) throw new Error(`pilot.json has no line ${k}: regenerate the voice`); return { start: c.start, end: c.end, dur: c.dur, t: c.t }; };
  const said2 = realign(script.map((l) => of(key(l))), await pauses(join(OUT, old.files.voice), said.filter((c) => c.voice !== "all").pop().end + 1.5));
  console.log(`${realign.moved} of ${said2.length} lines moved to the audio's own pauses`);
  const voiceSil = await pauses(join(OUT, old.files.voice), 1e4);
  const { cues, film } = sheet(script, said2, fitChorus(chorusNew || CHORUS.map((c) => of(c.key)), voiceSil));
  const total = cues.reduce((a, c) => a + c.dur, 0);
  const env = await envelope(join(OUT, old.files.voice));
  await writeFile(join(OUT, "pilot.json"), JSON.stringify({ ...old, film, env, places: PLACES, cues }, null, 1).replace(/\[\n\s+([-\d.,\s]+?)\n\s+\]/g, (m, x) => `[${x.replace(/\s+/g, " ")}]`) + "\n");
  console.log(`rebuilt the cue sheet · film to the choice ${film} s · with the choice, Shape it and the name ${total.toFixed(1)} s`);
  process.exit(0);
}
const placeholderMode = args.has("--placeholder");
let speech, chorusSpeech, finish;
if (placeholderMode) { const p = await placeholder(script); speech = p.speech; chorusSpeech = p.chorusSpeech; finish = p.write; }
else {
  const cred = await env(), dir = await mkdtemp(join(tmpdir(), "story-"));
  const [v, phrases] = await Promise.all([narrate(script, cred), chorus(cred, dir)]);
  speech = v.speech;
  const linesMp3 = join(dir, "lines.mp3"), linesWav = join(dir, "lines.wav");
  await writeFile(linesMp3, v.audio); await ff(["-i", linesMp3, "-ac", "1", "-ar", "44100", linesWav]);
  speech = realign(speech, await pauses(linesWav, 1e4)); console.log(`${realign.moved} of ${speech.length} lines moved to the audio\'s own pauses`);
  chorusSpeech = await assemble(linesWav, phrases, dir);
  chorusSpeech = fitChorus(chorusSpeech, await pauses(join(OUT, "voice.mp3"), 1e4));
  await rm(dir, { recursive: true, force: true });
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
const { cues, film } = sheet(script, speech, chorusSpeech);
const total = cues.reduce((a, c) => a + c.dur, 0);
await finish(Math.ceil(total + 20)); // the bed covers the film, the whole choice timer and the end, with room to spare
const pilot = {
  version: 2,
  placeholder: placeholderMode, // true: synthetic tones, not a voice; the player says so instead of crediting an AI voice
  generated: new Date().toISOString().slice(0, 10),
  model: placeholderMode ? null : { voice: `${SPEECH} (Text to Dialogue, Voice Design voices)`, music: "music_v2_5", format: FORMAT },
  voices: ROLES.length, // how many voices speak: the bar credits "AI-generated voices"
  files: { voice: "voice.mp3", bed: "bed.mp3", bang: "sfx-bang.mp3", doors: "sfx-doors.mp3" },
  bedVolume: 0.45,
  env: await envelope(join(OUT, "voice.mp3")),
  places: PLACES, // where each voice lights the field (x, y in −1…1)
  film, choiceSeconds: CHOICE_SECONDS,
  cues,
};
await writeFile(join(OUT, "pilot.json"), JSON.stringify(pilot, null, 1).replace(/\[\n\s+([-\d.,\s]+?)\n\s+\]/g, (m, x) => `[${x.replace(/\s+/g, " ")}]`) + "\n"); // number lists on one line
console.log(`wrote site/assets/story/ · film to the choice ${film} s · with the choice, Shape it and the name ${total.toFixed(1)} s${placeholderMode ? " · PLACEHOLDER audio" : ""}`);
