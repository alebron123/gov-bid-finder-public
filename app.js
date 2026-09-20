import { hbar, vbar, line, card, fmt, usd } from "./charts.js";

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
  if (b.dataset.tab === "renewals") initRenewals();
  if (b.dataset.tab === "plan") initPlan();
});

// ---- data ----
const F = { ID: 0, TITLE: 1, DEPT: 2, TYPE: 3, SA: 4, DUE: 5, NAICS: 6, STATE: 7, CITY: 8, LINK: 9, SRC: 10, SNIP: 11, POSTED: 12, SUBTIER: 13, CONTACT: 14, EMAIL: 15, CNAME: 16, SCORE: 17, SIMP: 18, VALUE: 19, BENCH: 20, US: 21 };

// Gmail opens in this account, so the message is already coming from the right address.
const SEND_AS = "govbidfind@gmail.com";
const gmailUrl = ({ to, su, bo }) =>
  `https://mail.google.com/mail/?view=cm&fs=1&authuser=${encodeURIComponent(SEND_AS)}`
  + `&to=${encodeURIComponent(to || "")}&su=${encodeURIComponent(su || "")}&body=${encodeURIComponent(bo || "")}`;
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

// Remember who has already been emailed, so you can work down a list without
// losing your place.
const contactedKey = (name) => "c:" + String(name).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 28);
const contacted = new Set(JSON.parse(localStorage.getItem("contacted") || "[]"));
function markContacted(name) {
  contacted.add(contactedKey(name));
  localStorage.setItem("contacted", JSON.stringify([...contacted]));
}
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
        </div>
        <div class="acts">
          <a class="btn ghost" target="_blank" rel="noopener"
             href="https://www.google.com/search?q=${encodeURIComponent('"' + v[V.NAME] + '" ' + [v[V.CITY], v[V.STATE]].filter(Boolean).join(" ") + " contact")}">Find contact</a>
          <button class="btn act-mail" data-i="${i}">${isContacted(v[V.NAME]) ? "Email again" : "Write email"}</button>
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
  const subject = `Government contract you can bid on \u2014 ${r[F.TITLE].slice(0, 60)}`;
  const body = [
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
  ].filter((l) => l !== null).join("\n");

  $("#dlg-title").textContent = `Email ${v[V.NAME]}`;
  $("#dlg-meta").innerHTML = `<span class="tag">${esc(who || "location unknown")}</span><span class="tag">${v[V.AWARDS]} awards</span><span class="tag">avg ${money(v[V.AVG])}</span>`;
  $("#dlg-body").innerHTML = `
    <div class="mail-box">
      <div class="small muted" style="margin-bottom:8px">Most small contractors do not publish an email address, they use a contact form or a phone number. Open their site, grab whatever they list, and paste it below.</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <a class="btn ghost" target="_blank" rel="noopener" href="https://duckduckgo.com/?q=%5C${encodeURIComponent('"' + v[V.NAME] + '" ' + who)}">Their website</a>
        <a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent('"' + v[V.NAME] + '" ' + who + " contact email phone")}">Contact page</a>
        <a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent('"' + v[V.NAME] + '" ' + who + " phone number")}">Phone number</a>
      </div>
      <label>Their email</label>
      <input class="m-to" type="email" placeholder="paste it here">
      <label style="display:block;margin-top:12px">Subject</label><input class="m-sub" value="${esc(subject)}">
      <label style="display:block;margin-top:10px">Message</label><textarea class="m-body" style="min-height:150px">${esc(body)}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn m-gmail">Send in Gmail</button>
        <button class="btn ghost m-mail">Mail app</button>
        <button class="btn ghost m-copy">Copy</button>
      </div>
      <div class="small muted" style="margin-top:8px">Opens Gmail as <strong>${SEND_AS}</strong> with everything filled in. Press send.</div>
    </div>
    <p class="small muted" style="margin-top:14px"><button class="btn ghost m-back">Back to the list</button></p>`;

  const get = () => ({
    to: $("#dlg-body").querySelector(".m-to").value.trim(),
    su: $("#dlg-body").querySelector(".m-sub").value,
    bo: $("#dlg-body").querySelector(".m-body").value,
  });
  $("#dlg-body").querySelector(".m-gmail").onclick = (e) => {
    window.open(gmailUrl(get()), "_blank", "noopener");
    markContacted(v[V.NAME]);
    const btn = e.target;
    btn.textContent = "\u2713 Sent";
    btn.disabled = true;
    btn.style.background = "var(--good)";
    setTimeout(() => { if ($("#dlg").open) openVendors(r[F.ID]); }, 750);
  };
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
    ${r[F.EMAIL] ? `<div style="margin-top:16px;padding:14px;background:var(--page);border:1px solid var(--border);border-radius:8px">
      <button class="btn" id="ask-buyer">Email the buyer</button>
      <div class="small muted" style="margin-top:8px">Goes straight to <strong>${esc(r[F.EMAIL])}</strong>${r[F.CNAME] ? `, ${esc(r[F.CNAME])}` : ""}, the person running this contract. Opens Gmail already addressed and written. Add your name and press send.</div>
    </div>` : ""}
    <div class="callout small">This public page is read-only. The full app adds Claude: a plain-English explanation of this notice, a fit score against your business, and a complete drafted response package.</div>`;
  $("#dlg").showModal();
  const ask = $("#ask-buyer");
  if (ask) ask.onclick = () => askBuyer(r);
}

// Email the contracting officer named on the notice. Their address is published on the
// notice itself, so this is the one message that needs no lookup at all.
function askBuyer(r) {
  const deadline = new Date(r[F.DUE] + "T12:00:00").toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  const first = (r[F.CNAME] || "").split(/[ ,]/).filter(Boolean)[0];
  const su = `Question on ${r[F.TITLE].slice(0, 62)}`;
  const bo = [
    first ? `Dear ${first},` : "Hello,",
    ``,
    `I am writing about "${r[F.TITLE]}", with responses due ${deadline}.`,
    r[F.LINK] ? `Notice: ${r[F.LINK]}` : null,
    ``,
    `My company does this kind of work and we are considering a response. Could you confirm three things:`,
    ``,
    `1. Is the full solicitation package, including attachments and drawings, available to download?`,
    `2. Is a site visit or pre-bid conference planned, and if so, when?`,
    `3. What are the insurance and bonding requirements?`,
    ``,
    `Thank you for your time.`,
    ``,
    `[Your name]`,
    `[Your company]`,
    `[Your phone]`,
  ].filter((l) => l !== null).join("\n");
  window.open(gmailUrl({ to: r[F.EMAIL], su, bo }), "_blank", "noopener");
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
         <div class="acts"><a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent('"' + v[V.NAME] + '" ' + [v[V.CITY], v[V.STATE]].filter(Boolean).join(" ") + " contact")}">Find contact</a></div>
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

$("#about-built").textContent = `Snapshot of ${META.total.toLocaleString()} open notices, built ${new Date(META.built_at).toLocaleString()}.`;
