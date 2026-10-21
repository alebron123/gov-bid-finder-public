// Pure pieces of the data rebuild: row encoding, CSV parsing, text cleanup and
// scoring. Kept free of file and network access so the tests can drive them directly.

// Row layout shared with app.js (F there).
export const F = { ID: 0, TITLE: 1, DEPT: 2, TYPE: 3, SA: 4, DUE: 5, NAICS: 6, STATE: 7, CITY: 8, LINK: 9, SRC: 10, SNIP: 11, POSTED: 12, SUBTIER: 13, CONTACT: 14, EMAIL: 15, CNAME: 16, SCORE: 17, SIMP: 18, VALUE: 19, BENCH: 20, US: 21 };
const DICT_OF = { DEPT: "depts", TYPE: "types", SA: "setasides", SRC: "sources" };
const FIELDS = Object.entries(F).sort((a, b) => a[1] - b[1]).map(([k]) => k);

// data.json stores agency, type, set-aside and source as indexes into meta.dicts.
export const decodeRow = (r, dicts) => Object.fromEntries(FIELDS.map((k, i) => [k, DICT_OF[k] ? (dicts[DICT_OF[k]][r[i]] ?? "") : r[i]]));
export function encodeRows(objs) {
  const dicts = {}, index = {};
  for (const [k, name] of Object.entries(DICT_OF)) {
    dicts[name] = [...new Set(objs.map((o) => o[k] ?? ""))];
    index[k] = new Map(dicts[name].map((v, i) => [v, i]));
  }
  const rows = objs.map((o) => FIELDS.map((k) => DICT_OF[k] ? index[k].get(o[k] ?? "") : o[k]));
  return { rows, dicts };
}
export const tallyBySource = (objs) => [...objs.reduce((m, o) => m.set(o.SRC, (m.get(o.SRC) || 0) + 1), new Map())].map(([label, value]) => ({ label, value }));

// Streaming RFC 4180 CSV parser: feed decoded text in chunks, get whole records
// back. Quoted fields may span chunks and contain commas, quotes and newlines
// (SAM.gov descriptions do all three).
export class CsvParser {
  constructor() { this.field = ""; this.record = []; this.inQuotes = false; this.quotePending = false; }
  push(text) {
    const out = [];
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (this.quotePending) {
        this.quotePending = false;
        if (c === '"') { this.field += '"'; continue; }
        this.inQuotes = false;
      }
      if (this.inQuotes) {
        if (c === '"') this.quotePending = true;
        else this.field += c;
      } else if (c === '"') this.inQuotes = true;
      else if (c === ",") { this.record.push(this.field); this.field = ""; }
      else if (c === "\n") { this.record.push(this.field); out.push(this.record); this.field = ""; this.record = []; }
      else if (c !== "\r") this.field += c;
    }
    return out;
  }
  end() {
    if (this.quotePending) { this.quotePending = false; this.inQuotes = false; }
    if (this.field === "" && !this.record.length) return [];
    this.record.push(this.field);
    const last = this.record;
    this.field = ""; this.record = [];
    return [last];
  }
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—" };
// Descriptions arrive as HTML fragments. Reduce to one line of plain text.
export function cleanText(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return Number.isFinite(n) ? String.fromCodePoint(n) : " "; }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

// "2026-10-28T08:00:00-05:00" -> "2026-10-28". The date is the deadline's own
// local day, which is what a bidder reads on the notice.
export const deadlineDate = (s) => (/^(\d{4}-\d{2}-\d{2})/.exec(String(s || "")) || [])[1] || "";

// Place of performance first; fall back to the contracting office's country.
// An empty country on both counts as US: most domestic notices leave it blank.
export const isUS = (popCountry, officeCountry) => {
  const c = (popCountry || officeCountry || "USA").toUpperCase();
  return c === "USA" || c === "US";
};

// How easy a notice is for a small firm to act on, 0-100 in steps of 5.
// WHY these bases: calibrated against the original snapshot's scores, where
// combined synopsis/solicitations averaged 79, solicitations and presolicitations
// ~63, special notices 28 and sources-sought 19. A notice you can quote on today
// is simpler than one that only asks who is out there.
const TYPE_BASE = {
  "Combined Synopsis/Solicitation": 75, "Solicitation": 65, "Presolicitation": 65,
  "Special Notice": 30, "Sources Sought": 20, "Sale of Surplus Property": 55,
};
// Signals in the title or description. Negative: work a newcomer cannot win
// (sole source, brand-name only) or that needs a proposal team (IDIQ, design-build).
// Positive: plain supply buys with a part number or delivery terms.
const SIGNALS = [
  [/\bsole[\s-]source\b|\bonly one responsible source\b|\bintent to award\b/, -30],
  [/\bbrand[\s-]name\b/, -20],
  [/\bsoftware\b|\blicen[cs]e/, -15],
  [/\bidiq\b|\bmultiple[\s-]award\b|\bmatoc\b|\bsatoc\b/, -15],
  [/\bdesign[\s-]build\b/, -10],
  [/\bnsn\b|\bnational stock number\b/, 5],
  [/\bdelivery\b/, 5],
];
export function simplicity({ type, title, desc }) {
  let s = TYPE_BASE[type] ?? 50;
  const hay = `${title} ${desc}`.toLowerCase();
  for (const [re, d] of SIGNALS) if (re.test(hay)) s += d;
  return Math.max(0, Math.min(100, Math.round(s / 5) * 5));
}

// Typical award size on a log scale: $20k scores 0, $5M scores 100.
// WHY log: award sizes span three orders of magnitude, and the step from $50k to
// $500k matters to a small firm as much as $500k to $5M.
const V_LO = Math.log(20e3), V_HI = Math.log(5e6);
export const valueScore = (v) => v ? Math.max(0, Math.min(100, Math.round(100 * (Math.log(v) - V_LO) / (V_HI - V_LO)))) : 10;

// "Best value, simplest first": slightly more weight on money than ease.
// WHY 0.55/0.45: the original snapshot's scores fit 0.45 x simplicity exactly.
export const score = (value, simp) => Math.round(0.55 * valueScore(value) + 0.45 * simp);
