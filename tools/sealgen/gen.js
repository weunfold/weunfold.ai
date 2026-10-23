const opentype = require('opentype.js'), fs = require('fs');
const F = w => opentype.loadSync(`node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-${w}-normal.woff`);
const f600 = F(600), f500 = F(500);
const r2 = v => Math.round(v * 100) / 100;
function glyphCmds(font, ch, size) { return font.getPath(ch, 0, 0, size).commands; }
function adv(font, ch, size) { return font.getAdvanceWidth(ch, size); }
function emit(cmds, tf) {
  let d = '';
  for (const c of cmds) {
    if (c.type === 'Z') { d += 'Z'; continue; }
    const p = tf(c.x, c.y);
    if (c.type === 'M' || c.type === 'L') d += c.type + r2(p[0]) + ' ' + r2(p[1]);
    else if (c.type === 'Q') { const q = tf(c.x1, c.y1); d += 'Q' + r2(q[0]) + ' ' + r2(q[1]) + ' ' + r2(p[0]) + ' ' + r2(p[1]); }
    else if (c.type === 'C') { const a = tf(c.x1, c.y1), b = tf(c.x2, c.y2); d += 'C' + r2(a[0]) + ' ' + r2(a[1]) + ' ' + r2(b[0]) + ' ' + r2(b[1]) + ' ' + r2(p[0]) + ' ' + r2(p[1]); }
  }
  return d;
}
// text on an arc around (cx, cy). top: reads left→right over the top, glyphs point outward; bottom: reads left→right along the bottom, glyphs point inward
function arcText(font, text, size, track, r, where, cx = 100, cy = 100) {
  const chars = [...text], ws = chars.map(c => adv(font, c, size) + track), L = ws.reduce((a, b) => a + b, 0) - track;
  let s = 0, d = '';
  chars.forEach((ch, i) => {
    const w = ws[i] - track, sc = s + w / 2; s += ws[i];
    if (ch === ' ') return;
    const off = (sc - L / 2) / r;
    const phi = where === 'top' ? -Math.PI / 2 + off : Math.PI / 2 - off;
    const P = [cx + r * Math.cos(phi), cy + r * Math.sin(phi)];
    const t = where === 'top' ? [-Math.sin(phi), Math.cos(phi)] : [Math.sin(phi), -Math.cos(phi)];
    const u = where === 'top' ? [Math.cos(phi), Math.sin(phi)] : [-Math.cos(phi), -Math.sin(phi)];
    d += emit(glyphCmds(font, ch, size), (gx, gy) => { const x = gx - w / 2, up = -gy; return [P[0] + x * t[0] + up * u[0], P[1] + x * t[1] + up * u[1]]; });
  });
  return { d, angle: L / r };
}
function lineText(font, text, size, track, x0, y0) {
  const chars = [...text]; let x = x0, d = '';
  chars.forEach(ch => { d += emit(glyphCmds(font, ch, size), (gx, gy) => [x + gx, y0 + gy]); x += adv(font, ch, size) + track; });
  return { d, w: x - track - x0 };
}
const top = arcText(f600, 'OPEN INTELLIGENCE', 11, 2.4, 80, 'top');
const bottom = arcText(f500, 'BUILT TOGETHER · FOR EVERYONE', 8.2, 1.6, 89, 'bottom');
const line = lineText(f600, 'OPEN INTELLIGENCE', 18, 3.2, 0, 0);
const l1 = lineText(f600, 'OPEN', 15, 3, 0, 0), l2 = lineText(f600, 'INTELLIGENCE', 15, 3, 0, 0);
const cap = f600.unitsPerEm ? f600.tables.os2.sCapHeight / f600.unitsPerEm : 0.7;
fs.writeFileSync('seal-text.json', JSON.stringify({ top: top.d, bottom: bottom.d, topDeg: top.angle * 180 / Math.PI, botDeg: bottom.angle * 180 / Math.PI, line: line.d, lineW: line.w, open: l1.d, openW: l1.w, intel: l2.d, intelW: l2.w, cap18: cap * 18, cap15: cap * 15 }));
console.log('top', (top.angle * 180 / Math.PI).toFixed(1), 'bottom', (bottom.angle * 180 / Math.PI).toFixed(1), 'line w', line.w.toFixed(1), 'cap', cap, 'bytes', fs.statSync('seal-text.json').size);
