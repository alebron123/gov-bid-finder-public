import { hbar, vbar, line, card, fmt, usd } from "./charts.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SOURCE_LABEL = { "sam.gov": "Federal (SAM.gov)", myfloridamarketplace: "Florida state (MFMP)", "miami-dade": "Miami-Dade County" };
const sourceLabel = (v) => SOURCE_LABEL[v] || v;
const NAICS_SECTOR = { 11: "Agriculture", 21: "Mining & extraction", 22: "Utilities", 23: "Construction", 31: "Manufacturing", 32: "Manufacturing", 33: "Manufacturing", 42: "Wholesale", 44: "Retail", 45: "Retail", 48: "Transportation", 49: "Warehousing", 51: "Information", 52: "Finance", 53: "Real estate & leasing", 54: "Professional & technical", 55: "Management", 56: "Admin, support & waste", 61: "Education", 62: "Health care", 71: "Arts & recreation", 72: "Food & lodging", 81: "Repair & other services", 92: "Public administration" };
const naicsLabel = (c) => `${c} · ${NAICS_SECTOR[String(c).slice(0, 2)] || "Other"}`;
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
document.querySelectorAll("[role=tab]").forEach((b) => b.onclick = () => {
  document.querySelectorAll("[role=tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + b.dataset.tab));
  if (b.dataset.tab === "dashboard") renderDashboard();
  if (b.dataset.tab === "search") runSearch(1);
  if (b.dataset.tab === "start") initStart();
  if (b.dataset.tab === "renewals") initRenewals();
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
    return scored.concat(unscored);
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
    ${hasVendors ? `<button class="btn find-co" data-id="${r[F.ID]}" title="Companies that already win this kind of work">Find companies<span class="pro-dot">PRO</span></button>` : ""}
    <h3>${esc(r[F.TITLE])}</h3>
    <div class="meta">${dueHtml(r[F.DUE])} <span class="sep">·</span> <span>${esc(agencyName(dept(r)))}</span>
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

// ---- Pro tier gate ----
// Demo-grade only: this is a static site, so the check runs in the browser and the
// code is readable in the source. It shows the tier split; it is not security.
const PRO_CODE = "bidfinder";
const isPro = () => localStorage.getItem("pro") === "1";

function askForPro(then) {
  $("#dlg-title").textContent = "Pro feature";
  $("#dlg-meta").innerHTML = '<span class="tag" style="color:var(--series-2);border-color:color-mix(in srgb,var(--series-2) 45%,transparent)">Pro</span>';
  $("#dlg-body").innerHTML = `
    <p style="margin:0 0 6px"><strong>Find the companies who already win this work.</strong></p>
    <p class="small muted" style="margin:0 0 16px">Every contract gets a ranked list of firms that have actually won that kind of work, built from public federal award records, with a drafted outreach email for each one. Searching contracts stays free forever. This part is the paid tier.</p>
    <div class="mail-box">
      <label>Access code</label>
      <input class="pro-code" type="password" placeholder="enter your code" autocomplete="off">
      <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
        <button class="btn pro-go">Unlock</button>
        <span class="small muted pro-msg"></span>
      </div>
    </div>`;
  $("#dlg").showModal();
  const input = $("#dlg-body").querySelector(".pro-code");
  const submit = () => {
    if (input.value.trim().toLowerCase() === PRO_CODE) {
      localStorage.setItem("pro", "1");
      document.body.dataset.pro = "1";
      $("#dlg").close();
      then();
    } else {
      $("#dlg-body").querySelector(".pro-msg").textContent = "That code is not right.";
    }
  };
  $("#dlg-body").querySelector(".pro-go").onclick = submit;
  input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
  input.focus();
}

// ---- companies that already win this kind of work ----
function openVendors(id) {
  if (!isPro()) return askForPro(() => openVendors(id));
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
    openComposer(r, v, deadline);
  });
  $("#dlg").showModal();
}

// Compose panel: writes the email, then hands it to Gmail, Outlook, or the desktop
// mail client. A static page cannot send mail itself, so it hands off to one that can.
function openComposer(r, v, deadline) {
  const who = [v[V.CITY], v[V.STATE]].filter(Boolean).join(", ");
  const subject = `${r[F.TITLE].slice(0, 70)} \u2014 bids due ${r[F.DUE]}`;
  const body = [
    `Hello,`,
    ``,
    `I am writing about an open contract with the ${agencyName(dept(r))}: "${r[F.TITLE]}". Responses are due ${deadline}.`,
    r[F.LINK] ? `The official notice is here: ${r[F.LINK]}` : null,
    ``,
    `I found ${v[V.NAME]} through public federal award records, which show ${v[V.AWARDS]} contract${v[V.AWARDS] > 1 ? "s" : ""} won in this same industry code${who ? `, out of ${who}` : ""}.`,
    ``,
    `Two questions:`,
    `1. Are you already planning to bid on this one?`,
    `2. If not, would you consider teaming up on it?`,
    ``,
    `A one-line reply either way is plenty. If you would rather not hear from us again, just reply "no thanks".`,
    ``,
    `[Your name]`,
    `[Your company]`,
    `[Your phone]`,
  ].filter((l) => l !== null).join("\n");

  $("#dlg-title").textContent = `Email ${v[V.NAME]}`;
  $("#dlg-meta").innerHTML = `<span class="tag">${esc(who || "location unknown")}</span><span class="tag">${v[V.AWARDS]} awards</span><span class="tag">avg ${money(v[V.AVG])}</span>`;
  $("#dlg-body").innerHTML = `
    <div class="mail-box">
      <label>To</label>
      <input class="m-to" type="email" placeholder="their email address">
      <div class="small muted" style="margin-top:5px">Award records do not include vendor emails.
        <a href="https://www.google.com/search?q=${encodeURIComponent('"' + v[V.NAME] + '" ' + who + " email contact")}" target="_blank" rel="noopener">Look up ${esc(v[V.NAME])}</a>, then paste it here.</div>
      <label style="display:block;margin-top:10px">Subject</label><input class="m-sub" value="${esc(subject)}">
      <label style="display:block;margin-top:10px">Message</label><textarea class="m-body">${esc(body)}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn m-gmail">Open in Gmail</button>
        <button class="btn ghost m-outlook">Outlook</button>
        <button class="btn ghost m-mail">Mail app</button>
        <button class="btn ghost m-copy">Copy</button>
      </div>
      <div class="small muted" style="margin-top:8px">Opens your mail with everything filled in. Read it, add your name, then send. Nothing is sent from this page.</div>
    </div>
    <p class="small muted" style="margin-top:14px"><button class="btn ghost m-back">Back to the list</button></p>`;

  const get = () => ({
    to: $("#dlg-body").querySelector(".m-to").value.trim(),
    su: $("#dlg-body").querySelector(".m-sub").value,
    bo: $("#dlg-body").querySelector(".m-body").value,
  });
  const open = (url) => window.open(url, "_blank", "noopener");
  $("#dlg-body").querySelector(".m-gmail").onclick = () => { const { to, su, bo } = get();
    open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(bo)}`); };
  $("#dlg-body").querySelector(".m-outlook").onclick = () => { const { to, su, bo } = get();
    open(`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(su)}&body=${encodeURIComponent(bo)}`); };
  $("#dlg-body").querySelector(".m-mail").onclick = () => { const { to, su, bo } = get();
    location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(su)}&body=${encodeURIComponent(bo)}`; };
  $("#dlg-body").querySelector(".m-copy").onclick = async (e) => { const { to, su, bo } = get();
    await navigator.clipboard.writeText(`To: ${to}\nSubject: ${su}\n\n${bo}`);
    e.target.textContent = "Copied"; setTimeout(() => e.target.textContent = "Copy", 1600); };
  $("#dlg-body").querySelector(".m-back").onclick = () => openVendors(r[F.ID]);
  $("#dlg-body").querySelector(".m-to").focus();
}

// ---- detail ----
function openDetail(id) {
  const r = ROWS.find((x) => x[F.ID] === id);
  if (!r) return;
  $("#dlg-title").textContent = r[F.TITLE];
  $("#dlg-meta").innerHTML = `${dueHtml(r[F.DUE])} <span class="sep">·</span> <span>${esc(agencyName(dept(r)))}</span>
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
    const states = [...new Set(RENEWALS.map((r) => r[R.STATE]).filter(Boolean))].sort();
    for (const t of states) { const o = document.createElement("option"); o.value = t; o.textContent = t; $("#r-state").appendChild(o); }
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
      ${VENDORS[r[R.NAICS]] ? `<button class="btn find-rival" data-naics="${esc(r[R.NAICS])}" data-who="${esc(r[R.WHO] || "")}" style="margin-top:10px;padding:6px 11px;font-size:12.5px">Who else could do this<span class="pro-dot">PRO</span></button>` : ""}
    </article>`;
  }).join(""));
  $("#r-list").querySelectorAll(".find-rival").forEach((b) => b.onclick = () => openRivals(b.dataset.naics, b.dataset.who));
  $("#r-more").hidden = p * 25 >= rHits.length;
}

// Companies who could take a contract off whoever holds it now.
function openRivals(naics, incumbent) {
  if (!isPro()) return askForPro(() => openRivals(naics, incumbent));
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
         <div class="acts"><a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent('"' + v[V.NAME] + '" ' + [v[V.CITY], v[V.STATE]].filter(Boolean).join(" ") + " contact")}">Find contact</a></div>
       </div>`).join("")}`
    : '<div class="callout">No other companies on record for this industry code.</div>';
  $("#dlg").showModal();
}

// ---- presentation mode ----
const TRADES = [
  { label: "Painting", kw: ["paint", "painting", "coating", "repaint"] },
  { label: "Landscaping", kw: ["landscap", "mowing", "grounds maintenance", "tree removal", "lawn"] },
  { label: "Janitorial", kw: ["janitorial", "custodial", "cleaning service"] },
  { label: "HVAC & plumbing", kw: ["hvac", "air conditioning", "plumbing", "boiler", "chiller"] },
  { label: "Electrical", kw: ["electrical", "wiring", "generator"] },
  { label: "IT & software", kw: ["software", "information technology", "help desk", "cyber"] },
  { label: "Construction", kw: ["construction", "renovation", "roof", "carpentry"] },
  { label: "Trucking", kw: ["trucking", "freight", "hauling", "moving service"] },
  { label: "Catering", kw: ["catering", "food service", "dining"] },
  { label: "Medical supplies", kw: ["medical suppl", "surgical", "pharmaceutical"] },
  { label: "Security guards", kw: ["security guard", "guard service"] },
  { label: "Translation", kw: ["translation", "interpreter", "linguist"] },
];
const tradeRows = (t) => {
  const out = [];
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i];
    if (r[F.DUE] < META.today || !r[F.US]) continue;
    const h = HAY[i];
    if (t.kw.some((k) => h.includes(k))) out.push(r);
  }
  return out;
};

function animateTo(el, target, fmtFn = (n) => Math.round(n).toLocaleString()) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = fmtFn(target); return; }
  const t0 = performance.now(), dur = 900;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = fmtFn(target * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function initStart() {
  const open = ROWS.filter((r) => r[F.DUE] >= META.today && r[F.US]);
  const week = open.filter((r) => daysLeft(r[F.DUE]) <= 7).length;
  const small = open.filter((r) => setaside(r)).length;
  const awards12 = META.awards_by_month.reduce((a, b) => a + (b.dollars || 0), 0);
  animateTo($("#h-open"), open.length);
  animateTo($("#h-week"), week);
  animateTo($("#h-small"), small);
  animateTo($("#h-money"), awards12, (n) => usd(n));

  const host = $("#trades");
  host.innerHTML = TRADES.map((t, i) => {
    const n = tradeRows(t).length;
    return n < 5 ? "" : `<button class="trade" data-i="${i}" aria-pressed="false">${t.label}<span class="n">${n}</span></button>`;
  }).join("");
  host.querySelectorAll(".trade").forEach((b) => b.onclick = () => {
    host.querySelectorAll(".trade").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    showTrade(TRADES[Number(b.dataset.i)]);
  });
}

function showTrade(t) {
  const rows = tradeRows(t).filter((r) => r[F.VALUE] != null);
  const seen = new Set(), uniq = [];
  for (const r of rows.sort((a, b) => (b[F.SCORE] || 0) - (a[F.SCORE] || 0))) {
    if (seen.has(r[F.TITLE])) continue; seen.add(r[F.TITLE]); uniq.push(r);
  }
  const total = uniq.reduce((a, r) => a + (r[F.VALUE] || 0), 0);
  const soon = uniq.filter((r) => daysLeft(r[F.DUE]) <= 14).length;
  const simple = uniq.filter((r) => r[F.SIMP] >= 80).length;

  $("#s2-title").textContent = `What the government is buying: ${t.label.toLowerCase()}`;
  $("#s2-tiles").innerHTML = [
    ["Open contracts for you", uniq.length.toLocaleString(), "matching this trade, right now"],
    ["Typical value, combined", usd(total), "sum of median award size"],
    ["Closing in two weeks", soon.toLocaleString(), "act on these first"],
    ["Simple to bid", simple.toLocaleString(), "a quote, not a written proposal"],
  ].map(([l, v, sub]) => `<div class="card tile"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${sub}</div></div>`).join("");

  $("#s2-list").innerHTML = uniq.slice(0, 6).map(oppCard).join("");
  $("#s2-list").querySelectorAll(".opp").forEach((c) => c.onclick = () => openDetail(c.dataset.id));
  $("#s2-list").querySelectorAll(".find-co").forEach((b) => b.onclick = (e) => { e.stopPropagation(); openVendors(b.dataset.id); });

  // Contracts in this trade that expire soon: the pipeline behind the open bids.
  renderTradeRenewals(t);

  const first = uniq[0];
  const vlist = first && VENDORS[first[F.NAICS]];
  $("#s3-card").innerHTML = vlist
    ? `<p class="small muted" style="margin:0 0 10px">For example, <strong>${esc(first[F.TITLE].slice(0, 70))}</strong> — ${vlist.length} companies have won contracts under this industry code:</p>
       ${vlist.slice(0, 4).map((v) => `<div class="vendor"><div class="rel"><b>${v[V.REL]}</b><span>fit</span></div>
         <div class="who"><strong>${esc(v[V.NAME])}</strong><div class="small muted">${esc([v[V.CITY], v[V.STATE]].filter(Boolean).join(", "))} · ${v[V.AWARDS]} award${v[V.AWARDS] > 1 ? "s" : ""}, averaging ${money(v[V.AVG])}</div></div></div>`).join("")}
       <button class="btn" style="margin-top:12px" onclick="document.querySelector('#s2-list .find-co')?.click()">Show the full list and draft an email</button>`
    : `<p class="small muted" style="margin:0">Pick a contract above and press Find companies.</p>`;

  for (const id of ["#step2", "#step3"]) {
    const el = $(id);
    el.hidden = false;
    el.classList.remove("reveal");
    void el.offsetWidth;
    el.classList.add("reveal");
  }
  $("#step2").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

// Map a demo trade to the renewal-calendar trade names.
const TRADE_TO_RENEWAL = {
  "Painting": ["Painting"],
  "Landscaping": ["Landscaping & grounds"],
  "Janitorial": ["Janitorial", "Other building services"],
  "HVAC & plumbing": ["HVAC & plumbing"],
  "Electrical": ["Electrical", "Security & alarm systems"],
  "Construction": ["Commercial construction", "Roofing", "Site work & demolition"],
  "Trucking": [],
  "Catering": [],
  "IT & software": [],
  "Medical supplies": [],
  "Security guards": ["Security & alarm systems"],
  "Translation": [],
};

async function renderTradeRenewals(t) {
  const host = $("#s2-renewals");
  if (!host) return;
  const names = TRADE_TO_RENEWAL[t.label] || [];
  if (!names.length) { host.innerHTML = ""; return; }
  if (!RENEWALS.length) { try { RENEWALS = await (await fetch("./renewals.json")).json(); } catch { return; } }
  const soon = RENEWALS.filter((r) => names.includes(r[R.TRADE])).sort((a, b) => a[R.END].localeCompare(b[R.END]));
  if (!soon.length) { host.innerHTML = ""; return; }
  const within12 = soon.filter((r) => daysLeft(r[R.END]) <= 365);
  const value = within12.reduce((a, r) => a + r[R.AMT], 0);
  host.innerHTML = `
    <div class="card" style="margin-top:12px">
      <p class="chart-title">And here is what is coming</p>
      <p class="chart-sub">${within12.length.toLocaleString()} ${t.label.toLowerCase()} contracts worth ${usd(value)} expire within a year. Someone else holds every one of them today. This is where you actually have time to win.</p>
      ${soon.slice(0, 4).map((r) => {
        const d = daysLeft(r[R.END]);
        const when = d <= 0 ? "today" : d === 1 ? "1 day" : d < 60 ? `${d} days` : `${Math.round(d / 30)} months`;
        return `<div class="vendor">
          <div class="rel" style="flex-basis:76px"><b style="font-size:13px">${when}</b><span>left</span></div>
          <div class="who"><strong>${esc(niceDesc(r[R.DESC]) || r[R.TRADE])}</strong>
            <div class="small muted">${money(r[R.AMT])} · held by ${esc(r[R.WHO] || "unknown")} · ${esc(r[R.AGENCY])}${r[R.STATE] ? " · " + esc(r[R.STATE]) : ""}</div></div>
        </div>`;
      }).join("")}
      <button class="btn ghost" style="margin-top:12px" onclick="document.querySelector('[data-tab=renewals]').click()">See the full renewal calendar</button>
    </div>`;
}

// keyboard: / focuses search, Esc closes the dialog
addEventListener("keydown", (e) => {
  if (e.key === "/" && !/input|textarea/i.test(e.target.tagName)) {
    e.preventDefault();
    document.querySelector("[data-tab=search]").click();
    $("#s-q").focus();
  }
});

if (isPro()) document.body.dataset.pro = "1";
initStart();

$("#about-built").textContent = `Snapshot of ${META.total.toLocaleString()} open notices, built ${new Date(META.built_at).toLocaleString()}.`;
