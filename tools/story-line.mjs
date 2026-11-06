// Single-line timing and ffmpeg arguments. Importing this module does no IO.
export const r3 = (x) => +x.toFixed(3);

// Find the page's words inside an alignment (which can also contain direction tags).
export function letters(al, text, from = 0) {
  if (!al) return null;
  const at = al.characters.join("").indexOf(text, from);
  if (at < 0) return null;
  const t = []; for (let i = 0; i < text.length; i++) if (!/\s/.test(text[i])) t.push(al.character_start_times_seconds[at + i]);
  return { t, at, next: at + text.length, end: al.character_end_times_seconds[at + text.length - 1] };
}
export function spread(text, start, end) {
  const n = text.replace(/\s/g, "").length;
  return Array.from({ length: n }, (_, i) => start + Math.max(0, end - start - 0.1) * i / Math.max(1, n));
}

export function shiftCues(cues, afterKey, delta) {
  const at = cues.findIndex((c) => c.key === afterKey);
  if (at < 0) throw new Error(`no line ${afterKey}`);
  return cues.map((c, i) => i > at && (c.kind === "line" || c.kind === "chorus") ? {
    ...c, start: r3(c.start + delta), end: r3(c.end + delta), t: c.t.map((t) => r3(t + delta)),
  } : c);
}

// Keep pauses within the take; discard only its leading/trailing non-voice audio.
export function takeBounds(take, text) {
  const segments = (take.voice_segments || []).filter((s) => s.dialogue_input_index === 0);
  const f = letters(take.alignment, text);
  const start = segments.length ? Math.min(...segments.map((s) => s.start_time_seconds)) : f?.t[0];
  const end = segments.length ? Math.max(...segments.map((s) => s.end_time_seconds)) : f?.end;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error("take has no valid voice timing");
  return { start, end, dur: end - start };
}

export function replaceLine(cue, take, text) {
  const b = takeBounds(take, text), start = cue.start, end = r3(start + b.dur);
  const f = letters(take.alignment, text);
  const aligned = f?.t.every((t, i, ts) => Number.isFinite(t) && t >= b.start && t <= b.end && (!i || t >= ts[i - 1]));
  const t = aligned ? f.t.map((t) => start + t - b.start) : spread(text, start, end);
  return { ...cue, text, start, end, dur: r3(end - start), t: t.map(r3) };
}

export function segmentBounds(cues, key, duration) {
  const said = cues.filter((c) => c.kind === "line" || c.kind === "chorus"), i = said.findIndex((c) => c.key === key);
  if (i < 0) throw new Error(`no line ${key}`);
  const cue = said[i], start = i ? said[i - 1].end : 0, end = said[i + 1]?.start ?? duration;
  if (!(0 <= start && start <= cue.start && cue.start < cue.end && cue.end <= end && end <= duration)) throw new Error(`overlapping or invalid bounds for ${key}`);
  return { cue, start, end, gapBefore: cue.start - start, gapAfter: end - cue.end };
}

// Decode before cutting; retain the two original gaps around the replacement.
// loudness is the old spoken span's measured integrated LUFS (ffmpeg loudnorm).
export function ffmpegPlan(bounds, take, files, loudness = -23) {
  const b = takeBounds(take, take.text), c = bounds.cue;
  const target = Math.min(-5, Math.max(-70, Number.isFinite(loudness) ? loudness : -23));
  const pieces = [[0, bounds.start], [bounds.start, c.start], null, [c.end, bounds.end], [bounds.end, null]]
    .filter((p) => !p || p[1] === null || p[1] > p[0]);
  const filters = pieces.map((p, i) => p ? `[0:a]atrim=start=${p[0]}${p[1] === null ? "" : `:end=${p[1]}`},asetpts=PTS-STARTPTS[s${i}]` : `[1:a]asetpts=PTS-STARTPTS[s${i}]`);
  return {
    decode: ["-i", files.voice, "-ac", "1", "-ar", "44100", files.decoded],
    measure: ["-i", files.decoded, "-af", `atrim=start=${c.start}:end=${c.end},loudnorm=print_format=json`, "-f", "null", "-"],
    trim: ["-i", files.take, "-af", `atrim=start=${b.start}:end=${b.end},asetpts=PTS-STARTPTS,loudnorm=I=${target}:TP=-1.5:LRA=11`, "-ac", "1", "-ar", "44100", files.trimmed],
    concat: ["-i", files.decoded, "-i", files.trimmed, "-filter_complex", filters.join(";") + ";" + pieces.map((_, i) => `[s${i}]`).join("") + `concat=n=${pieces.length}:v=0:a=1[o]`, "-map", "[o]", "-ac", "1", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "192k", files.output],
  };
}
