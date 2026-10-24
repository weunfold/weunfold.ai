// Live tuning panel for the landing's opening. Loaded only by tools/dev.mjs (never part of the site).
// Sliders edit window.__wuTune in place, so the next frame already uses the new value. Unsaved values survive the
// dev server's reloads (sessionStorage); Save writes them into site/index.html and private/artifact-version.html.
// T toggles the panel.
(function () {
  var T = window.__wuTune, top = document.getElementById("top");
  if (!T || !top) return;
  var KEY = "wu-tune", saved = JSON.parse(JSON.stringify(T)), savedH = parseFloat(getComputedStyle(top).height) / innerHeight * 100;
  var ROWS = [
    ["Burst", [["bang", "length (share of opening)", 0.03, 0.6, 0.005], ["ease", "sharpness", 1, 8, 0.1], ["core", "seed radius", 0, 0.3, 0.005], ["spread", "slow ones trail", 0, 0.95, 0.05], ["fingers", "lobes by direction", 0, 0.9, 0.05], ["warm", "dust warmth", 0, 1, 0.05]]],
    ["Heat", [["cool", "white heat lasts (× burst)", 0.5, 4, 0.05], ["heat", "brightness", 1, 3, 0.05], ["glowIn", "field brightens over", 0.02, 1, 0.01], ["hot", "hot colour", "color"]]],
    ["Singularity", [["bangX", "x", -4, 4, 0.05], ["bangY", "y", -3, 3, 0.05], ["bangZ", "depth", -3, 3, 0.05], ["singFade", "fades over", 0.005, 0.2, 0.005]]],
    ["Galaxy", [["galaxyAt", "dust gathers at", 0, 0.6, 0.01], ["galaxyIn", "gathers over", 0.02, 0.8, 0.01], ["gal3d", "in the scene (1) · old backdrop (0)", 0, 1, 1], ["galTint", "takes the web's hues", 0, 1, 0.05], ["galGather", "dims as the web forms", 0, 0.8, 0.05]]],
    ["Pace", [["height", "opening height (vh)", 150, 900, 10]]],
  ];
  function hex(r, g, b) { return "#" + [r, g, b].map(function (v) { return Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0"); }).join(""); }
  function get(k) { return k === "height" ? savedHeight() : k === "hot" ? hex(T.hotR, T.hotG, T.hotB) : T[k]; }
  function savedHeight() { return Math.round(parseFloat(top.style.height) || savedH); }
  function set(k, v) {
    if (k === "height") top.style.height = v + "vh";
    else if (k === "hot") { T.hotR = parseInt(v.slice(1, 3), 16) / 255; T.hotG = parseInt(v.slice(3, 5), 16) / 255; T.hotB = parseInt(v.slice(5, 7), 16) / 255; }
    else T[k] = +v;
  }
  function store() { try { sessionStorage.setItem(KEY, JSON.stringify({ tune: T, height: savedHeight() })); } catch (e) {} }
  try { var s = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (s) { Object.assign(T, s.tune); if (Math.round(s.height) !== Math.round(savedH)) top.style.height = s.height + "vh"; } } catch (e) {}

  var css = "#wu-tune{position:fixed;right:12px;bottom:12px;z-index:2147483000;width:280px;max-height:80vh;overflow:auto;background:rgba(14,14,18,.92);color:#eee;font:11px/1.35 'IBM Plex Mono',monospace;border:1px solid #333;border-radius:8px;padding:10px 12px;backdrop-filter:blur(6px)}"
    + "#wu-tune[hidden]{display:none}#wu-tune h4{margin:10px 0 4px;font:600 10px 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#d9b36a}"
    + "#wu-tune label{display:grid;grid-template-columns:1fr 52px;gap:2px 6px;margin:4px 0}#wu-tune input[type=range]{grid-column:1/3;width:100%;margin:0}"
    + "#wu-tune .v{text-align:right;color:#aaa}#wu-tune .v.d{color:#ffcf7a}#wu-tune .bar{display:flex;gap:6px;margin-top:10px}#wu-tune button{flex:1;font:inherit;padding:5px;border-radius:5px;border:1px solid #555;background:#222;color:#eee;cursor:pointer}"
    + "#wu-tune button.save{background:#d9b36a;color:#111;border-color:#d9b36a}#wu-tune .p{color:#888;display:flex;justify-content:space-between}#wu-tune .msg{color:#9c9;min-height:1.3em;margin-top:6px}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var box = document.createElement("div"); box.id = "wu-tune"; box.hidden = sessionStorage.getItem(KEY + ":hidden") === "1";
  box.innerHTML = '<div class="p"><b>Opening · live</b><span>P <span data-p>0</span> · T hides</span></div>';
  var inputs = {};
  ROWS.forEach(function (g) {
    var h = document.createElement("h4"); h.textContent = g[0]; box.appendChild(h);
    g[1].forEach(function (r) {
      var l = document.createElement("label"), name = document.createElement("span"), val = document.createElement("span"), inp = document.createElement("input");
      name.textContent = r[1]; val.className = "v";
      if (r[2] === "color") inp.type = "color"; else { inp.type = "range"; inp.min = r[2]; inp.max = r[3]; inp.step = r[4]; }
      inp.value = get(r[0]); val.textContent = inp.value;
      inp.addEventListener("input", function () { set(r[0], inp.value); val.textContent = inp.value; mark(); store(); });
      l.appendChild(name); l.appendChild(val); l.appendChild(inp); box.appendChild(l); inputs[r[0]] = { inp: inp, val: val };
    });
  });
  var bar = document.createElement("div"); bar.className = "bar";
  bar.innerHTML = '<button class="save">Save</button><button data-a="reset">Reset</button><button data-a="copy">Copy</button>';
  var msg = document.createElement("div"); msg.className = "msg"; box.appendChild(bar); box.appendChild(msg); document.body.appendChild(box);
  function mark() { // values that differ from what's saved in the page are highlighted
    Object.keys(inputs).forEach(function (k) { var o = k === "height" ? Math.round(savedH) : k === "hot" ? hex(saved.hotR, saved.hotG, saved.hotB) : saved[k]; inputs[k].val.classList.toggle("d", String(get(k)) !== String(o)); });
  }
  function refresh() { Object.keys(inputs).forEach(function (k) { inputs[k].inp.value = get(k); inputs[k].val.textContent = inputs[k].inp.value; }); mark(); }
  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.classList.contains("save")) {
      var body = JSON.stringify({ tune: T, height: savedHeight() });
      fetch("/__tune", { method: "POST", headers: { "content-type": "application/json" }, body: body }).then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error(t); return t; }); })
        .then(function (t) { msg.textContent = t; try { sessionStorage.removeItem(KEY); } catch (er) {} }) // the page reloads with the saved values
        .catch(function (er) { msg.style.color = "#f88"; msg.textContent = "save failed: " + er.message; });
    } else if (b.dataset.a === "reset") { Object.assign(T, saved); top.style.height = ""; try { sessionStorage.removeItem(KEY); } catch (er) {} refresh(); msg.textContent = "back to the saved values"; }
    else { navigator.clipboard.writeText(JSON.stringify({ tune: T, height: savedHeight() })).then(function () { msg.textContent = "copied"; }); }
  });
  addEventListener("keydown", function (e) {
    if ((e.key === "t" || e.key === "T") && !e.metaKey && !e.ctrlKey && !/input|textarea|select/i.test((e.target.tagName || ""))) { box.hidden = !box.hidden; try { sessionStorage.setItem(KEY + ":hidden", box.hidden ? "1" : "0"); } catch (er) {} }
  });
  var pEl = box.querySelector("[data-p]");
  (function tick() { var r = top.getBoundingClientRect(), P = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight))); pEl.textContent = P.toFixed(3); requestAnimationFrame(tick); })();
  refresh();
})();
