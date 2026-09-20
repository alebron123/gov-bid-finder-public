import { hbar, vbar, line, card, fmt, usd } from "./charts.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SOURCE_LABEL = { "sam.gov": "Federal (SAM.gov)", myfloridamarketplace: "Florida state (MFMP)" };
const sourceLabel = (v) => SOURCE_LABEL[v] || v;
const NAICS_SECTOR = { 11: "Agriculture", 21: "Mining & extraction", 22: "Utilities", 23: "Construction", 31: "Manufacturing", 32: "Manufacturing", 33: "Manufacturing", 42: "Wholesale", 44: "Retail", 45: "Retail", 48: "Transportation", 49: "Warehousing", 51: "Information", 52: "Finance", 53: "Real estate & leasing", 54: "Professional & technical", 55: "Management", 56: "Admin, support & waste", 61: "Education", 62: "Health care", 71: "Arts & recreation", 72: "Food & lodging", 81: "Repair & other services", 92: "Public administration" };
const naicsLabel = (c) => `${c} · ${NAICS_SECTOR[String(c).slice(0, 2)] || "Other"}`;
const titleCase = (s) => String(s || "").toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bOf\b/g, "of").replace(/\bThe\b/g, "the");

const theme = localStorage.getItem("theme");
if (theme) document.documentElement.dataset.theme = theme;
$("#theme-toggle").onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
  if (currentTab() === "dashboard") renderDashboard();
};
const currentTab = () => document.querySelector("[role=tab][aria-selected=true]").dataset.tab;
document.querySelectorAll("[role=tab]").forEach((b) => b.onclick = () => {
  document.querySelectorAll("[role=tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + b.dataset.tab));
  if (b.dataset.tab === "dashboard") renderDashboard();
  if (b.dataset.tab === "search") runSearch(1);
});

// ---- data ----
const F = { ID: 0, TITLE: 1, DEPT: 2, TYPE: 3, SA: 4, DUE: 5, NAICS: 6, STATE: 7, CITY: 8, LINK: 9, SRC: 10, SNIP: 11, POSTED: 12, SUBTIER: 13, CONTACT: 14, SCORE: 15, SIMP: 16, VALUE: 17, BENCH: 18, US: 19 };
const V = { NAME: 0, CITY: 1, STATE: 2, AWARDS: 3, AVG: 4, LAST: 5, REL: 6 };
let VENDORS = {};
let META = null, ROWS = [], HAY = [];

$("#pill-data").textContent = "loading…";
const res = await fetch("./data.json");
const payload = await res.json();
META = payload.meta; ROWS = payload.rows;
const D = META.dicts;
fetch("./vendors.json").then((r) => r.json()).then((v) => { VENDORS = v; }).catch(() => {});
HAY = ROWS.map((r) => (r[F.TITLE] + " " + r[F.SNIP] + " " + D.depts[r[F.DEPT]] + " " + r[F.NAICS]).toLowerCase());
$("#pill-data").textContent = `${META.total.toLocaleString()} open notices`;

const dept = (r) => D.depts[r[F.DEPT]] || "";
const type = (r) => D.types[r[F.TYPE]] || "";
const setaside = (r) => D.setasides[r[F.SA]] || "";
const source = (r) => D.sources[r[F.SRC]] || "";
const daysLeft = (d) => Math.ceil((new Date(d + "T23:59:59") - Date.now()) / 86400e3);

// ---- filter selects ----
function fillSelect(sel, values, label) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  for (const [v, n] of [...counts].sort((a, b) => b[1] - a[1]))
    if (v) { const o = document.createElement("option"); o.value = v; o.textContent = `${label(v)} (${n.toLocaleString()})`; sel.appendChild(o); }
}
for (const sel of [$("#d-state"), $("#s-state")]) {
  const counts = new Map();
  for (const r of ROWS) if (r[F.STATE]) counts.set(r[F.STATE], (counts.get(r[F.STATE]) || 0) + 1);
  for (const [v, n] of [...counts].sort()) { const o = document.createElement("option"); o.value = v; o.textContent = `${v} (${n.toLocaleString()})`; sel.appendChild(o); }
}
for (const sel of [$("#d-source"), $("#s-source")]) fillSelect(sel, ROWS.map(source), sourceLabel);
fillSelect($("#s-dept"), ROWS.map(dept), titleCase);
fillSelect($("#s-type"), ROWS.map(type), (v) => v);

// ---- filtering ----
const money = (n) => !n ? "?" : n >= 1e6 ? "$" + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "k" : "$" + Math.round(n);
function filtered({ state, src, sa, days, q, dep, ty, us, sort }) {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = days ? new Date(Date.now() + days * 86400e3).toISOString().slice(0, 10) : null;
  const terms = (q || "").toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i];
    if (r[F.DUE] < today) continue;
    if (cutoff && r[F.DUE] > cutoff) continue;
    if (state && r[F.STATE] !== state) continue;
    if (src && source(r) !== src) continue;
    if (dep && dept(r) !== dep) continue;
    if (ty && type(r) !== ty) continue;
    if (sa === "small" ? !setaside(r) : sa && setaside(r) !== sa) continue;
    if (us && !r[F.US]) continue;
    if (terms.length) { const h = HAY[i]; if (!terms.every((t) => h.includes(t))) continue; }
    out.push(r);
  }
  if (sort === "value") {
    // One row per title: re-posts and amendments repeat.
    const seen = new Set(), uniq = [];
    for (const r of out.sort((a, b) => (b[F.SCORE] || 0) - (a[F.SCORE] || 0) || a[F.DUE].localeCompare(b[F.DUE]))) {
      if (r[F.VALUE] == null) continue;
      const k = r[F.TITLE];
      if (seen.has(k)) continue;
      seen.add(k); uniq.push(r);
    }
    return uniq;
  }
  if (sort === "posted") return out.sort((a, b) => (b[F.POSTED] || "").localeCompare(a[F.POSTED] || ""));
  return out;
}
const tally = (rows, key) => {
  const m = new Map();
  for (const r of rows) { const k = key(r); if (k) m.set(k, (m.get(k) || 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
};

// ---- dashboard ----
function renderDashboard() {
  const rows = filtered({ state: $("#d-state").value, src: $("#d-source").value, sa: $("#d-setaside").value, days: Number($("#d-days").value) || 0 });
  const scope = $("#d-state").value ? `in ${$("#d-state").value}` : "nationwide";
  const soon = rows.filter((r) => daysLeft(r[F.DUE]) <= 7).length;
  const small = rows.filter((r) => setaside(r)).length;
  const awards12 = META.awards_by_month.reduce((a, b) => a + (b.dollars || 0), 0);
  const bySrc = tally(rows, source);
  $("#tiles").innerHTML = [
    ["Matching your filters", rows.length.toLocaleString(), bySrc.length > 1 ? bySrc.map((x) => `${x.value.toLocaleString()} ${sourceLabel(x.label).replace(/ \(.*\)/, "")}`).join(" · ") : `open notices ${scope}`],
    ["Closing this week", soon.toLocaleString(), `deadlines within 7 days ${scope}`],
    ["Reserved for small business", small.toLocaleString(), `of ${rows.length.toLocaleString()} shown`],
    ["Awarded, last 12 months", usd(awards12), `${META.awards_by_month.reduce((a, b) => a + b.value, 0).toLocaleString()} contracts`],
  ].map(([l, v, s]) => `<div class="card tile"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join("");

  const host = $("#charts"); host.innerHTML = "";
  const pending = [];
  const add = (t, s, fn) => { const k = card(t, s); host.appendChild(k); pending.push(() => fn(k.querySelector(".plot"))); };

  const weeks = new Map();
  for (const r of rows) {
    const d = new Date(r[F.DUE] + "T12:00:00"); d.setDate(d.getDate() - d.getDay());
    const k = d.toISOString().slice(0, 10);
    weeks.set(k, (weeks.get(k) || 0) + 1);
  }
  const wk = [...weeks].sort().slice(0, 9).map(([label, value]) => ({ label, value, short: label.slice(5).replace("-", "/"), full: "Week of " + label }));
  add("When the deadlines land", "Open notices by response week. Tall bars are crowded weeks.", (el) => vbar(el, wk));
  add("Who is buying", "Top agencies posting notices that match your filters.", (el) =>
    hbar(el, tally(rows, dept).slice(0, 10).map((d) => ({ ...d, label: titleCase(d.label) })), { onClick: (d) => jump({ dept: tally(rows, dept).find((x) => titleCase(x.label) === d.label).label }) }));
  add("Who is allowed to bid", "Set-aside status. Anything but “Open to all” restricts bidders to certified firms.", (el) =>
    hbar(el, tally(rows, (r) => setaside(r) || "Open to all").slice(0, 8).map((d) => ({ ...d, label: d.label.replace(/\s*\(FAR[^)]*\)/, "").replace(" Set-Aside", "").replace(" Set Aside - Total", "") }))));
  add("Where the work is", "Place of performance by state.", (el) =>
    hbar(el, tally(rows, (r) => r[F.STATE]).slice(0, 12), { onClick: (d) => { $("#d-state").value = d.label; renderDashboard(); } }));
  add("What gets bought most", "NAICS industry codes, the government's industry classification.", (el) =>
    hbar(el, tally(rows, (r) => r[F.NAICS]).slice(0, 10).map((d) => ({ ...d, code: d.label, label: naicsLabel(d.label) })), { onClick: (d) => jump({ q: d.code }) }));
  add("Contract dollars awarded", "Total award value per month, last 12 months. Shows how much money moves in this market.", (el) =>
    line(el, META.awards_by_month.map((d) => ({ label: d.label, value: d.dollars || 0, short: d.label.slice(5) + "/" + d.label.slice(2, 4), full: d.label, note: `${d.value.toLocaleString()} contracts` })), { valueFmt: usd }));
  requestAnimationFrame(() => pending.forEach((f) => f()));
}
["#d-state", "#d-source", "#d-setaside", "#d-days"].forEach((s) => $(s).onchange = renderDashboard);
addEventListener("resize", () => { clearTimeout(window._rz); window._rz = setTimeout(() => { if (currentTab() === "dashboard") renderDashboard(); }, 200); });

// ---- search ----
let page = 1, hits = [];
function dueHtml(d) {
  const n = daysLeft(d);
  const cls = n <= 3 ? "soon" : n <= 10 ? "warn" : "";
  return `<span class="due ${cls}">${n < 0 ? "closed" : n === 0 ? "due today" : `${n} day${n > 1 ? "s" : ""} left`}</span>`;
}
function oppCard(r) {
  const sa = setaside(r);
  const hasVendors = r[F.NAICS] && VENDORS[r[F.NAICS]];
  const chips = r[F.SCORE] != null ? `
      <span class="sep">·</span>
      <span class="tag" title="Typical award in this industry code, from ${r[F.BENCH]} real awards">est. ${money(r[F.VALUE])}</span>
      <span class="tag">${r[F.SIMP] >= 80 ? "simple" : r[F.SIMP] >= 55 ? "moderate" : "complex"}</span>
      <span class="score" title="Value weighted by how easy it is to win"><span class="meter"><span style="width:${r[F.SCORE]}%"></span></span>${r[F.SCORE]}</span>` : "";
  return `<article class="opp" data-id="${r[F.ID]}">
    ${hasVendors ? `<button class="btn find-co" data-id="${r[F.ID]}" title="Companies that already win this kind of work">Find companies</button>` : ""}
    <h3>${esc(r[F.TITLE])}</h3>
    <div class="meta">${dueHtml(r[F.DUE])} <span class="sep">·</span> <span>${esc(titleCase(dept(r)))}</span>
      ${r[F.STATE] ? `<span class="sep">·</span><span>${esc([r[F.CITY], r[F.STATE]].filter(Boolean).join(", "))}</span>` : ""}
      ${sa ? `<span class="tag setaside">${esc(sa.replace(/\s*\(FAR[^)]*\)/, ""))}</span>` : ""}
      <span class="tag">${esc(type(r))}</span>
      ${r[F.NAICS] ? `<span class="tag">NAICS ${r[F.NAICS]}</span>` : ""}
      ${source(r) !== "sam.gov" ? `<span class="tag" style="color:var(--series-2);border-color:color-mix(in srgb,var(--series-2) 45%,transparent)">${esc(sourceLabel(source(r)))}</span>` : ""}
      ${chips}
    </div>
    ${r[F.SNIP] ? `<div class="snippet">${esc(r[F.SNIP])}</div>` : ""}
  </article>`;
}
function runSearch(p = 1) {
  if (p === 1) hits = filtered({ q: $("#s-q").value, state: $("#s-state").value, src: $("#s-source").value,
    dep: $("#s-dept").value, ty: $("#s-type").value, sa: $("#s-setaside").value,
    us: $("#s-us").checked, sort: $("#s-sort").value });
  page = p;
  const host = $("#s-results");
  if (p === 1) host.innerHTML = "";
  if (!hits.length) { host.innerHTML = '<div class="empty">No notices match. Try fewer filters or a broader word.</div>'; $("#s-count").textContent = ""; $("#s-more").hidden = true; return; }
  const slice = hits.slice((p - 1) * 25, p * 25);
  $("#s-count").textContent = `${hits.length.toLocaleString()} notices — showing ${Math.min(p * 25, hits.length).toLocaleString()}`;
  host.insertAdjacentHTML("beforeend", slice.map(oppCard).join(""));
  host.querySelectorAll(".opp").forEach((c) => c.onclick = () => openDetail(c.dataset.id));
  host.querySelectorAll(".find-co").forEach((b) => b.onclick = (e) => { e.stopPropagation(); openVendors(b.dataset.id); });
  $("#s-more").hidden = p * 25 >= hits.length;
}
$("#s-q").addEventListener("input", () => { clearTimeout(window._sq); window._sq = setTimeout(() => runSearch(1), 220); });
["#s-state", "#s-source", "#s-dept", "#s-type", "#s-setaside", "#s-sort", "#s-us"].forEach((s) => $(s).onchange = () => runSearch(1));
$("#s-more").onclick = () => runSearch(page + 1);
function jump(f) {
  document.querySelector("[data-tab=search]").click();
  if (f.q) $("#s-q").value = f.q;
  if (f.dept) $("#s-dept").value = f.dept;
  runSearch(1);
}

// ---- companies that already win this kind of work ----
function openVendors(id) {
  const r = ROWS.find((x) => x[F.ID] === id);
  if (!r) return;
  const list = VENDORS[r[F.NAICS]] || [];
  $("#dlg-title").textContent = r[F.TITLE];
  $("#dlg-meta").innerHTML = `<span class="tag">NAICS ${esc(r[F.NAICS])}</span>
    <span class="tag">typical award ${money(r[F.VALUE])}</span>
    <span class="tag">${r[F.SIMP] >= 80 ? "simple" : r[F.SIMP] >= 55 ? "moderate" : "complex"} to pursue</span>`;
  if (!list.length) { $("#dlg-body").innerHTML = '<div class="callout">No award history on record for this industry code.</div>'; $("#dlg").showModal(); return; }

  const deadline = new Date(r[F.DUE] + "T12:00:00").toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  $("#dlg-body").innerHTML = `
    <p class="small muted" style="margin:0 0 4px">These companies have won federal contracts under this industry code, from public award records. Ranked by fit: industry match, state, contract size, recency, and number of awards.</p>
    <p class="small muted" style="margin:0 0 14px">Nobody here has expressed interest. This is a prospect list, not a list of willing bidders.</p>
    <div>${list.map((v, i) => `
      <div class="vendor">
        <div class="rel"><b>${v[V.REL]}</b><span>fit</span></div>
        <div class="who">
          <strong>${esc(v[V.NAME])}</strong>
          <div class="small muted">${esc([v[V.CITY], v[V.STATE]].filter(Boolean).join(", ") || "location not listed")}
            · ${v[V.AWARDS]} federal award${v[V.AWARDS] > 1 ? "s" : ""} here, averaging ${money(v[V.AVG])}
            · last ${esc(v[V.LAST] || "unknown")}</div>
        </div>
        <div class="acts">
          <a class="btn ghost" target="_blank" rel="noopener"
             href="https://www.google.com/search?q=${encodeURIComponent('"' + v[V.NAME] + '" ' + [v[V.CITY], v[V.STATE]].filter(Boolean).join(" ") + " contact")}">Find contact</a>
          <button class="btn act-mail" data-i="${i}">Write email</button>
        </div>
      </div>`).join("")}</div>`;

  $("#dlg-body").querySelectorAll(".act-mail").forEach((b) => b.onclick = () => {
    const v = list[Number(b.dataset.i)];
    const subject = `Enquiry - ${r[F.TITLE].slice(0, 60)} (bids due ${r[F.DUE]})`;
    const body = [
      "Hello,",
      "",
      `I am writing about "${r[F.TITLE]}", a ${dept(r)} requirement. Responses are due ${deadline}.`,
      r[F.LINK] ? `The notice is here: ${r[F.LINK]}` : "",
      "",
      `I found you through public federal award records, which show ${v[V.NAME]} has won ${v[V.AWARDS]} contract${v[V.AWARDS] > 1 ? "s" : ""} in this industry code.`,
      "",
      "Are you already planning to bid on this? If not, would you consider teaming on it?",
      "",
      "A one-line reply either way is plenty. If you would rather not hear from us, reply \"no thanks\" and we will not contact you again.",
      "",
      "[Your name]",
      "[Your company]",
      "[Your phone]",
    ].filter((l) => l !== "").join("\n");
    location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  $("#dlg").showModal();
}

// ---- detail ----
function openDetail(id) {
  const r = ROWS.find((x) => x[F.ID] === id);
  if (!r) return;
  $("#dlg-title").textContent = r[F.TITLE];
  $("#dlg-meta").innerHTML = `${dueHtml(r[F.DUE])} <span class="sep">·</span> <span>${esc(titleCase(dept(r)))}</span>
    <span class="tag">${esc(type(r))}</span>${r[F.NAICS] ? `<span class="tag">NAICS ${r[F.NAICS]}</span>` : ""}
    ${r[F.LINK] ? `<a href="${esc(r[F.LINK])}" target="_blank" rel="noopener">Open the official notice ↗</a>` : ""}`;
  const kv = (l, v) => v ? `<dt>${l}</dt><dd>${esc(v)}</dd>` : "";
  $("#dlg-body").innerHTML = `<dl class="kv">
      ${kv("Response deadline", r[F.DUE])}
      ${kv("Posted", r[F.POSTED])}
      ${kv("Set-aside", setaside(r) || "Open to all bidders")}
      ${kv("Place of performance", [r[F.CITY], r[F.STATE]].filter(Boolean).join(", "))}
      ${kv("Office", r[F.SUBTIER])}
      ${kv("Contact", r[F.CONTACT])}
      ${kv("Source", sourceLabel(source(r)))}
    </dl>
    <div class="section"><h4>Notice text</h4><div class="small" style="white-space:pre-wrap">${esc(r[F.SNIP] || "No description in the feed — the detail is in the attachments on the official notice.")}</div></div>
    <div class="callout small">This public page is read-only. The full app adds Claude: a plain-English explanation of this notice, a fit score against your business, and a complete drafted response package.</div>`;
  $("#dlg").showModal();
}

$("#about-built").textContent = `Snapshot of ${META.total.toLocaleString()} open notices, built ${new Date(META.built_at).toLocaleString()}.`;
renderDashboard();
