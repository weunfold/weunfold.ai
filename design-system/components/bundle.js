/* @ds-bundle: {"format":4,"namespace":"WeUnfold","components":[{"name":"Mark"},{"name":"MarkSweep"},{"name":"Wordmark"},{"name":"Lockup"},{"name":"Badge"},{"name":"Stamp"}]} */
(function () {
  var React = window.React, h = React.createElement;
function makeGeometry() {

    const PHI = (1 + Math.sqrt(5)) / 2, rad = Math.PI / 180, f = (n) => n.toFixed(2);
    const pt = (x, y) => f(x) + ' ' + f(y);
    const PAL = ['#ff6f61', '#ff5fa2', '#d07cff', '#9a85ff', '#5aa8ff', '#38cbe8', '#33d6a8', '#62e07a', '#ff8a5c', '#ff6fb0', '#b98bff', '#4fb8ff'];
    const GA = 2 * Math.PI * (1 - 1 / PHI);

    // A: self-similar phyllotaxis. The log step beta makes neighbours 8 and 13 equally close.
    const dth = (m) => { let a = (m * GA) % (2 * Math.PI); return a > Math.PI ? 2 * Math.PI - a : a; };
    const beta = Math.sqrt((dth(8) ** 2 - dth(13) ** 2) / (13 * 13 - 8 * 8));
    let dmin = Infinity;
    for (let m = 1; m <= 89; m++) dmin = Math.min(dmin, Math.hypot(dth(m), m * beta));
    // Flower of life rule: every circle passes through the centres of its nearest neighbours, so its radius is the neighbour distance.
    const k = dmin;
    const SPEC = ['#ff6f61', '#ff8a5c', '#ff6fb0', '#ff5fa2', '#d07cff', '#b98bff', '#9a85ff', '#5aa8ff', '#4fb8ff', '#38cbe8', '#33d6a8', '#62e07a'];
    const seedSet = (keep, op, lw, rk) => {
      // every seed is a dot (d/2/sqrt(phi)) inside a see-through disc of radius d, the flower of life rule:
      // each disc reaches its neighbours' centres, and where discs overlap the petals appear by themselves
      const N = 89, R = 95 / (1 + k / PHI), halos = [], dots = [];
      for (let i = N - keep; i < N; i++) {
        const r = R * Math.exp(-beta * (N - 1 - i)), a = -Math.PI / 2 + i * GA;
        const t = ((((a + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI), col = SPEC[Math.floor(t * 12) % 12];
        const x = f(100 + r * Math.cos(a)), y = f(100 + r * Math.sin(a));
        halos.push({ x, y, r: f(r * k / PHI), o: op.toFixed(3), fill: col, mf: '#11141c', w: f(r * k * lw), so: (1 / PHI).toFixed(3) });
        dots.push({ x, y, r: f(r * k / 2 / Math.sqrt(PHI)), o: '1', fill: col, mf: '#11141c', w: '0', so: '0' });
      }
      return halos.concat(dots);
    };
    const seeds = seedSet(55, 1 / (2 * PHI ** 4), 1 / (2 * PHI ** 7), 1 / (PHI * PHI)), seedsS = seedSet(34, 1 / (2 * PHI ** 3), 1 / (2 * PHI ** 5), 1 / PHI);

    // B: golden swoosh. Each arm is the space between a golden spiral and a faster spiral that meet at the tip.
    const swoosh = (small) => {
      const n = 5, Lg = Math.log(PHI), Pd = (4 / n) * Lg;
      const TH = small ? 2 * Math.PI * (1 - 1 / PHI) : Math.PI;
      const band = small ? Pd : Pd / PHI, tip = small ? band / (PHI * PHI) : 0;
      const b1 = 2 * Lg / Math.PI, b2 = b1 + (band - tip) / TH;
      const eIn = Math.exp(b1 * TH), eOut = Math.exp(b2 * TH + tip), sc = 95 / ((eIn + eOut) / 2 + (eOut - eIn) / 2);
      const cap = (A, B, fwd) => {
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, rr = Math.hypot(A[0] - B[0], A[1] - B[1]) / 2, a0 = Math.atan2(A[1] - my, A[0] - mx);
        const s = (Math.cos(a0 + Math.PI / 2) * fwd[0] + Math.sin(a0 + Math.PI / 2) * fwd[1]) > 0 ? 1 : -1, out = [];
        for (let i = 1; i < 20; i++) { const aa = a0 + s * Math.PI * i / 20; out.push([mx + rr * Math.cos(aa), my + rr * Math.sin(aa)]); }
        return out;
      };
      const SCOL = ['#ff6f61', '#ff5fa2', '#b98bff', '#5aa8ff', '#33d6a8'], arms = [];
      for (let j = 0; j < n; j++) {
        const off = -Math.PI / 2 + j * 2 * Math.PI / n - TH, In = [], Out = [], M = 90;
        for (let q = 0; q <= M; q++) {
          const t = TH * q / M, ang = t + off, r1 = sc * Math.exp(b1 * t), r2 = sc * Math.exp(b2 * t + tip);
          In.push([100 + r1 * Math.cos(ang), 100 + r1 * Math.sin(ang)]); Out.push([100 + r2 * Math.cos(ang), 100 + r2 * Math.sin(ang)]);
        }
        const aE = TH + off;
        let pts = In.concat(cap(In[M], Out[M], [-Math.sin(aE), Math.cos(aE)]), Out.slice().reverse());
        if (tip > 0) pts = pts.concat(cap(Out[0], In[0], [Math.sin(off), -Math.cos(off)]));
        // fractal: the golden spiral is unchanged when turned back by TH and shrunk by e^(-b1*TH),
        // so each copy continues the same arm inward, without end
        const kq = Math.exp(-b1 * TH);
        for (let lv = 0, s = 1; lv <= 1; lv++, s *= kq) {
          const c = Math.cos(-TH * lv), si = Math.sin(-TH * lv);
          arms.push({ d: 'M' + pts.map((p) => { const x = p[0] - 100, y = p[1] - 100; return f(100 + s * (x * c - y * si)) + ' ' + f(100 + s * (x * si + y * c)); }).join(' L') + ' Z', col: SCOL[j] });
        }
      }
      arms.sc = sc; arms.TH = TH;
      return arms;
    };

    const nine = swoosh(false), nineS = swoosh(true);


    const fibSwirl = () => {
      const K0 = 6; // draw from the 13 arc outward: 13, 21, 34
      // Fibonacci spiral: quarter arcs of radius 1, 1, 2, 3, 5, 8, 13, 21, 34. Width grows to radius/phi^3.
      const N = 9, alpha = 1 / (PHI ** 3), n = 5, F = [1, 1];
      while (F.length < N) F.push(F[F.length - 1] + F[F.length - 2]);
      let p = [0, 0], hd = 0;
      const Lq = [], Rq = [];
      let last = null;
      for (let k = 0; k < N; k++) {
        const Rk = F[k], c = [p[0] - Rk * Math.sin(hd), p[1] + Rk * Math.cos(hd)], a0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
        const w0 = k > K0 ? alpha * F[k - 1] : 0, w1 = alpha * Rk;
        if (k < K0) { p = [c[0] + Rk * Math.cos(a0 + Math.PI / 2), c[1] + Rk * Math.sin(a0 + Math.PI / 2)]; hd += Math.PI / 2; continue; }
        for (let i = k > K0 ? 1 : 0; i <= 24; i++) {
          const t = i / 24, a = a0 + t * Math.PI / 2, w = (w0 + (w1 - w0) * t) / 2, ux = Math.cos(a), uy = Math.sin(a);
          const x = c[0] + Rk * ux, y = c[1] + Rk * uy;
          Lq.push([x + ux * w, y + uy * w]); Rq.push([x - ux * w, y - uy * w]); last = { x, y, w };
        }
        p = [c[0] + Rk * Math.cos(a0 + Math.PI / 2), c[1] + Rk * Math.sin(a0 + Math.PI / 2)]; hd += Math.PI / 2;
      }
      const A = Lq[Lq.length - 1], B = Rq[Rq.length - 1], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, ca = Math.atan2(A[1] - my, A[0] - mx);
      const sg = (Math.cos(ca + Math.PI / 2) * Math.cos(hd) + Math.sin(ca + Math.PI / 2) * Math.sin(hd)) > 0 ? 1 : -1, cap = [];
      for (let i = 1; i < 20; i++) { const aa = ca + sg * Math.PI * i / 20; cap.push([mx + last.w * Math.cos(aa), my + last.w * Math.sin(aa)]); }
      const outline = Lq.concat(cap, Rq.slice().reverse());
      let maxr = 0; outline.forEach((q) => { maxr = Math.max(maxr, Math.hypot(q[0], q[1])); });
      const s = 95 / maxr, endA = Math.atan2(last.y, last.x);
      const FCOL = ['#ff6f61', '#ff5fa2', '#b98bff', '#5aa8ff', '#33d6a8'], arms = [];
      for (let j = 0; j < n; j++) {
        const rot = -Math.PI / 2 + j * 2 * Math.PI / n - endA, co = Math.cos(rot), si = Math.sin(rot);
        arms.push({ d: 'M' + outline.map((q) => f(100 + s * (q[0] * co - q[1] * si)) + ' ' + f(100 + s * (q[0] * si + q[1] * co))).join(' L') + ' Z', col: FCOL[j] });
      }
      return arms;
    };


    
    // the colours of the Fibonacci and Tesla board, in spectrum order
    const FSPEC = ['#ff6f61', '#ff8a5c', '#ff6fb0', '#ff5fa2', '#d07cff', '#b98bff', '#9a85ff', '#5aa8ff', '#4fb8ff', '#38cbe8', '#33d6a8', '#62e07a'];
    const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const toLin = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4), toS = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
    const toLab = (h) => { const [r, g, b] = hex2(h).map(toLin); const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b); return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]; };
    const fromLab = ([L, a, b]) => { const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3; return '#' + [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map((x) => Math.round(toS(Math.max(0, Math.min(1, x))) * 255).toString(16).padStart(2, '0')).join(''); };
    const LABS = FSPEC.map(toLab);
    const specAt = (u) => { u = ((u % 1) + 1) % 1; u = (u < 0.5 ? u * 2 : 2 - u * 2) * 11; // there and back, never through yellow
       const i = Math.min(10, Math.floor(u)), t = u - i, A = LABS[i], B = LABS[i + 1]; return fromLab(A.map((v, k) => v + (B[k] - v) * t)); }; // cyclic, mixed in OKLab
    const fcCircles = (N, swk) => {
      const F = [1, 1]; while (F.length < N) F.push(F[F.length - 1] + F[F.length - 2]);
      let p = [0, 0], h = 0; const cs = [];
      for (let q = 0; q < N; q++) {
        const Rq = F[q], c = [p[0] - Rq * Math.sin(h), p[1] + Rq * Math.cos(h)], a0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
        cs.push({ cx: c[0], cy: c[1], R: Rq, a0 });
        p = [c[0] + Rq * Math.cos(a0 + Math.PI / 2), c[1] + Rq * Math.sin(a0 + Math.PI / 2)]; h += Math.PI / 2;
      }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      cs.forEach((c) => { x0 = Math.min(x0, c.cx - c.R); x1 = Math.max(x1, c.cx + c.R); y0 = Math.min(y0, c.cy - c.R); y1 = Math.max(y1, c.cy + c.R); });
      const s = 190 / Math.max(x1 - x0, y1 - y0) / (1 + swk), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      // the eye: where the spiral winds in, the limit of the arc end points
      const eye = { x: 100 + (p[0] * 0 + cs[1].cx - mx) * s, y: 100 + (cs[1].cy - my) * s };
      return { eye, list: cs.map((c, q) => ({ q, a0: c.a0, x: 100 + (c.cx - mx) * s, y: 100 + (c.cy - my) * s, r: c.R * s, w: c.R * s * swk })) };
    };
    const arcD = (c, t0, t1) => 'M' + f(c.x + c.r * Math.cos(t0)) + ' ' + f(c.y + c.r * Math.sin(t0)) + ' A' + f(c.r) + ' ' + f(c.r) + ' 0 ' + (t1 - t0 > Math.PI ? 1 : 0) + ' 1 ' + f(c.x + c.r * Math.cos(t1)) + ' ' + f(c.y + c.r * Math.sin(t1));
    const fibColours = (swk, n, KAPPA = -0.9, NS = 13, ALT = true) => {
      const g = fcCircles(8, swk);
      // 1 Fibonacci switch: every ring is cut into 7 bands with lengths 1, 1, 2, 3, 5, 8, 13, smallest where it meets the next smaller ring.
      // Each band takes the next colour, so bands shrink into the centre like the chambers of a shell.
      const FB = [1, 1, 2, 3, 5, 8, 13], tot = 33, fib = [];
      g.list.forEach((c) => {
        let acc = 0;
        FB.forEach((len, k) => {
          const t0 = c.a0 + 2 * Math.PI * acc / tot, t1 = c.a0 + 2 * Math.PI * (acc + len) / tot; acc += len;
          fib.push({ d: arcD(c, t0, t1), w: f(c.w), col: FSPEC[(c.q * 7 + k) % 12] });
        });
      });
      // 2 Fade: each ring carries the whole spectrum around it, mixed smoothly; each ring is turned 1/phi of a turn from the last
      const fade = [];
      g.list.forEach((c) => {
        const k = Math.max(16, Math.round(n * Math.sqrt(c.r / 60)));
        for (let i = 0; i < k; i++) { const t0 = c.a0 + 2 * Math.PI * i / k, t1 = c.a0 + 2 * Math.PI * (i + 1.6) / k; fade.push({ d: arcD(c, t0, t1), w: f(c.w), col: specAt((i + 0.5) / k + c.q / PHI) }); }
      });
      const CH = Array.from({ length: NS }, (_, i) => (ALT && i % 2 ? specAt(0.5 * (i / NS) + 0.25) : specAt(0.5 * (i / NS))));
      // 3 Chambers: hard colour changes along curved walls that sweep out from the eye, 13 per turn,
      // so the rings read as the chambers of a nautilus
      const cham = [], KAP = KAPPA;
      g.list.forEach((c) => {
        const k = Math.max(48, Math.round(n * 2 * Math.sqrt(c.r / 60)));
        let start = 0, prev = null;
        const sect = (t) => { const x = c.x + c.r * Math.cos(t), y = c.y + c.r * Math.sin(t), rr = Math.hypot(x - g.eye.x, y - g.eye.y) + 1e-6; const a = Math.atan2(y - g.eye.y, x - g.eye.x) - KAP * Math.log(rr); return ((Math.floor(a / (2 * Math.PI / NS)) % NS) + NS) % NS; };
        for (let i = 0; i <= k; i++) {
          const t = c.a0 + 2 * Math.PI * i / k, s = i < k ? sect(t) : -1;
          if (prev === null) { prev = s; start = t; continue; }
          if (s !== prev) { cham.push({ d: arcD(c, start, t + 0.002), w: f(c.w), col: CH[prev] }); start = t; prev = s; }
        }
      });
      return { fib, fade, cham };
    };
    const b = fibColours(1 / (PHI ** 4), 72, -1.6, 21, true);

  return {
    seeds: (small) => (small ? seedsS : seeds),
    circles: (small) => (small ? fibColours(1 / (PHI ** 3), 24, -1.6, 21, true).fade : fibColours(1 / (PHI ** 4), 72, -1.6, 21, true).fade),
    swirl: () => fibSwirl()
  };
}

  var G = makeGeometry();
  var HYPOTHESES = [
    { id: 'seeds', letter: 'A', name: 'Golden Seeds', line: 'Everything is made of the same pattern.' },
    { id: 'circles', letter: 'C', name: 'Golden Circles · Fade', line: 'Growth in balance.' },
    { id: 'swirl', letter: 'D', name: 'Fibonacci Swirl', line: 'Many hands, one motion.' }
  ];
  var DEFAULT = 'circles';
  function shapes(variant, small, ink) {
    if (variant === 'seeds') return G.seeds(small).map(function (d, i) {
      return h('circle', { key: i, cx: d.x, cy: d.y, r: d.r, fill: ink || d.fill, fillOpacity: d.o, stroke: ink || d.fill, strokeOpacity: d.so, strokeWidth: d.w });
    });
    if (variant === 'swirl') return G.swirl().map(function (x, i) { return h('path', { key: i, d: x.d, fill: ink || x.col }); });
    return G.circles(small).map(function (x, i) { return h('path', { key: i, d: x.d, fill: 'none', stroke: ink || x.col, strokeWidth: x.w }); });
  }
  function Mark(p) {
    var size = p.size || 200, variant = p.variant || DEFAULT;
    var small = p.small != null ? p.small : size < 96;
    var label = (HYPOTHESES.filter(function (x) { return x.id === variant; })[0] || HYPOTHESES[1]).name;
    return h('svg', { viewBox: '0 0 200 200', width: size, height: size, role: 'img', 'aria-label': p.label || 'we unfold mark, ' + label, className: p.className, style: p.style },
      shapes(variant, small, p.ink));
  }
  function Wordmark(p) {
    var size = p.size || 96, tag = p.tag !== false;
    return h('div', { className: 'wu-wordmark', style: { alignItems: p.align === 'center' ? 'center' : 'flex-start', gap: Math.round(size * 0.16) + 'px', color: p.color } },
      h('div', { className: 'wu-word', style: { fontSize: size + 'px' } }, 'we ', h('span', { style: { fontStyle: 'italic' } }, 'unfold')),
      tag ? h('div', { className: 'wu-tag', style: { fontSize: Math.max(11, Math.round(size * 0.2)) + 'px', color: p.tagColor } }, 'OPEN INTELLIGENCE') : null);
  }
  function Lockup(p) {
    var stacked = p.layout === 'stacked', size = p.size || (stacked ? 46 : 64);
    return h('div', { className: 'wu-lockup' + (stacked ? ' wu-lockup--stacked' : ''), style: { gap: Math.round(size * (stacked ? 0.48 : 0.56)) + 'px' } },
      h(Mark, { variant: p.variant, ink: p.ink, size: Math.round(size * (stacked ? 3.2 : 2.3)) }),
      h(Wordmark, { size: size, align: stacked ? 'center' : 'start', color: p.ink, tagColor: p.ink }));
  }
  function Badge(p) {
    var w = p.width || 340, ground = p.ground || 'var(--surface, #0e1017)', text = p.color || 'var(--text, #ebe6da)';
    return h('svg', { viewBox: '0 0 340 64', width: w, height: Math.round(w * 64 / 340), role: 'img', 'aria-label': 'Open Intelligence badge' },
      h('rect', { x: 1.5, y: 1.5, width: 337, height: 61, rx: 30.5, fill: ground, stroke: text, strokeWidth: 2 }),
      h('g', { transform: 'translate(34 32) scale(0.27) translate(-100 -100)' }, shapes(p.variant || DEFAULT, true, p.ink)),
      h('text', { x: 68, y: 39, fontFamily: 'IBM Plex Mono, monospace', fontSize: 18, fontWeight: 600, letterSpacing: 3.2, fill: text }, 'OPEN INTELLIGENCE'));
  }
  var stampId = 0;
  function Stamp(p) {
    var id = React.useState(function () { stampId += 1; return 'wu-st-' + stampId; })[0];
    var size = p.size || 300, ground = p.ground || 'var(--surface, #0e1017)', ring = p.color || 'var(--text, #ebe6da)', sub = p.subColor || 'var(--text-muted, #a7abb9)';
    return h('svg', { viewBox: '0 0 320 320', width: size, height: size, role: 'img', 'aria-label': 'Open Intelligence seal' },
      h('defs', null, h('path', { id: id + 't', d: 'M36 160 A124 124 0 0 1 284 160' }), h('path', { id: id + 'b', d: 'M20 160 A140 140 0 0 0 300 160' })),
      h('circle', { cx: 160, cy: 160, r: 154, fill: ground, stroke: ring, strokeWidth: 3 }),
      h('circle', { cx: 160, cy: 160, r: 110, fill: 'none', stroke: ring, strokeWidth: 1.5 }),
      h('text', { fontFamily: 'IBM Plex Mono, monospace', fontSize: 19, fontWeight: 600, letterSpacing: 4, fill: ring, textAnchor: 'middle' }, h('textPath', { href: '#' + id + 't', startOffset: '50%' }, 'OPEN INTELLIGENCE')),
      h('text', { fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, fontWeight: 500, letterSpacing: 3, fill: sub, textAnchor: 'middle' }, h('textPath', { href: '#' + id + 'b', startOffset: '50%' }, 'BUILT TOGETHER · FOR EVERYONE')),
      h('circle', { cx: 28, cy: 160, r: 3.5, fill: ring }), h('circle', { cx: 292, cy: 160, r: 3.5, fill: ring }),
      h('g', { transform: 'translate(160 160) scale(0.98) translate(-100 -100)' }, shapes(p.variant || DEFAULT, false, p.ink)));
  }
  function MarkSweep(p) {
    var st = React.useState(p.initial || DEFAULT), v = st[0], setV = st[1];
    var auto = React.useState(!!p.auto), on = auto[0], setOn = auto[1];
    React.useEffect(function () {
      if (!on) return undefined;
      var t = setInterval(function () {
        setV(function (cur) { var i = HYPOTHESES.findIndex(function (x) { return x.id === cur; }); return HYPOTHESES[(i + 1) % HYPOTHESES.length].id; });
      }, p.interval || 2400);
      return function () { clearInterval(t); };
    }, [on]);
    React.useEffect(function () { if (p.onChange) p.onChange(v); }, [v]);
    var size = p.size || 240, cur = HYPOTHESES.filter(function (x) { return x.id === v; })[0];
    var render = p.children || function (variant) { return h(Mark, { variant: variant, size: size, ink: p.ink }); };
    return h('div', { className: 'wu-sweep' },
      h('div', { className: 'wu-sweep__stage', style: { width: p.stageWidth || size, height: p.stageHeight || size } },
        HYPOTHESES.map(function (x) {
          return h('div', { key: x.id, className: 'wu-sweep__layer', 'aria-hidden': x.id !== v, style: { opacity: x.id === v ? 1 : 0, transform: x.id === v ? 'rotate(0deg) scale(1)' : 'rotate(-34deg) scale(0.94)' } }, render(x.id));
        })),
      h('div', { className: 'wu-sweep__bar', role: 'group', 'aria-label': 'Choose a hypothesis' },
        HYPOTHESES.map(function (x) {
          return h('button', { key: x.id, type: 'button', className: 'wu-sweep__btn', 'aria-pressed': x.id === v, onClick: function () { setOn(false); setV(x.id); } }, x.letter + ' · ' + x.name);
        }),
        h('button', { type: 'button', className: 'wu-sweep__btn wu-sweep__btn--auto', 'aria-pressed': on, onClick: function () { setOn(!on); } }, on ? 'Pause sweep' : 'Sweep')),
      h('div', { className: 'wu-sweep__line' }, cur.line));
  }
  window.WeUnfold = { Mark: Mark, MarkSweep: MarkSweep, Wordmark: Wordmark, Lockup: Lockup, Badge: Badge, Stamp: Stamp, HYPOTHESES: HYPOTHESES, DEFAULT: DEFAULT, geometry: G };
})();
