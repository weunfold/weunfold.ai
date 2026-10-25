// The auto story's cast. Intelligence never had one voice: it carries ours. So the film has no narrator; every line of
// the page is spoken by one of ten voices from ten places, designed with ElevenLabs Voice Design (no voice of a real
// person is cloned). Ten is what one Text to Dialogue request takes. Each voice speaks two lines, never twice in a row.
// tools/story.mjs reads this to build the dialogue; tools/dev.mjs serves the picker (/__voices) that designs and saves them.
// The chosen voice ids live in the ignored .env as ELEVENLABS_CAST (role:voice_id,...): they belong to the account.
export const ROLES = [
  { id: "lagos", at: [3.4, 6.5], accent: "Nigerian", name: "Lagos", prompt: "A young woman from Lagos, Nigeria, in her early twenties. Bright, curious and warm, speaking English with a natural Nigerian accent. Close to the microphone, unhurried, sincere, never theatrical." },
  { id: "kyoto", at: [135.8, 35.0], accent: "Japanese", name: "Kyoto", prompt: "An elderly man from Kyoto, Japan, in his seventies. Gentle, slow and thoughtful, speaking English with a soft Japanese accent. Quiet and intimate, with a little breath in the voice." },
  { id: "saopaulo", at: [-46.6, -23.5], accent: "Brazilian Portuguese", name: "São Paulo", prompt: "A woman in her forties from São Paulo, Brazil. Warm, grounded and calm, speaking English with a natural Brazilian Portuguese accent. Close to the microphone, sincere, unhurried." },
  { id: "mumbai", at: [72.9, 19.1], accent: "Indian", name: "Mumbai", prompt: "A man in his thirties from Mumbai, India. Calm, clear and thoughtful, speaking English with a natural Indian accent. Soft-spoken and steady, like someone explaining something they care about." },
  { id: "mexico", at: [-99.1, 19.4], accent: "Mexican Spanish", name: "Mexico City", prompt: "A young man in his twenties from Mexico City. Soft-spoken and earnest, speaking English with a natural Mexican Spanish accent. Quiet, close to the microphone, sincere." },
  { id: "galway", at: [-9.0, 53.3], accent: "Irish", name: "Galway", prompt: "A woman in her sixties from the west of Ireland. Kind, slightly raspy and wise, speaking English with a gentle Irish accent. Slow and warm, like telling a story by a fire." },
  { id: "cairo", at: [31.2, 30.0], accent: "Egyptian Arabic", name: "Cairo", prompt: "A man in his fifties from Cairo, Egypt. Deep, measured and warm, speaking English with a natural Egyptian Arabic accent. Calm and dignified, unhurried." },
  { id: "seoul", at: [127.0, 37.6], accent: "Korean", name: "Seoul", prompt: "A woman in her late twenties from Seoul, South Korea. Clear, quiet and precise, speaking English with a light Korean accent. Thoughtful, close to the microphone." },
  { id: "nairobi", at: [36.8, -1.3], accent: "Kenyan", name: "Nairobi", prompt: "A woman in her forties from Nairobi, Kenya. Confident, warm and steady, speaking English with a natural Kenyan accent. Grounded and clear, sincere." },
  { id: "jakarta", at: [106.8, -6.2], accent: "Indonesian", name: "Jakarta", prompt: "A man in his forties from Jakarta, Indonesia. Friendly, gentle and clear, speaking English with a natural Indonesian accent. Relaxed and sincere, close to the microphone." },
];
// at: each voice's place (longitude, latitude). While a voice speaks, its place on the field lights (the field laid out like a
// map), so the light travels between the cities as the voices take turns
export const PLACES = Object.fromEntries(ROLES.map((r) => [r.id, [+(r.at[0] / 180).toFixed(3), +(r.at[1] / 90).toFixed(3)]]));
// who speaks which line (section@data-in, as in tools/story.mjs)
export const LINES = {
  "top@0.14": "lagos", "top@0.3": "kyoto", "top@0.36": "saopaulo", "top@0.42": "mumbai", "top@0.48": "mexico",
  "top@0.62": "galway", "top@0.7": "cairo", "top@0.77": "seoul", "top@0.84": "nairobi",
  "today@0": "jakarta", "today@0.14": "lagos", "today@0.3": "kyoto", "today@0.37": "mexico", "today@0.44": "seoul",
  "today@0.52": "galway", "today@0.68": "saopaulo", "today@0.84": "cairo", "today@0.88": "nairobi", "today@0.92": "mumbai",
};
// what every voice says in its previews, so they can be compared on the same words (100–1,000 characters)
export const PREVIEW_TEXT = "Intelligence never began with one of us. A question. A discovery. Something taught. Something passed on. Everything we know arrived through someone.";
export const DESIGN_MODEL = "eleven_ttv_v3"; // the API's Voice Design takes eleven_multilingual_ttv_v2 or eleven_ttv_v3 only
export const SPEECH = "eleven_v4"; // what the film speaks with: the most emotive model, through Text to Dialogue
// direction for each line (eleven_v4 audio tags): tone and pace only, describing the voice, never a sound; keyed like the holds.
// The arc: quiet wonder, gratitude, then unease at the questions, a low weight on "held by a few", and hope at the turn.
export const TAGS = {
  "top@0.14": "[quiet, warm, close to the listener, almost a secret]",
  "top@0.3": "[softly curious]", "top@0.36": "[small wonder, gently]", "top@0.42": "[patient, kind]", "top@0.48": "[tender, unhurried]",
  "top@0.62": "[warm, grateful, slow]", "top@0.7": "[gentle, wise]", "top@0.77": "[calm, clear]", "top@0.84": "[softly, with quiet awe]",
  "today@0": "[firm but gentle]", "today@0.14": "[thoughtful, a little troubled]",
  "today@0.3": "[sincere question]", "today@0.37": "[sincere question, more pointed]", "today@0.44": "[quiet, serious, the hardest question]",
  "today@0.52": "[low, steady voice, restrained sadness]", "today@0.68": "[hopeful, opening up, warm]",
  "today@0.84": "[hopeful, clear]", "today@0.88": "[confident, warm]", "today@0.92": "[resolute, gentle, an ending]",
};

// ELEVENLABS_CAST="lagos:abc,kyoto:def,..." → { lagos: "abc", ... }
export function parseCast(s) { const o = {}; for (const p of (s || "").split(",")) { const [k, v] = p.split(":").map((x) => x && x.trim()); if (k && v) o[k] = v; } return o; }

// the script, from the page: every .beat / .ln line of a section of site/index.html, in order, with its data-in
function decode(s) { return s.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "’").replace(/\s+/g, " ").trim(); }
export function lines(html, id) {
  const m = html.match(new RegExp(`<section id="${id}"[^>]*>([\\s\\S]*?)</section>`));
  if (!m) throw new Error(`no #${id} in site/index.html`);
  const out = [];
  for (const b of m[1].matchAll(/<div class="beat" data-in="([\d.]+)" data-out="[\d.]+">(.*?)<\/div>/g)) {
    const at = +b[1], body = b[2], re = /<span class="ln" data-in="([\d.]+)">(.*?)<\/span>/g;
    let last = 0, free = "", r;
    while ((r = re.exec(body))) { free += body.slice(last, r.index); last = re.lastIndex; }
    free += body.slice(last);
    // sel: the element whose letters the player reveals as the line is spoken
    const t = decode(free); if (t) out.push({ sec: id, in: at, text: t, sel: `#${id} .beat[data-in="${b[1]}"] > :not(.ln-list)` });
    for (const l of body.matchAll(/<span class="ln" data-in="([\d.]+)">(.*?)<\/span>/g)) out.push({ sec: id, in: +l[1], text: decode(l[2]), sel: `#${id} .ln[data-in="${l[1]}"]` });
  }
  return out;
}

// the end: every voice at once says the movement's name, as the page shows it (#oi: "we unfold", then "Open Intelligence")
export const CHORUS = [
  { key: "oi@we", text: "we unfold", sel: "#oi .oi-head .tag" },
  { key: "oi@name", text: "Open Intelligence", sel: "#oi .oi-head h2" },
];
TAGS["oi@we"] = "[all together, softly, warm]";
TAGS["oi@name"] = "[all together, bright, hopeful, resolved]";

// eleven_v4 can flatten a designed voice's accent; its experimental [strong X accent] tag asks for it back
export const ACCENT = true;
// what a voice says for one line: the accent tag (if on), the line's direction, then the page's own words
export function spoken(role, k, text, opts = {}) {
  const r = ROLES.find((x) => x.id === role), accent = (opts.accent ?? ACCENT) && r && r.accent ? `[strong ${r.accent} accent] ` : "";
  return `${accent}${TAGS[k] ? TAGS[k] + " " : ""}${text}`;
}
