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
  const rowH = 27, gap = 2, labelW = 168, valueW = 46, w = host.clientWidth || 420;
  const plotW = Math.max(60, w - labelW - valueW);
  const h = data.length * rowH;
  const top = max ?? (Math.max(...data.map((d) => d.value)) || 1);
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, height: h, role: "img" }, host);
  data.forEach((d, i) => {
    const y = i * rowH;
    const g = el("g", { class: "bar-row", style: onClick ? "cursor:pointer" : "" }, svg);
    el("text", { x: labelW - 10, y: y + rowH / 2 + 4, "text-anchor": "end", class: "blabel" }, g).textContent =
      d.label.length > 26 ? d.label.slice(0, 25) + "…" : d.label;
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
  const w = host.clientWidth || 420, h = 190, padL = 34, padB = 30, padT = 12;
  const plotW = w - padL - 8, plotH = h - padB - padT;
  const top = Math.max(...data.map((d) => d.value)) || 1;
  const step = plotW / data.length, bw = Math.min(38, step - 4);
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
  const w = host.clientWidth || 420, h = 190, padL = 44, padB = 26, padT = 12;
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

// Five shades of series-1 for heatmaps. Quantile breaks, not linear: one state
// (Maryland, Virginia) would otherwise turn every other state the palest shade.
const HEAT_MIX = [16, 34, 52, 72, 94];
const heatFill = (bin) => bin < 0 ? "var(--grid)" : `color-mix(in srgb, var(--series-1) ${HEAT_MIX[bin]}%, var(--surface-1))`;
export function quantileBins(values, n = HEAT_MIX.length) {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!sorted.length) return () => -1;
  const breaks = Array.from({ length: n - 1 }, (_, i) => sorted[Math.floor(((i + 1) / n) * sorted.length)]);
  return (v) => v > 0 ? breaks.filter((b) => v >= b).length : -1;
}
function heatLegend(host, lo, hi, label) {
  const d = document.createElement("div");
  d.className = "heat-legend";
  d.innerHTML = `<span>${label}: ${fmt(lo)}</span>${HEAT_MIX.map((_, i) => `<i style="background:${heatFill(i)}"></i>`).join("")}<span>${fmt(hi)}</span>`;
  host.appendChild(d);
}

// Tile-grid US map: every state the same size, so small states (DC, RI, DE) stay
// visible and clickable. [col, row] on an 11 x 8 grid.
const TILE = {
  AK: [0, 0], ME: [10, 0], VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [8, 7], PR: [10, 7],
};
// Any tile grid: `tiles` maps a key to [label, col, row]. Used for US states and
// Florida counties.
export function tileMap(host, counts, tiles, { selected = "", names = {}, notes = {}, valueLabel = "open notices", onClick = null, maxTile = 54, ariaLabel = "Map" } = {}) {
  host.innerHTML = "";
  const cells = Object.values(tiles);
  const cols = Math.max(...cells.map((t) => t[1])) + 1, rows = Math.max(...cells.map((t) => t[2])) + 1, gap = 4;
  const w = host.clientWidth || 520;
  const s = Math.min(maxTile, (w - gap * (cols - 1)) / cols);
  const svg = el("svg", { viewBox: `0 0 ${cols * (s + gap)} ${rows * (s + gap)}`, role: "img", "aria-label": ariaLabel }, host);
  svg.style.maxWidth = `${cols * (s + gap)}px`;
  const bin = quantileBins(Object.keys(tiles).map((k) => counts[k] || 0));
  for (const [key, [label, c, r]] of Object.entries(tiles)) {
    const v = counts[key] || 0, b = bin(v);
    const g = el("g", { class: "map-tile", style: onClick && v ? "cursor:pointer" : "" }, svg);
    const x = c * (s + gap), y = r * (s + gap);
    el("rect", { x, y, width: s, height: s, rx: Math.min(6, s / 6), fill: heatFill(b), class: key === selected ? "sel" : "" }, g);
    const ink = b >= 3 ? "#fff" : "var(--text-primary)";
    const small = s < 34;
    const code = el("text", { x: x + s / 2, y: y + s / 2 + (small ? 4 : -2), "text-anchor": "middle", class: "map-code", fill: ink }, g);
    code.textContent = label;
    if (small) code.setAttribute("style", `font-size:${Math.max(7, s * 0.3)}px`);
    else el("text", { x: x + s / 2, y: y + s / 2 + 13, "text-anchor": "middle", class: "map-n", fill: ink }, g).textContent = v ? fmt(v) : "–";
    hookTip(g, names[key] || key, [`${v.toLocaleString()} ${valueLabel}`, ...(notes[key] ? [notes[key]] : [])]);
    if (onClick && v) g.addEventListener("click", () => onClick(key));
  }
  const vals = Object.keys(tiles).map((k) => counts[k] || 0).filter((v) => v > 0);
  if (vals.length) heatLegend(host, Math.min(...vals), Math.max(...vals), "Fewer");
}

const STATE_TILES = Object.fromEntries(Object.entries(TILE).map(([k, [c, r]]) => [k, [k, c, r]]));
export const stateMap = (host, counts, opts = {}) => tileMap(host, counts, STATE_TILES, { ariaLabel: "Open notices by state", ...opts });

// Calendar heatmap: one square per day, weeks as columns, so crowded deadline days
// stand out the way they would on a wall calendar.
export function calendarHeat(host, byDay, { start, weeks = 13, today = "", valueLabel = "deadlines" } = {}) {
  host.innerHTML = "";
  const first = new Date(start + "T12:00:00");
  first.setDate(first.getDate() - first.getDay());
  const padL = 26, padT = 18, gap = 3;
  const w = host.clientWidth || 420;
  const s = Math.max(9, Math.min(30, (w - padL - gap * weeks) / weeks));
  const svg = el("svg", { viewBox: `0 0 ${padL + weeks * (s + gap)} ${padT + 7 * (s + gap)}`, role: "img", "aria-label": "Deadlines per day" }, host);
  svg.style.maxWidth = `${padL + weeks * (s + gap)}px`;
  ["Sun", "", "Tue", "", "Thu", "", "Sat"].forEach((d, i) => d && (el("text", { x: 0, y: padT + i * (s + gap) + s * 0.75, class: "tick" }, svg).textContent = d));
  const days = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(first); d.setDate(first.getDate() + i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  const bin = quantileBins(days.map((k) => byDay[k] || 0));
  let lastMonth = "";
  days.forEach((k, i) => {
    const c = Math.floor(i / 7), r = i % 7, x = padL + c * (s + gap), y = padT + r * (s + gap);
    if (r === 0 && k.slice(0, 7) !== lastMonth) {
      lastMonth = k.slice(0, 7);
      el("text", { x, y: 11, class: "tick" }, svg).textContent = new Date(k + "T12:00:00").toLocaleDateString("en-US", { month: "short" });
    }
    const v = byDay[k] || 0, past = today && k < today;
    const rect = el("rect", { x, y, width: s, height: s, rx: 3, fill: past ? "transparent" : heatFill(bin(v)), class: k === today ? "today" : "" }, svg);
    if (!past) hookTip(rect, new Date(k + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }), [`${v.toLocaleString()} ${valueLabel}`]);
  });
  const vals = days.filter((k) => !today || k >= today).map((k) => byDay[k] || 0).filter(Boolean);
  if (vals.length) heatLegend(host, Math.min(...vals), Math.max(...vals), "Quiet");
}

export function card(title, sub) {
  const d = document.createElement("div");
  d.className = "card";
  d.innerHTML = `<p class="chart-title">${title}</p><p class="chart-sub">${sub}</p><div class="plot"></div>`;
  return d;
}
