// The auto story's ten success criteria (private design, "Success Criteria"), checked in a real browser. Exits 1 if any fails.
// Three runs: 1440×900 in real time (length, takeover, choice → Shape it → end card, captions, sound, network, camera),
// 375×812 with touch (takeover by tap, choice → Read the charter first), and reduced motion. Then tools/chk2.js (criterion 8).
// Usage: R=$(npm root -g) [URL=http://localhost:3000/] [CHROME=/path/to/chrome-headless-shell] node tools/chk-story.js
// Takes about four minutes: the first run plays the film at its own speed.
const { chromium } = require(process.env.R + '/playwright');
const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const PAGE = process.env.URL || 'http://localhost:3000/';
const ROOT = path.join(__dirname, '..');
const results = [];
function check(id, ok, what) { results.push({ id, ok: !!ok, what }); console.log(`${ok ? 'pass' : 'FAIL'}  ${id}  ${what}`); }
const ARGS = ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'];

// in-page recorder: per frame the largest camera step and the wall time spent playing; every caption change with the
// voice's clock at that moment; in reduced motion, the cue and scrollY of every frame
const RECORDER = () => {
  const S = window.__wuStory, cap = document.getElementById('storyCap');
  const rec = window.__rec = { maxCamStep: 0, camStepAt: null, playWall: 0, caps: [], frames: [], keepFrames: false };
  let prev = null, lastNow = null;
  (function f(now) {
    const s = S.state();
    if (prev) {
      const d = Math.hypot(s.cam[0] - prev.cam[0], s.cam[1] - prev.cam[1], s.cam[2] - prev.cam[2]);
      if (d > rec.maxCamStep) { rec.maxCamStep = d; rec.camStepAt = s.t; }
      if (prev.playing && s.playing) rec.playWall += (now - lastNow) / 1000;
      if (rec.keepFrames && s.playing) rec.frames.push([s.k, Math.round(scrollY), Math.hypot(s.cam[0], s.cam[1], s.cam[2])]);
    }
    prev = s; lastNow = now; requestAnimationFrame(f);
  })(performance.now());
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, () => { rec.inputY = scrollY; }, { capture: true, passive: true }));
  new MutationObserver(() => { const s = S.state(); rec.caps.push({ text: cap.hidden ? '' : cap.textContent, vt: s.voice && s.voice.t, from: s.voice && s.voice.from, k: s.k }); })
    .observe(cap, { childList: true, characterData: true, subtree: true, attributes: true });
};
const frames = (p, n) => p.evaluate((n) => new Promise((r) => { let i = 0; (function f() { if (++i > n) r(); else requestAnimationFrame(f); })(); }), n);
const state = (p) => p.evaluate(() => window.__wuStory.state());
const waitFor = (p, fn, arg, timeout) => p.waitForFunction(fn, arg, { timeout: timeout || 150000, polling: 100 });

async function open(b, opts) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(PAGE); await waitFor(p, () => window.__wuStory && window.__wuStory.state().ready, null, 20000);
  await p.evaluate(() => { const t = document.getElementById('wu-tune'); if (t) t.remove(); }); // tools/dev.mjs's tuning panel is not part of the site
  await p.waitForTimeout(1500);
  return { ctx, p, errs };
}
// the Play button: visible on the first screen and focusable
async function playButton(p, tag) {
  const r = await p.evaluate(() => { const b = document.getElementById('storyPlay'), r = b.getBoundingClientRect(), cs = getComputedStyle(b); b.focus(); return { shown: !b.hidden && r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.bottom <= innerHeight && r.right <= innerWidth, focus: document.activeElement === b, h: r.height }; });
  check('9 Play', r.shown && r.focus && r.h >= 32, `${tag}: Play is visible (${r.shown}), focusable (${r.focus}), ${r.h.toFixed(0)} px tall`);
}
// one takeover: send the input, then the film must be paused with every sound stopped and the page left where it is
async function takeover(p, label, kind, send, minT) { // kind: take over during a spoken line or a hold, after minT s of film
  await waitFor(p, ([kind, minT]) => { const s = window.__wuStory.state(); return s.playing && s.t >= minT && s.kind === kind && (kind !== 'line' || (s.voice && !s.voice.paused)); }, [kind, minT || 0], 60000);
  await frames(p, 2);
  await p.evaluate(() => { window.__rec.inputY = null; });
  const sent = await send(); // an input event, or a scroll that returns where it left the page
  await frames(p, 1);
  const s1 = await state(p), ys = [];
  for (let i = 0; i < 5; i++) { await frames(p, 1); ys.push(await p.evaluate(() => scrollY)); }
  // the page must stay where it was when the input arrived; a wheel moves it a little by itself (its own scroll)
  const at = typeof sent === 'number' ? sent : await p.evaluate(() => window.__rec.inputY);
  const slack = label === 'wheel' ? 12 : 3, want = at, still = at !== null && ys.every((y) => y === ys[0]) && Math.abs(ys[0] - want) <= slack;
  check('2 takeover', !s1.playing && s1.voice.paused && !s1.bed && still, `${label}: paused (${!s1.playing}), sound stopped (${s1.voice.paused && !s1.bed}), page stays at ${want} (${ys.join(',')})`);
  await p.waitForTimeout(500);
  const c = (await state(p)).cam;
  check('10 camera', c.every((x) => x === 0), `${label}: camera offset is zero 500 ms after the pause (${c.map((x) => x.toFixed(4))})`);
  // resume from here: the page must not jump back to where the film paused
  await p.click('#sbPlay'); await frames(p, 2);
  const s2 = await state(p), y2 = await p.evaluate(() => scrollY);
  check('2 resume', s2.playing && y2 >= ys[4] - 3 && y2 - ys[4] < 60, `${label}: the bar's play resumes from the current position (${ys[4]} → ${y2})`);
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ARGS });
  const pilot = await (await fetch(PAGE + 'assets/story/pilot.json')).json();

  // ---------------- run 1: 1440×900, real time ----------------
  {
    const { ctx, p, errs } = await open(b, { viewport: { width: 1440, height: 900 } });
    const origin = new URL(PAGE).origin; let net = true; const foreign = [];
    p.on('request', (r) => { if (!net) return; const u = r.url(); if (/^(data|blob):/.test(u)) return; const o = new URL(u); if (o.origin !== origin && !/^fonts\.(gstatic|googleapis)\.com$/.test(o.hostname)) foreign.push(u); });
    net = false;
    await playButton(p, '1440×900');
    // criterion 6 of the design's honesty: every line the narrator says is still on the page
    const missing = await p.evaluate(() => { const bare = (s) => s.replace(/\s+/g, ''), txt = bare(document.getElementById('top').textContent + document.getElementById('today').textContent); return window.__wuStory.cues().filter((c) => c.kind === 'line' && !txt.includes(bare(c.text))).map((c) => c.text); }); // <br> leaves no space in textContent
    check('8 script', missing.length === 0, `every narrated line is on the page${missing.length ? ': missing ' + missing.join(' | ') : ''}`);
    const before = await p.evaluate(() => ({ media: [...document.querySelectorAll('audio,video')].every((m) => m.paused || m.muted), s: window.__wuStory.state() }));
    check('5 no sound', before.media && before.s.voice === null && !before.s.bed && before.s.cam.every((x) => x === 0), 'nothing plays before Play, and the camera offset is zero');
    await p.evaluate(RECORDER);
    net = true; await p.click('#storyPlay'); await frames(p, 3);
    const ui = await p.evaluate(() => { const v = (id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return !e.hidden && r.width > 0 && r.bottom <= innerHeight; }; return { bar: v('storyBar'), mute: v('sbMute'), credit: v('sbCredit'), text: document.getElementById('sbCredit').textContent }; });
    const creditOk = pilot.placeholder ? /placeholder/i.test(ui.text) : ui.text === 'AI-generated voice';
    check('5 bar', ui.bar && ui.mute && ui.credit && creditOk, `player bar, mute and credit visible: "${ui.text}"${pilot.placeholder ? ' (placeholder audio: the real credit appears once the voice is generated)' : ''}`);
    // the bar's own controls never count as a takeover
    await waitFor(p, () => window.__wuStory.state().t > 5, null, 30000);
    await p.click('#sbMute'); await frames(p, 3); const m1 = await state(p);
    await p.click('#sbCap'); await p.click('#sbCap'); await p.click('#sbMute'); await frames(p, 3); const m2 = await state(p);
    check('2 bar', m1.playing && m2.playing, 'mute and captions keep it playing');
    await takeover(p, 'wheel', 'line', async () => { await p.mouse.move(700, 450); await p.mouse.wheel(0, 2); }); // a wheel lands where the mouse is
    await takeover(p, 'key', 'hold', async () => { await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('KeyA'); }); // keys inside the bar are the bar's
    await takeover(p, 'pointer', 'line', async () => { await p.mouse.move(700, 300); await p.mouse.down(); await p.mouse.up(); });
    await takeover(p, 'scroll the player did not make', 'hold', () => p.evaluate(() => { window.scrollBy({ top: 50, behavior: 'instant' }); return scrollY; }));
    // to the choice
    await waitFor(p, () => window.__wuStory.state().kind === 'choice', null, 160000);
    const at = await p.evaluate(() => ({ s: window.__wuStory.state(), wall: window.__rec.playWall }));
    check('1 length', at.s.t >= 75 && at.s.t <= 105 && at.wall >= 75 && at.wall <= 105, `Play to the choice: ${at.s.t.toFixed(1)} s of film, ${at.wall.toFixed(1)} s of playing wall time (75–105)`);
    const ch = await p.evaluate(() => { const v = (id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return !e.hidden && r.width > 0; }; return { shape: v('scShape'), read: v('scRead'), ring: v('scRing') }; });
    await p.waitForTimeout(1200);
    const o1 = +(await p.getAttribute('#scRing', 'stroke-dashoffset'));
    await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('KeyA'); await frames(p, 2);
    const o2 = +(await p.getAttribute('#scRing', 'stroke-dashoffset')); await p.waitForTimeout(1500);
    const o3 = +(await p.getAttribute('#scRing', 'stroke-dashoffset')), paused = await state(p);
    check('3 choice', ch.shape && ch.read && ch.ring && o1 > 0, `both options and the timer ring are shown (ring at ${o1})`);
    check('3 timer', !paused.playing && o2 === o3 && paused.kind === 'choice', `pausing stops the timer (${o2} → ${o3} over 1.5 s)`);
    await p.click('#sbPlay');
    await waitFor(p, () => { const s = window.__wuStory.state(); return s.picked === 'shape'; }, null, 15000);
    const sp = await p.evaluate(() => ({ s: window.__wuStory.state(), choice: document.getElementById('storyChoice').hidden }));
    await waitFor(p, () => !document.getElementById('storyEnd').hidden, null, 60000);
    net = false;
    const end = await p.evaluate(() => ({ href: document.getElementById('seInvite').getAttribute('href'), keep: !!document.getElementById('seKeep'), bar: document.getElementById('storyBar').hidden, oi: document.getElementById('oi').getBoundingClientRect().top }));
    check('3 Shape it', sp.choice && end.href === '#invite' && end.keep && end.bar && Math.abs(end.oi) < 120, `no pick plays Shape it, then the end card (keep scrolling · ${end.href}); the film ends at #oi (top ${end.oi.toFixed(0)})`);
    await p.waitForTimeout(600);
    const rec = await p.evaluate(() => ({ max: window.__rec.maxCamStep, at: window.__rec.camStepAt, caps: window.__rec.caps, cam: window.__wuStory.state().cam }));
    check('10 camera', rec.max <= 0.02 + 1e-9 && rec.cam.every((x) => x === 0), `largest camera change in one frame ${rec.max.toFixed(4)} (≤ 0.02, at t ${rec.at && rec.at.toFixed(1)}); zero after the film`);
    // captions: each line's caption appears while its own audio plays, within 150 ms of the line's start
    const lines = pilot.cues.filter((c) => c.kind === 'line'), late = [], seen = new Set();
    for (const c of rec.caps) {
      if (!c.text || seen.has(c.text)) continue; seen.add(c.text);
      const l = lines.find((x) => x.text === c.text); if (!l) { late.push(`unknown caption "${c.text}"`); continue; }
      // measured from where the voice started this line: its start, or mid-line after a takeover resumed there
      const from = c.from >= l.start - 0.01 && c.from < l.end ? c.from : l.start, d = c.vt - from;
      if (!(d >= -0.15 && d <= 0.15)) late.push(`"${l.text}" ${(d * 1000).toFixed(0)} ms`);
    }
    check('4 captions', late.length === 0 && seen.size >= lines.length - 1, `${seen.size} of ${lines.length} lines captioned, all within 150 ms of their audio${late.length ? ': ' + late.join(', ') : ''}`);
    check('7 network', foreign.length === 0, `no request beyond the site's own files while playing${foreign.length ? ': ' + foreign.slice(0, 3).join(' ') : ''}`);
    check('errors', errs.length === 0, `no page errors at 1440×900${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
    await ctx.close();
  }

  // ---------------- run 2: 375×812, touch; Read the charter first ----------------
  {
    const { ctx, p, errs } = await open(b, { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await playButton(p, '375×812');
    await p.evaluate(RECORDER);
    await p.tap('#storyPlay'); await frames(p, 3);
    const w = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    check('9 375', w, 'no sideways scroll at 375 px while playing');
    await takeover(p, 'touch', 'hold', () => p.touchscreen.tap(180, 300), 12);
    await p.evaluate(() => { const s = window.__wuStory; s.seek(s.state().film - 4); });
    await waitFor(p, () => window.__wuStory.state().kind === 'choice', null, 30000);
    const fit = await p.evaluate(() => { const r = document.getElementById('storyChoice').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0; });
    await p.tap('#scRead'); await frames(p, 3);
    const rd = await p.evaluate(() => { const secs = [...document.getElementById('book').content.querySelectorAll('section')]; return { want: secs.findIndex((s) => s.getAttribute('data-title') === 'How we work'), ch: window.__wuReader.state().ch, open: !document.getElementById('reader').hidden, s: window.__wuStory.state(), bar: document.getElementById('storyBar').hidden }; });
    await p.waitForTimeout(3000);
    const bed = (await state(p)).bed;
    check('3 Read', fit && rd.open && rd.want >= 0 && rd.ch === rd.want && !rd.s.on && rd.bar && !bed, `Read the charter first: the film ends, the bed fades out (${!bed}), the reader opens at "How we work" (ch ${rd.ch} of index ${rd.want}); the choice fits 375 px (${fit})`);
    const rec = await p.evaluate(() => window.__rec.maxCamStep);
    check('10 camera', rec <= 0.02 + 1e-9, `375×812: largest camera change in one frame ${rec.toFixed(4)}`);
    check('errors', errs.length === 0, `no page errors at 375×812${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
    await ctx.close();
  }

  // ---------------- run 3: reduced motion ----------------
  {
    const { ctx, p, errs } = await open(b, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await p.evaluate(RECORDER); await p.evaluate(() => { window.__rec.keepFrames = true; });
    await p.click('#storyPlay'); await p.evaluate(() => window.__wuStory.rate(4));
    await waitFor(p, () => window.__wuStory.state().kind === 'choice', null, 90000);
    const f = await p.evaluate(() => window.__rec.frames), caps = await p.evaluate(() => window.__rec.caps.filter((c) => c.text).length);
    let moves = 0, bad = 0, cam = 0;
    for (let i = 1; i < f.length; i++) { cam = Math.max(cam, f[i][2]); if (f[i][1] !== f[i - 1][1]) { moves++; if (f[i][0] === f[i - 1][0]) bad++; } }
    check('6 reduced', cam === 0 && bad === 0 && moves > 5 && caps > 5, `reduced motion: camera offset stays 0 (${cam}), scrollY changes only at cue starts (${moves} jumps, ${bad} mid-cue), ${caps} captions`);
    check('errors', errs.length === 0, `no page errors in reduced motion${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
    await ctx.close();
  }
  await b.close();

  // ---------------- no key in the repo or the page ----------------
  const g = spawnSync('git', ['grep', '-n', '-I', '-E', 'sk_[A-Za-z0-9]{24,}|xi-api-key: *[A-Za-z0-9]{16,}'], { cwd: ROOT, encoding: 'utf8' });
  const page = require('fs').readFileSync(path.join(ROOT, 'site/index.html'), 'utf8');
  check('7 key', g.status === 1 && !/elevenlabs\.io\/v1|xi-api-key/.test(page), `no API key in the repo (git grep: ${g.status === 1 ? 'nothing' : g.stdout.split('\n')[0]}) and no API call in the page`);

  // ---------------- criterion 8: the scroll experience is unchanged ----------------
  const c2 = spawnSync(process.execPath, [path.join(__dirname, 'chk2.js')], { env: { ...process.env, URL: PAGE }, encoding: 'utf8' });
  check('8 continuity', c2.status === 0, `tools/chk2.js: ${(c2.stdout + c2.stderr).trim().split('\n').pop()}`);

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\nFAIL: ${failed.length} of ${results.length} checks` : `\nPASS: all ${results.length} checks`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
