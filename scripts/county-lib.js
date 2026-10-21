// Miami-Dade County's procurement site serves its solicitation tables as JSON.
// These turn those records into the row shape data.json uses (keys of F).
import { createHash } from "node:crypto";
import { simplicity, score } from "./sam-lib.js";

export const MDC_CURRENT_URL = "https://www.miamidade.gov/apps/isd/StratProc/Home/CurrentSolicitationsList";
export const MDC_FUTURE_URL = "https://www.miamidade.gov/apps/isd/StratProc/Home/FutureSolicitationsList";
const CURRENT_PAGE = "https://www.miamidade.gov/apps/isd/StratProc/Home/CurrentSolicitations";
const FUTURE_PAGE = "https://www.miamidade.gov/apps/isd/StratProc/Home/FutureSolicitations";

// "11/04/2026" or "10/20/2026 12:00:00 AM" -> "2026-11-04"
export const usDate = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || "").trim());
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : "";
};
// Stable short id so a shared link to a county bid survives daily rebuilds.
const shortHash = (s) => createHash("sha1").update(String(s)).digest("hex").slice(0, 12);

const base = { DEPT: "Miami-Dade County", SA: "", NAICS: "", STATE: "FL", CITY: "Miami", SRC: "miami-dade", SUBTIER: "Strategic Procurement Department", VALUE: null, BENCH: 0, US: 1 };

export function currentToRow(x) {
  const title = String(x.title || "").trim();
  const num = String(x.solicitationNumber || "").trim();
  const type = String(x.solicitationType || "Bids & Contracts").trim();
  const due = usDate(x.openingDate);
  const simp = simplicity({ type, title, desc: "" });
  return { ...base, ID: `mdc-${shortHash(num || title)}`, TITLE: title, TYPE: type, DUE: due, LINK: CURRENT_PAGE,
    SNIP: `Miami-Dade County solicitation ${num} (${type}). Bids open ${x.openingDate}. Documents, forms and the bid submission are in the county's INFORMS supplier portal.`,
    POSTED: usDate(x.postedDate), CONTACT: "", EMAIL: "", CNAME: "", SIMP: simp, SCORE: score(null, simp) };
}

export function futureToRow(x) {
  const title = String(x.documentTitle || "").trim();
  const name = String(x.sendFeedBack || "").trim(), email = String(x.emailAddress || "").trim();
  // WHY the removal date as the deadline: a future solicitation is a draft the county
  // posts for comment; it comes down on this date, which is when feedback closes.
  const due = usDate(x.removalDate);
  const simp = simplicity({ type: "Future Solicitation", title, desc: "" });
  return { ...base, ID: `mdcf-${shortHash(x.webPostingCounter ?? title)}`, TITLE: title, TYPE: "Future Solicitation", DUE: due, LINK: FUTURE_PAGE,
    SNIP: `Miami-Dade County has signalled it intends to buy this. It is not yet open for bids: the draft is posted for vendor feedback until ${usDate(x.removalDate)}. Talk to the buyer now, before the specification is final.`,
    POSTED: usDate(x.releaseDate), CONTACT: [name, email].filter(Boolean).join(" · "), EMAIL: email, CNAME: name, SIMP: simp, SCORE: score(null, simp) };
}
