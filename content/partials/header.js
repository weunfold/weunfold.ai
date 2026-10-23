// The site shell's behaviour, stamped into every page by tools/build.mjs. Edit content/partials/header.js.
(function () {
  var bar = document.querySelector("[data-topbar]"); if (!bar) return;
  var btn = bar.querySelector(".nav-drop-btn"), menu = btn && document.getElementById(btn.getAttribute("aria-controls"));
  var links = bar.querySelector(".nav-links"), ind = bar.querySelector(".nav-ind"), items = Array.prototype.slice.call(bar.querySelectorAll("[data-nav]"));
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // the Initiatives menu: a click/keyboard disclosure, never hover
  function setMenu(open) { btn.setAttribute("aria-expanded", open ? "true" : "false"); menu.hidden = !open; if (open) show(); }
  if (menu) {
    btn.addEventListener("click", function () { setMenu(menu.hidden); if (!menu.hidden) menu.querySelector("a").focus(); });
    document.addEventListener("click", function (e) { if (!menu.hidden && !e.target.closest(".nav-drop")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { setMenu(false); btn.focus(); } });
    menu.addEventListener("focusout", function (e) { if (!e.relatedTarget || !e.relatedTarget.closest(".nav-drop")) setMenu(false); });
  }

  // where you are: a subpage names its section on <body data-section>; the landing follows the section on screen
  var SECTIONS = { manifesto: ["top", "today", "oi"], econ: ["econ", "tactu"], initiatives: ["initiatives"], people: ["people"], progress: ["progress"] };
  var fixed = document.body.getAttribute("data-section"), current = null;
  function place() {
    var el = current && items.filter(function (i) { return i.getAttribute("data-nav") === current; })[0], t = el && (el.querySelector(".nav-drop-btn") || el);
    if (!t || !t.offsetWidth) { ind.classList.remove("on"); return; }
    var a = links.getBoundingClientRect(), r = t.getBoundingClientRect(), w = t.querySelector("svg") ? r.width - 18 : r.width;
    ind.style.width = w + "px"; ind.style.transform = "translateX(" + (r.left - a.left) + "px)"; ind.classList.add("on");
  }
  function setCurrent(k) {
    if (k === current) return; current = k;
    items.forEach(function (i) { var on = i.getAttribute("data-nav") === k; i.classList.toggle("is-current", on); if (i.tagName === "A") { if (on) i.setAttribute("aria-current", fixed ? "page" : "location"); else i.removeAttribute("aria-current"); } });
    place();
  }
  function spy() {
    if (fixed) return setCurrent(fixed);
    var mid = window.innerHeight * 0.4, found = null;
    Object.keys(SECTIONS).forEach(function (k) { SECTIONS[k].forEach(function (id) { var s = document.getElementById(id); if (!s) return; var r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) found = k; }); });
    setCurrent(found);
  }

  // the bar: transparent at the top, a quiet ground once you scroll, tucked away while you read down, back as soon as you scroll up
  // direction is measured from where the scroll last turned, so slow trackpad and smooth scrolling count too
  var lastY = window.scrollY, turnY = lastY, dir = 0;
  function show() { bar.classList.remove("is-hidden"); }
  function onScroll() {
    var y = window.scrollY, open = menu && !menu.hidden, d = y > lastY ? 1 : y < lastY ? -1 : 0;
    if (d && d !== dir) { dir = d; turnY = lastY; }
    bar.classList.toggle("is-scrolled", y > 24);
    if (y <= 160 || (dir < 0 && turnY - y > 8)) show();
    else if (!reduce && !open && !bar.contains(document.activeElement) && dir > 0 && y - turnY > 8) bar.classList.add("is-hidden");
    lastY = y; spy();
  }
  bar.addEventListener("focusin", show);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { place(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  onScroll();
})();

// A link that lands on #section (e.g. back to #initiatives) jumps there at once instead of smooth-scrolling
// through everything above it, and again after fonts and media settle the layout.
(function () {
  var id = location.hash.slice(1), el = id && document.getElementById(id);
  if (!el) return;
  var root = document.documentElement; // head.js already set scroll-behavior to auto for this load
  function jump() { el.scrollIntoView({ block: "start" }); }
  function done() { jump(); requestAnimationFrame(function () { root.style.scrollBehavior = ""; }); }
  jump(); if (document.readyState === "complete") done(); else window.addEventListener("load", done, { once: true });
})();

// Subpages: the same fine, dim particle ground the landing's field settles into, drawn once.
(function () {
  var c = document.querySelector("canvas.ground"); if (!c) return;
  function draw() {
    var d = Math.min(window.devicePixelRatio || 1, 2), w = window.innerWidth, h = window.innerHeight, g = c.getContext("2d"), seed = 11;
    c.width = Math.round(w * d); c.height = Math.round(h * d); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    for (var i = 0, n = Math.round(w * h / 1400); i < n; i++) { var b = 0.25 + rnd() * 0.35; g.globalAlpha = b * b; g.fillStyle = "#ebe6da"; g.beginPath(); g.arc(rnd() * w, rnd() * h, 0.4 + rnd() * 0.6, 0, 6.283); g.fill(); }
  }
  draw(); window.addEventListener("resize", draw);
})();
