import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, mkdir, cp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { shiftCues, replaceLine, segmentBounds, ffmpegPlan, takeBounds } from "./story-line.mjs";
import { lines, CHORUS } from "./story-cast.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), ".."), run = promisify(execFile);
const line = (key, start, end, kind = "line") => ({ kind, key, start, end, dur: end - start, text: "Old", t: [start, start + 0.1] });
const fixture = [line("a", 0, 1), { kind: "hold", dur: 2 }, line("b", 2, 4), line("c", 5, 6), line("chorus", 7, 8, "chorus")];
const take = { text: "New words.", voice_segments: [{ dialogue_input_index: 0, start_time_seconds: 0.3, end_time_seconds: 2.3 }] };

for (const delta of [1.2345, -0.4567]) test(`shift only later speech, delta ${delta}`, () => {
  const before = structuredClone(fixture), shifted = shiftCues(fixture, "b", delta), round = (x) => +x.toFixed(3);
  assert.deepEqual(fixture, before);
  assert.deepEqual(shifted.slice(0, 3), before.slice(0, 3));
  for (let i = 3; i < shifted.length; i++) {
    assert.equal(shifted[i].start, round(before[i].start + delta));
    assert.equal(shifted[i].end, round(before[i].end + delta));
    assert.deepEqual(shifted[i].t, before[i].t.map((t) => round(t + delta)));
    assert.equal(shifted[i].dur, before[i].dur);
  }
  assert.throws(() => shiftCues(fixture, "missing", delta), /no line/);
});

for (const aligned of [false, true]) test(`replacement times use ${aligned ? "alignment" : "spread fallback"}`, () => {
  const text = "New words.", characters = Array.from(`[quiet] ${text}`), at = 8;
  const alignment = { characters, character_start_times_seconds: characters.map((_, i) => 0.3 + (i - at) * 0.15), character_end_times_seconds: characters.map((_, i) => 0.45 + (i - at) * 0.15) };
  const original = line("b", 3, 4), replacement = replaceLine(original, { ...take, ...(aligned ? { alignment } : {}) }, text);
  assert.equal(original.text, "Old");
  assert.equal(replacement.text, text);
  assert.equal(replacement.start, 3);
  assert.equal(replacement.end, 5);
  assert.equal(replacement.dur, 2);
  assert.equal(replacement.t.length, text.replace(/\s/g, "").length);
  replacement.t.forEach((t, i, ts) => { assert.ok(t >= replacement.start && t <= replacement.end); if (i) assert.ok(t >= ts[i - 1]); });
  if (aligned) assert.deepEqual(replacement.t, [3, 3.15, 3.3, 3.6, 3.75, 3.9, 4.05, 4.2, 4.35]);
});

test("segment cut keeps original gaps; plan decodes, trims, matches loudness and encodes CBR", () => {
  const bounds = segmentBounds(fixture, "b", 9);
  assert.deepEqual(bounds, { cue: fixture[2], start: 1, end: 5, gapBefore: 1, gapAfter: 1 });
  assert.equal(segmentBounds(fixture, "a", 9).start, 0);
  assert.equal(segmentBounds(fixture, "chorus", 9).end, 9);
  const plan = ffmpegPlan(bounds, take, { voice: "voice.mp3", decoded: "voice.wav", take: "1.mp3", trimmed: "take.wav", output: "out.mp3" }, -18.5);
  assert.ok(plan.decode.includes("voice.wav"));
  assert.match(plan.measure.join(" "), /atrim=start=2:end=4,loudnorm/);
  assert.match(plan.trim.join(" "), /atrim=start=0.3:end=2.3.*loudnorm=I=-18.5/);
  assert.match(plan.concat.join(" "), /atrim=start=1:end=2/);
  assert.match(plan.concat.join(" "), /atrim=start=4:end=5/);
  assert.match(plan.concat.join(" "), /libmp3lame -b:a 192k/);
  assert.throws(() => takeBounds({}, "missing"), /no valid voice timing/);
  assert.throws(() => segmentBounds([line("a", 0, 3), line("b", 2, 4)], "b", 5), /invalid bounds/);
});

test("offline takes and splice on copied assets; page and all 21 cues agree", { timeout: 120000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "story-line-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const out = join(root, "site/assets/story");
  await mkdir(join(root, "site"), { recursive: true });
  await cp(join(ROOT, "site/assets/story"), out, { recursive: true });
  const html = await readFile(join(ROOT, "site/index.html"), "utf8"), text = "Contributing to intelligence does not yet give everyone a meaningful say in its future.";
  const page = html.replace(/(<section id="today"[\s\S]*?<div class="beat" data-in="0.14" data-out="[\d.]+">)[\s\S]*?(<\/div>)/, `$1${text}$2`);
  assert.notEqual(page, html);
  await writeFile(join(root, "site/index.html"), page);
  // Abort and record any attempted network/credential access. Child processes
  // inherit this preload and only non-ELEVENLABS environment variables.
  const preload = join(root, "offline.mjs"), attempts = join(root, "forbidden-access.txt");
  await writeFile(preload, `
import fs from 'node:fs';
import promises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const fail = (kind) => { fs.appendFileSync(${JSON.stringify(attempts)}, kind + '\\n'); throw new Error('forbidden offline access: ' + kind); };
globalThis.fetch = () => fail('fetch');
const read = promises.readFile;
promises.readFile = (path, ...args) => /(^|[\\/])\\.env[^\\/]*$/.test(String(path)) ? fail('credential file') : read(path, ...args);
syncBuiltinESMExports();
process.env = new Proxy(process.env, { get(target, name) { if (String(name).startsWith('ELEVENLABS_')) return fail('credential environment'); return target[name]; } });
`);
  const env = Object.fromEntries(Object.keys(process.env).filter((k) => !k.startsWith("ELEVENLABS_")).map((k) => [k, process.env[k]]));
  env.STORY_ROOT = root;
  const invoke = (...args) => run(process.execPath, ["--import", preload, join(ROOT, "tools/story.mjs"), ...args], { env });
  const hash = async (name) => createHash("sha256").update(await readFile(join(out, name))).digest("hex");
  const assets = ["voice.mp3", "pilot.json", "bed.mp3", "sfx-bang.mp3", "sfx-doors.mp3"], hashes = await Promise.all(assets.map(hash));
  const old = JSON.parse(await readFile(join(out, "pilot.json"))), k = "today@0.14", oldLine = old.cues.find((c) => c.key === k);
  const probe = async () => JSON.parse((await run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-show_packets", "-show_entries", "packet=size:stream=sample_rate,channels,bit_rate:format=duration", "-of", "json", join(out, "voice.mp3")])).stdout);
  const before = await probe();
  const generated = await invoke("--line", k, "--placeholder");
  assert.match(generated.stdout, /saved 3 synthetic takes/);
  assert.deepEqual(await Promise.all(assets.map(hash)), hashes, "generation must not touch assets");
  for (const i of [1, 2, 3]) {
    const saved = JSON.parse(await readFile(join(out, `.takes/${k}/${i}.json`)));
    assert.equal(saved.text, text); assert.ok((await readFile(join(out, `.takes/${k}/${i}.mp3`))).length > 0);
  }
  const saved = JSON.parse(await readFile(join(out, `.takes/${k}/1.json`))), delta = takeBounds(saved, text).dur - oldLine.dur;
  const spliced = await invoke("--line", k, "--take", "1");
  assert.match(spliced.stdout, /spliced today@0.14 take 1/);
  assert.match(spliced.stdout, /rebuilt the cue sheet/);
  const after = await probe(), pilot = JSON.parse(await readFile(join(out, "pilot.json")));
  assert.equal(after.streams[0].sample_rate, "44100"); assert.equal(after.streams[0].channels, 1); assert.equal(after.streams[0].bit_rate, "192000");
  assert.ok(after.packets.every((p) => [626, 627].includes(+p.size)), "every MP3 frame has the 192k CBR size");
  assert.ok(Math.abs(+after.format.duration - +before.format.duration - delta) < 0.06);
  const script = [...lines(page, "top"), ...lines(page, "today"), ...CHORUS], said = pilot.cues.filter((c) => c.kind === "line");
  assert.equal(said.length, 21);
  for (const l of script) {
    const cue = said.find((c) => c.key === (l.key || `${l.sec}@${l.in}`));
    assert.equal(cue.text, l.text); assert.equal(cue.t.length, l.text.replace(/\s/g, "").length);
    cue.t.forEach((time, i) => { assert.ok(time >= cue.start && time <= cue.end, cue.key); if (i) assert.ok(time >= cue.t[i - 1]); });
  }
  // Resheet may adjust boundaries to pauses by a few milliseconds.
  for (const key of ["today@0.3", "today@0.92", "oi@we", "oi@name"]) {
    const a = old.cues.find((c) => c.key === key), b = said.find((c) => c.key === key);
    assert.ok(Math.abs(b.start - a.start - delta) < 0.15, `${key} shifts by ${delta}: ${b.start - a.start}`);
  }
  assert.ok(Math.abs(pilot.film - 90) < 0.5);
  assert.equal(pilot.generated, new Date().toISOString().slice(0, 10));
  assert.deepEqual(pilot.model, old.model);
  assert.equal(pilot.env.fps, 25); assert.notEqual(pilot.env.v, old.env.v);
  assert.deepEqual(await Promise.all(assets.slice(2).map(hash)), hashes.slice(2));
  for (const args of [["--line", "../invalid", "--placeholder"], ["--line", k, "--takes", "0"], ["--line", k, "--take", "1", "--placeholder"], ["--take", "1"], ["--line", k, "--takes"], ["--line", k, "--plan"]]) {
    await assert.rejects(invoke(...args));
  }
  await writeFile(join(root, "site/index.html"), page.replace(text, "A changed line."));
  await assert.rejects(invoke("--line", k, "--take", "1"), /take does not match the page/);
  await assert.rejects(readFile(attempts), { code: "ENOENT" });
  t.diagnostic(`delta ${delta.toFixed(3)} s; film ${pilot.film} s; CBR 192k/44100/mono; all 21 line counts match; zero forbidden accesses`);
});
