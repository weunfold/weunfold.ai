// The capacity expression: contributions gather into a region of shared compute. Stamped by tools/build.mjs
// into pages that carry <script data-build="capacity">. weCapacity(canvas, progress) draws the state for
// progress() in [0, 1] (0 = the open network, 1 = gathered); the story only moves with that number, ambient
// drift does not. Under reduced motion it draws one still frame of the gathered state.
window.weCapacity = function (canvas, progress) {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) progress = function () { return 1; };
  var cx = canvas.getContext("2d"), W = 0, H = 0, D = 1, on = false, raf = 0, P = [], SRC = [], CELLS = 8;
  // six contributions around the edge, in the site's colours: capital, demand, access, infrastructure, work, investment
  var COL = ["#d9b45a", "#5aa8ff", "#33d6a8", "#9a85ff", "#f08a5d", "#e05aa0"];
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function build() {
    var r = canvas.getBoundingClientRect(); D = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * D); canvas.height = Math.round(H * D);
    var R = rnd(7), n = W < 420 ? 260 : 460, m = Math.min(W, H), core = m * 0.34, x0 = W / 2 - core / 2, y0 = H / 2 - core / 2;
    SRC = COL.map(function (c, k) { var a = -Math.PI / 2 + k * Math.PI / 3 + 0.35; return { x: W / 2 + Math.cos(a) * m * 0.43, y: H / 2 + Math.sin(a) * m * 0.41, c: c }; });
    P = [];
    for (var i = 0; i < n; i++) {
      var s = SRC[i % 6], a = R() * Math.PI * 2, d = Math.sqrt(R()) * m * 0.11;
      var cell = Math.floor(R() * CELLS * CELLS), gx = cell % CELLS, gy = Math.floor(cell / CELLS);
      P.push({ hx: s.x + Math.cos(a) * d, hy: s.y + Math.sin(a) * d, tx: x0 + (gx + 0.5) * core / CELLS + (R() - 0.5) * core / CELLS * 0.5, ty: y0 + (gy + 0.5) * core / CELLS + (R() - 0.5) * core / CELLS * 0.5,
        bx: W / 2 + (R() - 0.5) * m * 0.3, by: H / 2 + (R() - 0.5) * m * 0.3, lag: R() * 0.35, ph: R() * 6.28, sz: 0.6 + R() * 1.1, c: s.c });
    }
    P.core = { x: x0, y: y0, s: core };
  }
  function draw(time) {
    var t = Math.max(0, Math.min(1, progress())), amb = reduce ? 0 : 1, day = window.__wuSky ? window.__wuSky.day : 0; // the landing turns to day; ink on sand then
    cx.setTransform(D, 0, 0, D, 0, 0); cx.clearRect(0, 0, W, H);
    // the paths from each contribution into the shared region
    SRC.forEach(function (s) {
      cx.globalAlpha = 0.12 + 0.28 * t; cx.strokeStyle = s.c; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(s.x, s.y); cx.quadraticCurveTo((s.x + W / 2) / 2 + (H / 2 - s.y) * 0.18, (s.y + H / 2) / 2 + (s.x - W / 2) * 0.18, W / 2, H / 2); cx.stroke();
      cx.globalAlpha = 0.9; cx.fillStyle = s.c; cx.beginPath(); cx.arc(s.x, s.y, 3, 0, 6.283); cx.fill();
    });
    // the region itself: a faint grid of compute units that fills as contributions arrive
    var k = P.core; cx.globalAlpha = 0.08 + 0.32 * t; cx.strokeStyle = day > 0.3 ? "#2a1d12" : "#ebe6da"; cx.lineWidth = 1;
    cx.beginPath(); cx.roundRect ? cx.roundRect(k.x - 10, k.y - 10, k.s + 20, k.s + 20, 10) : cx.rect(k.x - 10, k.y - 10, k.s + 20, k.s + 20); cx.stroke();
    cx.globalCompositeOperation = day > 0.3 ? "source-over" : "lighter";
    for (var i = 0; i < P.length; i++) {
      var p = P[i], q = ease(Math.max(0, Math.min(1, (t - p.lag * (1 - t)) / (1 - p.lag * 0.5))));
      var mx = p.bx + (p.hx - p.bx) * 0.3, my = p.by + (p.hy - p.by) * 0.3, u = 1 - q;
      var x = u * u * p.hx + 2 * u * q * mx + q * q * p.tx, y = u * u * p.hy + 2 * u * q * my + q * q * p.ty;
      var wob = amb * (1 - q * 0.8) * 2.2; x += Math.sin(time * 0.0007 + p.ph) * wob; y += Math.cos(time * 0.0006 + p.ph * 1.3) * wob;
      cx.globalAlpha = 0.35 + 0.5 * q; cx.fillStyle = p.c; cx.beginPath(); cx.arc(x, y, p.sz, 0, 6.283); cx.fill();
    }
    cx.globalCompositeOperation = "source-over"; cx.globalAlpha = 1;
  }
  function loop(time) { draw(time); raf = on && !reduce ? requestAnimationFrame(loop) : 0; }
  function start() { if (!on) { on = true; if (!raf) raf = requestAnimationFrame(loop); } }
  build(); draw(0);
  window.addEventListener("resize", function () { build(); draw(performance.now()); });
  // cross-page continuity: the canvas is the shared element of the view transition, but only when it is on
  // screen as the page leaves or arrives, so an off-screen canvas never flies in from nowhere
  function visible() { var r = canvas.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }
  function name(v) { canvas.style.viewTransitionName = v ? "capacity" : ""; }
  window.addEventListener("pageswap", function (e) { if (e.viewTransition) name(visible()); });
  window.addEventListener("pagereveal", function (e) { if (!e.viewTransition) return; name(visible()); var clear = function () { name(false); }; e.viewTransition.finished.then(clear, clear); });
  if (reduce) return;
  // only animate while on screen, so several pages and canvases never pile up loops
  new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) start(); else on = false; }); }).observe(canvas);
};
