// Small SVG chart set. One series per chart -> categorical slot 1; hover tooltip on every mark;
// selective direct labels; hairline recessive grid. No dual axes, no value-ramp on nominal bars.
const NS = "http://www.w3.org/2000/svg";
const tip = () => document.getElementById("tip");

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}
export const fmt = (n) => n == null ? "—" : n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k" : String(Math.round(n));
export const usd = (n) => "$" + fmt(n);

function showTip(evt, title, lines) {
  const t = tip();
  t.innerHTML = `<div class="t">${title}</div>` + lines.map((l) => `<div class="muted">${l}</div>`).join("");
  t.style.opacity = 1;
  const r = t.getBoundingClientRect();
  t.style.left = Math.min(window.innerWidth - r.width - 10, evt.clientX + 14) + "px";
  t.style.top = Math.max(8, evt.clientY - r.height - 12) + "px";
}
function hideTip() { tip().style.opacity = 0; }

function hookTip(node, title, lines) {
  node.addEventListener("mousemove", (e) => showTip(e, title, lines));
  node.addEventListener("mouseleave", hideTip);
}

// Horizontal bars: best for long category labels (agency names, set-asides, NAICS).
export function hbar(host, data, { valueLabel = "notices", max = null, onClick = null } = {}) {
  host.innerHTML = "";
  if (!data.length) { host.innerHTML = '<div class="empty small">No data for these filters.</div>'; return; }
  const rowH = 32, gap = 2, labelW = 190, valueW = 54, w = host.clientWidth || 420;
  const plotW = Math.max(60, w - labelW - valueW);
  const h = data.length * rowH;
  const top = max ?? (Math.max(...data.map((d) => d.value)) || 1);
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, height: h, role: "img" }, host);
  data.forEach((d, i) => {
    const y = i * rowH;
    const g = el("g", { class: "bar-row", style: onClick ? "cursor:pointer" : "" }, svg);
    el("text", { x: labelW - 10, y: y + rowH / 2 + 4, "text-anchor": "end", class: "blabel" }, g).textContent =
      d.label.length > 28 ? d.label.slice(0, 27) + "…" : d.label;
    el("rect", { x: labelW, y: y + gap, width: plotW, height: rowH - gap * 2, rx: 4, class: "bar-track" }, g);
    const bw = Math.max(2, (d.value / top) * plotW);
    el("rect", { x: labelW, y: y + gap, width: bw, height: rowH - gap * 2, rx: 4, fill: "var(--series-1)", class: "bar" }, g);
    el("text", { x: labelW + plotW + 8, y: y + rowH / 2 + 4, class: "bvalue" }, g).textContent = fmt(d.value);
    el("rect", { x: 0, y, width: w, height: rowH, fill: "transparent" }, g);
    hookTip(g, d.label, [`${d.value.toLocaleString()} ${valueLabel}`, ...(d.note ? [d.note] : [])]);
    if (onClick) g.addEventListener("click", () => onClick(d));
  });
}

// Vertical bars over time (deadline pressure by week).
export function vbar(host, data, { valueLabel = "notices", onClick = null } = {}) {
  host.innerHTML = "";
  if (!data.length) { host.innerHTML = '<div class="empty small">No data for these filters.</div>'; return; }
  const w = host.clientWidth || 420, h = 230, padL = 40, padB = 32, padT = 14;
  const plotW = w - padL - 8, plotH = h - padB - padT;
  const top = Math.max(...data.map((d) => d.value)) || 1;
  const step = plotW / data.length, bw = Math.min(46, step - 5);
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, height: h, role: "img" }, host);
  for (let i = 0; i <= 3; i++) {
    const v = (top / 3) * i, y = padT + plotH - (v / top) * plotH;
    el("line", { x1: padL, x2: w - 8, y1: y, y2: y, class: i === 0 ? "axisline" : "gridline" }, svg);
    el("text", { x: padL - 7, y: y + 4, "text-anchor": "end", class: "tick" }, svg).textContent = fmt(v);
  }
  data.forEach((d, i) => {
    const bh = Math.max(2, (d.value / top) * plotH);
    const x = padL + i * step + (step - bw) / 2, y = padT + plotH - bh;
    const g = el("g", { class: "bar-row", style: onClick ? "cursor:pointer" : "" }, svg);
    el("rect", { x, y, width: bw, height: bh, rx: 4, fill: "var(--series-1)", class: "bar" }, g);
    el("rect", { x: padL + i * step, y: padT, width: step, height: plotH, fill: "transparent" }, g);
    if (data.length <= 10 || i % 2 === 0)
      el("text", { x: x + bw / 2, y: h - 10, "text-anchor": "middle", class: "tick" }, svg).textContent = d.short ?? d.label;
    hookTip(g, d.full ?? d.label, [`${d.value.toLocaleString()} ${valueLabel}`]);
    if (onClick) g.addEventListener("click", () => onClick(d));
  });
}

// Single-series line with area, for award dollars over months.
export function line(host, data, { valueFmt = fmt, valueLabel = "" } = {}) {
  host.innerHTML = "";
  if (data.length < 2) { host.innerHTML = '<div class="empty small">Not enough history yet.</div>'; return; }
  const w = host.clientWidth || 420, h = 230, padL = 52, padB = 28, padT = 14;
  const plotW = w - padL - 10, plotH = h - padB - padT;
  const top = Math.max(...data.map((d) => d.value)) || 1;
  const X = (i) => padL + (i / (data.length - 1)) * plotW;
  const Y = (v) => padT + plotH - (v / top) * plotH;
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, height: h, role: "img" }, host);
  for (let i = 0; i <= 3; i++) {
    const v = (top / 3) * i, y = Y(v);
    el("line", { x1: padL, x2: w - 10, y1: y, y2: y, class: i === 0 ? "axisline" : "gridline" }, svg);
    el("text", { x: padL - 7, y: y + 4, "text-anchor": "end", class: "tick" }, svg).textContent = valueFmt(v);
  }
  const pts = data.map((d, i) => `${X(i)},${Y(d.value)}`).join(" ");
  el("polygon", { points: `${padL},${Y(0)} ${pts} ${X(data.length - 1)},${Y(0)}`, fill: "var(--series-1)", opacity: .1 }, svg);
  el("polyline", { points: pts, fill: "none", stroke: "var(--series-1)", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
  const last = data.length - 1;
  el("circle", { cx: X(last), cy: Y(data[last].value), r: 4.5, fill: "var(--series-1)", stroke: "var(--surface-1)", "stroke-width": 2 }, svg);
  el("text", { x: X(last) - 6, y: Y(data[last].value) - 11, "text-anchor": "end", class: "bvalue" }, svg).textContent = valueFmt(data[last].value);
  data.forEach((d, i) => {
    if (i % Math.ceil(data.length / 6) === 0)
      el("text", { x: X(i), y: h - 8, "text-anchor": "middle", class: "tick" }, svg).textContent = d.short ?? d.label;
    const hit = el("rect", { x: X(i) - plotW / (data.length * 2), y: padT, width: plotW / data.length, height: plotH, fill: "transparent" }, svg);
    hookTip(hit, d.full ?? d.label, [`${valueFmt(d.value)} ${valueLabel}`.trim(), ...(d.note ? [d.note] : [])]);
  });
}

export function card(title, sub) {
  const d = document.createElement("div");
  d.className = "card";
  d.innerHTML = `<p class="chart-title">${title}</p><p class="chart-sub">${sub}</p><div class="plot"></div>`;
  return d;
}
