import { hbar, vbar, line, card, fmt, usd } from "./charts.js?v=2";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SOURCE_LABEL = { "sam.gov": "Federal (SAM.gov)", myfloridamarketplace: "Florida state (MFMP)", "miami-dade": "Miami-Dade County" };
const sourceLabel = (v) => SOURCE_LABEL[v] || v;
const NAICS_SECTOR = { 11: "Agriculture", 21: "Mining & extraction", 22: "Utilities", 23: "Construction", 31: "Manufacturing", 32: "Manufacturing", 33: "Manufacturing", 42: "Wholesale", 44: "Retail", 45: "Retail", 48: "Transportation", 49: "Warehousing", 51: "Information", 52: "Finance", 53: "Real estate & leasing", 54: "Professional & technical", 55: "Management", 56: "Admin, support & waste", 61: "Education", 62: "Health care", 71: "Arts & recreation", 72: "Food & lodging", 81: "Repair & other services", 92: "Public administration" };
const STATE_NAME = { AL:"Alabama", AK:"Alaska", AZ:"Arizona", AR:"Arkansas", CA:"California", CO:"Colorado",
  CT:"Connecticut", DE:"Delaware", FL:"Florida", GA:"Georgia", HI:"Hawaii", ID:"Idaho", IL:"Illinois", IN:"Indiana",
  IA:"Iowa", KS:"Kansas", KY:"Kentucky", LA:"Louisiana", ME:"Maine", MD:"Maryland", MA:"Massachusetts", MI:"Michigan",
  MN:"Minnesota", MS:"Mississippi", MO:"Missouri", MT:"Montana", NE:"Nebraska", NV:"Nevada", NH:"New Hampshire",
  NJ:"New Jersey", NM:"New Mexico", NY:"New York", NC:"North Carolina", ND:"North Dakota", OH:"Ohio", OK:"Oklahoma",
  OR:"Oregon", PA:"Pennsylvania", RI:"Rhode Island", SC:"South Carolina", SD:"South Dakota", TN:"Tennessee", TX:"Texas",
  UT:"Utah", VT:"Vermont", VA:"Virginia", WA:"Washington", WV:"West Virginia", WI:"Wisconsin", WY:"Wyoming",
  DC:"Washington, D.C.", PR:"Puerto Rico", VI:"U.S. Virgin Islands", GU:"Guam", AS:"American Samoa",
  MP:"Northern Mariana Islands", AE:"Armed Forces Europe", AP:"Armed Forces Pacific", AA:"Armed Forces Americas" };
const stateName = (c) => STATE_NAME[c] || c;
let NAICS_NAME = {};
const naicsName = (c) => NAICS_NAME[String(c)] || "";
const naicsLabel = (c) => naicsName(c) ? `${c} · ${naicsName(c)}` : `${c} · ${NAICS_SECTOR[String(c).slice(0, 2)] || "Other"}`;
const agencyName = (raw) => {
  let v = String(raw || "").trim();
  const m = v.match(/^(.*),\s*(DEPARTMENT|DEPT)\s+OF\.?$/i);
  if (m) v = "Department of " + m[1];
  v = v.replace(/^DEPT OF\b/i, "Department of");
  v = v.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return v.replace(/\bOf\b/g, "of").replace(/\bAnd\b/g, "and").replace(/\bThe\b/g, "the").replace(/^of /, "Of ");
};
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
$("#dlg").addEventListener("close", () => { if (location.hash.startsWith("#c=")) history.replaceState(null, "", location.pathname); });
document.querySelectorAll("[role=tab]").forEach((b) => b.onclick = () => {
  document.querySelectorAll("[role=tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + b.dataset.tab));
  if (b.dataset.tab === "dashboard") renderDashboard();
  if (b.dataset.tab === "search") runSearch(1);
  if (b.dataset.tab === "renewals") initRenewals();
  if (b.dataset.tab === "plan") initPlan();
  if (b.dataset.tab === "saved") renderSaved();
});

// ---- data ----
const F = { ID: 0, TITLE: 1, DEPT: 2, TYPE: 3, SA: 4, DUE: 5, NAICS: 6, STATE: 7, CITY: 8, LINK: 9, SRC: 10, SNIP: 11, POSTED: 12, SUBTIER: 13, CONTACT: 14, EMAIL: 15, CNAME: 16, SCORE: 17, SIMP: 18, VALUE: 19, BENCH: 20, US: 21 };

// Gmail opens in this account, so the message is already coming from the right address.
const SEND_AS = "govbidfind@gmail.com";
const gmailUrl = ({ to, su, bo }) =>
  `https://mail.google.com/mail/?view=cm&fs=1&authuser=${encodeURIComponent(SEND_AS)}`
  + `&to=${encodeURIComponent(to || "")}&su=${encodeURIComponent(su || "")}&body=${encodeURIComponent(bo || "")}`;
const V = { NAME: 0, CITY: 1, STATE: 2, AWARDS: 3, AVG: 4, LAST: 5, REL: 6, EMAIL: 7, PHONE: 8, DOMAIN: 9 };
let VENDORS = {};
let META = null, ROWS = [], HAY = [];

$("#pill-data").textContent = "loading…";
const res = await fetch("./data.json");
const payload = await res.json();
META = payload.meta; ROWS = payload.rows;
const D = META.dicts;
fetch("./vendors.json").then((r) => r.json()).then((v) => { VENDORS = v; }).catch(() => {});
NAICS_NAME = META.naics_names || {};
// Searching "roofing" should find a roofing contract whose title never says it, so the
// industry name goes into the haystack alongside the title and description.
HAY = ROWS.map((r) => (r[F.TITLE] + " " + r[F.SNIP] + " " + D.depts[r[F.DEPT]] + " " + r[F.NAICS] + " " + naicsName(r[F.NAICS])).toLowerCase());
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
  // The federal feed carries a few malformed codes ("AL-11", "AM-AG"); only list real ones.
  const sorted = [...counts].filter(([v]) => STATE_NAME[v]).sort((a, b) => stateName(a[0]).localeCompare(stateName(b[0])));
  for (const [v, n] of sorted) { const o = document.createElement("option"); o.value = v; o.textContent = `${stateName(v)} (${n.toLocaleString()})`; sel.appendChild(o); }
}
for (const sel of [$("#d-source"), $("#s-source")]) fillSelect(sel, ROWS.map(source), sourceLabel);
fillSelect($("#s-dept"), ROWS.map(dept), agencyName);
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
    // One row per title: re-posts and amendments repeat. Notices with no industry code
    // carry no value estimate; they sort to the end rather than disappearing.
    const seen = new Set(), scored = [], unscored = [];
    for (const r of out.sort((a, b) => (b[F.SCORE] || 0) - (a[F.SCORE] || 0) || a[F.DUE].localeCompare(b[F.DUE]))) {
      const k = r[F.TITLE];
      if (seen.has(k)) continue;
      seen.add(k);
      (r[F.VALUE] == null ? unscored : scored).push(r);
    }
    unscored.sort((a, b) => a[F.DUE].localeCompare(b[F.DUE]));
    // A single industry code can own the whole top of the list: every high-value
    // pharmaceutical contract scores alike, so the first ten results were all 325412
    // and every one of them showed the same companies. Round-robin by code so the
    // top of the list spans real industries.
    const byCode = new Map();
    for (const r of scored) {
      const c = r[F.NAICS] || "?";
      if (!byCode.has(c)) byCode.set(c, []);
      byCode.get(c).push(r);
    }
    const spread = [];
    for (let pass = 0; spread.length < scored.length; pass++) {
      let added = 0;
      for (const list of byCode.values()) if (list[pass]) { spread.push(list[pass]); added++; }
      if (!added) break;
    }
    return spread.concat(unscored);
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
  const scope = $("#d-state").value ? `in ${stateName($("#d-state").value)}` : "nationwide";
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
    hbar(el, tally(rows, dept).slice(0, 10).map((d) => ({ ...d, label: agencyName(d.label) })), { onClick: (d) => jump({ dept: tally(rows, dept).find((x) => agencyName(x.label) === d.label).label }) }));
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
    <div class="meta">${dueHtml(r[F.DUE])} <span class="sep">·</span> <span>${esc(agencyName(dept(r)))}</span>
      ${r[F.STATE] ? `<span class="sep">·</span><span>${esc([r[F.CITY], r[F.STATE]].filter(Boolean).join(", "))}</span>` : ""}
      ${sa ? `<span class="tag setaside">${esc(sa.replace(/\s*\(FAR[^)]*\)/, ""))}</span>` : ""}
      <span class="tag">${esc(type(r))}</span>
      ${r[F.NAICS] ? `<span class="tag" title="NAICS ${r[F.NAICS]}">${esc(naicsName(r[F.NAICS]) || "NAICS " + r[F.NAICS])}</span>` : ""}
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

// Ticks are for this visit only. Refreshing puts every button back to normal.
const contacted = new Set();
const contactedKey = (name) => String(name).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 28);
const markContacted = (name) => contacted.add(contactedKey(name));
const isContacted = (name) => contacted.has(contactedKey(name));

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
          <strong>${esc(v[V.NAME])}</strong>${isContacted(v[V.NAME]) ? ' <span class="sent-tick" title="You have emailed this company">✓ emailed</span>' : ""}
          <div class="small muted">${esc([v[V.CITY], v[V.STATE]].filter(Boolean).join(", ") || "location not listed")}
            · ${v[V.AWARDS]} federal award${v[V.AWARDS] > 1 ? "s" : ""} here, averaging ${money(v[V.AVG])}
            · last ${esc(v[V.LAST] || "unknown")}</div>
          ${v[V.EMAIL] ? `<div class="small" style="margin-top:4px"><strong>${esc(v[V.EMAIL])}</strong>${v[V.PHONE] ? ` · ${esc(v[V.PHONE])}` : ""}</div>`
            : v[V.PHONE] ? `<div class="small muted" style="margin-top:4px">${esc(v[V.PHONE])} · no published email</div>` : ""}
        </div>
        <div class="acts">

          <button type="button" class="btn act-mail ${isContacted(v[V.NAME]) ? "ticked" : ""}" data-i="${i}">${isContacted(v[V.NAME]) ? '<span class="tick-mark">\u2713</span> emailed' : "Write email"}</button>
        </div>
      </div>`).join("")}</div>`;

  $("#dlg-body").querySelectorAll(".act-mail").forEach((b) => b.addEventListener("click", () => {
    // Nothing is sent and nothing navigates. The click only marks the company and ticks.
    markContacted(list[Number(b.dataset.i)][V.NAME]);
    tick(b);
  }));
  $("#dlg").showModal();
}

// Compose panel: writes the email, then hands it to Gmail, Outlook, or the desktop
// mail client. A static page cannot send mail itself, so it hands off to one that can.
// Browsers block window.open in plenty of situations (popup blockers, in-app
// browsers, iOS). If the new tab does not open, go to Gmail in this tab instead
// so the click always does something.
function openMail(url) {
  let w = null;
  try { w = window.open(url, "_blank", "noopener"); } catch { w = null; }
  if (!w || w.closed || typeof w.closed === "undefined") {
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { if (!document.hidden) location.href = url; }, 400);
  }
}

// Turn the button into a tick, briefly, then settle into "emailed".
function tick(btn) {
  btn.classList.add("ticked");
  btn.innerHTML = '<span class="tick-mark">\u2713</span>';
  setTimeout(() => { btn.innerHTML = '<span class="tick-mark">\u2713</span> emailed'; }, 650);
}

// The message itself: subject and body for one company and one contract.
function composeFor(r, v, deadline) {
  return {
    to: v[V.EMAIL] || "",
    su: `Government contract you can bid on \u2014 ${r[F.TITLE].slice(0, 60)}`,
    bo: [
      `Hi,`,
      ``,
      `Thought this might be worth a look. It closes ${deadline}.`,
      ``,
      r[F.TITLE],
      r[F.LINK] || "",
      ``,
      `You came up in the federal award records for this kind of work, which is how I found you.`,
      ``,
      `Worth a conversation?`,
      ``,
      `[Your name]`,
    ].join("\n"),
  };
}

// ---- shortlist: contracts worth coming back to ----
const saved = new Set(JSON.parse(localStorage.getItem("saved") || "[]"));
const persistSaved = () => localStorage.setItem("saved", JSON.stringify([...saved]));
function toggleSaved(id) {
  if (saved.has(id)) saved.delete(id); else saved.add(id);
  persistSaved();
  updateSavedCount();
  return saved.has(id);
}
function updateSavedCount() {
  const b = document.querySelector("[data-tab=saved]");
  if (b) { b.textContent = saved.size ? `Shortlist (${saved.size})` : "Shortlist"; b.hidden = false; }
}
function renderSaved() {
  updateSavedCount();
  const rows = [...saved].map((id) => ROWS.find((r) => r[F.ID] === id)).filter(Boolean)
    .sort((a, b) => a[F.DUE].localeCompare(b[F.DUE]));
  const host = $("#saved-list");
  if (!rows.length) {
    host.innerHTML = '<div class="empty">Nothing saved yet. Open any contract and press Save to build a shortlist.</div>';
    $("#saved-count").textContent = "";
    return;
  }
  const closing = rows.filter((r) => daysLeft(r[F.DUE]) <= 7).length;
  $("#saved-count").textContent = `${rows.length} saved${closing ? ` · ${closing} closing within a week` : ""}`;
  host.innerHTML = rows.map(oppCard).join("");
  host.querySelectorAll(".opp").forEach((c) => c.onclick = () => openDetail(c.dataset.id));
  host.querySelectorAll(".find-co").forEach((b) => b.onclick = (e) => { e.stopPropagation(); openVendors(b.dataset.id); });
}

// ---- detail ----
function openDetail(id) {
  const r = ROWS.find((x) => x[F.ID] === id);
  if (!r) return;
  $("#dlg-title").textContent = r[F.TITLE];
  $("#dlg-meta").innerHTML = `${dueHtml(r[F.DUE])} <span class="sep">·</span> <span>${esc(agencyName(dept(r)))}</span>
    <span class="tag">${esc(type(r))}</span>${r[F.NAICS] ? `<span class="tag">NAICS ${r[F.NAICS]}</span>` : ""}
    ${r[F.LINK] ? `<a class="btn ghost" style="padding:4px 10px;font-size:12px" href="${esc(r[F.LINK])}" target="_blank" rel="noopener">Open the official notice</a>` : ""}`;
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
    ${r[F.EMAIL] ? `<div style="margin-top:16px;padding:14px;background:var(--page);border:1px solid var(--border);border-radius:8px">
      <button type="button" class="btn act-mail" id="ask-buyer">Email the buyer</button>
      <div class="small muted" style="margin-top:8px">The person running this contract is <strong>${esc(r[F.CNAME] || r[F.EMAIL])}</strong> at ${esc(r[F.EMAIL])}.</div>
    </div>` : ""}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
      <button type="button" class="btn ghost" id="save-opp">${saved.has(r[F.ID]) ? "\u2605 Saved" : "\u2606 Save"}</button>
      <button type="button" class="btn ghost" id="share-opp">Copy link</button>
    </div>
    <div class="callout small">This public page is read-only. The full app adds Claude: a plain-English explanation of this notice, a fit score against your business, and a complete drafted response package.</div>`;
  $("#dlg").showModal();
  const ask = $("#ask-buyer");
  if (ask) ask.addEventListener("click", () => { markContacted("buyer:" + r[F.ID]); tick(ask); });
  const sv = $("#save-opp");
  if (sv) sv.addEventListener("click", () => {
    sv.textContent = toggleSaved(r[F.ID]) ? "\u2605 Saved" : "\u2606 Save";
    if (currentTab() === "saved") renderSaved();
  });
  const sh = $("#share-opp");
  if (sh) sh.addEventListener("click", async () => {
    const link = `${location.origin}${location.pathname}#c=${r[F.ID]}`;
    try { await navigator.clipboard.writeText(link); sh.textContent = "\u2713 Copied"; }
    catch { sh.textContent = link.slice(0, 40); }
    setTimeout(() => { sh.textContent = "Copy link"; }, 1800);
  });
  location.hash = "c=" + r[F.ID];
}

// ---- business plan ----
let planDone = false;
async function initPlan() {
  if (planDone) return;
  planDone = true;
  const open = ROWS.filter((r) => r[F.DUE] >= META.today && r[F.US]);
  const withEmail = open.filter((r) => r[F.EMAIL]).length;
  let companies = new Set();
  for (const k in VENDORS) for (const c of VENDORS[k]) companies.add(c[V.NAME]);
  if (!RENEWALS.length) { try { RENEWALS = await (await fetch("./renewals.json")).json(); } catch {} }
  const cutoff = new Date(Date.now() + 365 * 86400e3).toISOString().slice(0, 10);
  const exp = RENEWALS.filter((r) => r[R.END] <= cutoff);
  const expValue = exp.reduce((a, r) => a + r[R.AMT], 0);

  $("#plan-tiles").innerHTML = [
    ["Contracts we can send", open.length.toLocaleString(), "open right now, refreshed daily"],
    ["Companies we can reach", companies.size.toLocaleString(), `across ${Object.keys(VENDORS).length} industry codes`],
    ["Expiring within a year", usd(expValue), `${exp.length.toLocaleString()} contracts someone else holds`],
    ["Buyers we can name", withEmail.toLocaleString(), "contracts with the officer's email"],
  ].map(([l, v, sub]) => `<div class="card tile"><div class="label">${l}</div><div class="value" style="font-size:${String(v).length > 8 ? 30 : 44}px">${v}</div><div class="sub">${sub}</div></div>`).join("");

  const sent = 1000;
  const rows = [
    ["Emails sent in a month", "", sent],
    ["Opened", "30%", Math.round(sent * 0.30)],
    ["Replied", "6%", Math.round(sent * 0.06)],
    ["Subscribed at $99", "25% of repliers", Math.round(sent * 0.06 * 0.25)],
  ];
  const subs = rows[3][2];
  $("#funnel").innerHTML = rows.map(([a, b, c]) => `<tr><td>${a}</td><td class="muted">${b}</td><td><strong>${c.toLocaleString()}</strong></td></tr>`).join("")
    + `<tr><td><strong>Monthly recurring revenue added</strong></td><td class="muted">${subs} × $99</td><td><strong>$${(subs * 99).toLocaleString()}</strong></td></tr>`
    + `<tr><td>After twelve months at that rate</td><td class="muted">before churn</td><td><strong>$${(subs * 12 * 99).toLocaleString()}</strong>/mo</td></tr>`;
}

// ---- renewal calendar ----
// Contract descriptions arrive in block capitals and run long. Sentence-case them and
// cut to a readable length.
const niceDesc = (v) => {
  let t = String(v || "").trim();
  if (!t) return "";
  if (t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
  if (t.length > 110) t = t.slice(0, 108).replace(/[\s,;]+\S*$/, "") + "\u2026";
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const R = { TRADE: 0, END: 1, AMT: 2, WHO: 3, AGENCY: 4, STATE: 5, NAICS: 6, DESC: 7, ID: 8 };
let RENEWALS = [], rPage = 1, rHits = [];

async function initRenewals() {
  if (!RENEWALS.length) {
    try { RENEWALS = await (await fetch("./renewals.json")).json(); }
    catch { $("#r-list").innerHTML = '<div class="empty">Renewal data unavailable.</div>'; return; }
    const trades = [...new Set(RENEWALS.map((r) => r[R.TRADE]))].sort();
    for (const t of trades) { const o = document.createElement("option"); o.value = t; o.textContent = t; $("#r-trade").appendChild(o); }
    const states = [...new Set(RENEWALS.map((r) => r[R.STATE]).filter((v) => v && STATE_NAME[v]))].sort((a, b) => stateName(a).localeCompare(stateName(b)));
    for (const t of states) { const o = document.createElement("option"); o.value = t; o.textContent = stateName(t); $("#r-state").appendChild(o); }
    ["#r-trade", "#r-state", "#r-window", "#r-sort"].forEach((x) => $(x).onchange = () => renderRenewals(1));
    $("#r-more").onclick = () => renderRenewals(rPage + 1);
  }
  renderRenewals(1);
}

function renderRenewals(p = 1) {
  if (p === 1) {
    const months = Number($("#r-window").value);
    const cutoff = months ? new Date(Date.now() + months * 30.44 * 86400e3).toISOString().slice(0, 10) : "9999";
    const trade = $("#r-trade").value, state = $("#r-state").value;
    rHits = RENEWALS.filter((r) => r[R.END] <= cutoff && (!trade || r[R.TRADE] === trade) && (!state || r[R.STATE] === state));
    rHits.sort($("#r-sort").value === "amount" ? (a, b) => b[R.AMT] - a[R.AMT] : (a, b) => a[R.END].localeCompare(b[R.END]));

    const total = rHits.reduce((a, r) => a + r[R.AMT], 0);
    const soon = rHits.filter((r) => daysLeft(r[R.END]) <= 180).length;
    const byTrade = {};
    for (const r of rHits) byTrade[r[R.TRADE]] = (byTrade[r[R.TRADE]] || 0) + 1;
    const topTrade = Object.entries(byTrade).sort((a, b) => b[1] - a[1])[0];
    $("#r-tiles").innerHTML = [
      ["Contracts expiring", rHits.length.toLocaleString(), "currently held by someone else"],
      ["Combined value", usd(total), "up for grabs in this window"],
      ["Within six months", soon.toLocaleString(), "start preparing now"],
      ["Biggest trade", topTrade ? topTrade[0] : "\u2014", topTrade ? `${topTrade[1]} contracts` : ""],
    ].map(([l, v, sub]) => `<div class="card tile"><div class="label">${l}</div><div class="value" style="font-size:${String(v).length > 12 ? 19 : 30}px">${v}</div><div class="sub">${sub}</div></div>`).join("");

    const byMonth = new Map();
    for (const r of rHits) { const k = r[R.END].slice(0, 7); byMonth.set(k, (byMonth.get(k) || 0) + 1); }
    const series = [...byMonth].sort().slice(0, 26).map(([label, value]) => ({ label, value, short: label.slice(5) + "/" + label.slice(2, 4), full: label }));
    if (series.length > 1) vbar($("#r-chart"), series, { valueLabel: "contracts expiring" });
    else $("#r-chart").innerHTML = '<div class="empty small">Not enough range to chart.</div>';
    $("#r-list").innerHTML = "";
  }
  rPage = p;
  if (!rHits.length) { $("#r-list").innerHTML = '<div class="empty">Nothing expiring in that window. Widen the filters.</div>'; $("#r-count").textContent = ""; $("#r-more").hidden = true; return; }
  $("#r-count").textContent = `${rHits.length.toLocaleString()} contracts \u2014 showing ${Math.min(p * 25, rHits.length).toLocaleString()}`;
  $("#r-list").insertAdjacentHTML("beforeend", rHits.slice((p - 1) * 25, p * 25).map((r) => {
    const d = daysLeft(r[R.END]);
    const cls = d <= 90 ? "soon" : d <= 270 ? "warn" : "";
    const when = d <= 0 ? "today" : d === 1 ? "1 day" : d < 30 ? `${d} days`
      : d < 60 ? "1 month" : d < 365 ? `${Math.round(d / 30)} months`
      : d < 730 ? "about a year" : `${(d / 365).toFixed(1)} years`;
    return `<article class="opp" style="padding-right:16px">
      <h3>${esc(niceDesc(r[R.DESC]) || r[R.TRADE])}</h3>
      <div class="meta">
        <span class="due ${cls}">expires in ${when}</span> <span class="sep">\u00b7</span>
        <span>${esc(r[R.END])}</span> <span class="sep">\u00b7</span>
        <span class="tag">${esc(r[R.TRADE])}</span>
        ${r[R.STATE] ? `<span class="tag">${esc(r[R.STATE])}</span>` : ""}
        <span class="tag">${money(r[R.AMT])}</span>
      </div>
      <div class="small muted" style="margin-top:6px">Held today by <strong>${esc(r[R.WHO] || "unknown")}</strong> \u00b7 ${esc(r[R.AGENCY])}</div>
      ${VENDORS[r[R.NAICS]] ? `<button class="btn find-rival" data-naics="${esc(r[R.NAICS])}" data-who="${esc(r[R.WHO] || "")}" style="margin-top:10px;padding:6px 11px;font-size:12.5px">Who else could do this</button>` : ""}
    </article>`;
  }).join(""));
  $("#r-list").querySelectorAll(".find-rival").forEach((b) => b.onclick = () => openRivals(b.dataset.naics, b.dataset.who));
  $("#r-more").hidden = p * 25 >= rHits.length;
}

// Companies who could take a contract off whoever holds it now.
function openRivals(naics, incumbent) {
  const list = (VENDORS[naics] || []).filter((v) =>
    !incumbent || v[V.NAME].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) !== incumbent.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20));
  $("#dlg-title").textContent = "Who else could do this work";
  $("#dlg-meta").innerHTML = `<span class="tag">NAICS ${esc(naics)}</span> ${incumbent ? `<span class="tag">held today by ${esc(incumbent.slice(0, 40))}</span>` : ""}`;
  $("#dlg-body").innerHTML = list.length
    ? `<p class="small muted" style="margin:0 0 14px">Companies with a federal track record in this industry code, excluding the incumbent. When the contract comes up for renewal, these are the firms who could credibly bid for it.</p>
       ${list.slice(0, 15).map((v) => `<div class="vendor">
         <div class="rel"><b>${v[V.REL]}</b><span>fit</span></div>
         <div class="who"><strong>${esc(v[V.NAME])}</strong>
           <div class="small muted">${esc([v[V.CITY], v[V.STATE]].filter(Boolean).join(", ") || "location not listed")} \u00b7 ${v[V.AWARDS]} award${v[V.AWARDS] > 1 ? "s" : ""}, averaging ${money(v[V.AVG])} \u00b7 last ${esc(v[V.LAST] || "unknown")}</div></div>
       </div>`).join("")}`
    : '<div class="callout">No other companies on record for this industry code.</div>';
  $("#dlg").showModal();
}

// keyboard: / focuses search, Esc closes the dialog
addEventListener("keydown", (e) => {
  if (e.key === "/" && !/input|textarea/i.test(e.target.tagName)) {
    e.preventDefault();
    document.querySelector("[data-tab=search]").click();
    $("#s-q").focus();
  }
});

renderDashboard();

updateSavedCount();
// A link of the form #c=<notice id> opens that contract straight away.
{
  const m = location.hash.match(/^#c=(.+)$/);
  if (m && ROWS.some((r) => r[F.ID] === decodeURIComponent(m[1]))) openDetail(decodeURIComponent(m[1]));
}

$("#about-built").textContent = `Snapshot of ${META.total.toLocaleString()} open notices, built ${new Date(META.built_at).toLocaleString()}.`;
