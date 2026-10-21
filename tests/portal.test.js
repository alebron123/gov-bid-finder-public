import { test } from "node:test";
import assert from "node:assert/strict";
import { profileStems, setAsideAllowed, profileToText, isResearchGrant, filterGrants, TRADES } from "../lib.js";
import { usDate, currentToRow, futureToRow } from "../scripts/county-lib.js";
import { mdy, toGrant, stillOpen } from "../scripts/grants-lib.js";

test("profileStems turns quiz trades and free text into search stems", () => {
  assert.deepEqual(profileStems({ trades: ["painting", "roofing"] }), ["paint", "roof"]);
  assert.deepEqual(profileStems({ trades: [], other: "Pressure washing, signage" }), ["pressure washing", "signage"]);
  assert.deepEqual(profileStems(null), []);
  assert.ok(TRADES.every((t) => t.stems.length && t.stems.every((s) => s === s.toLowerCase())));
});

test("setAsideAllowed follows the profile's certifications", () => {
  const plain = { kind: "business", certs: [] };
  assert.equal(setAsideAllowed("", plain), true);
  assert.equal(setAsideAllowed("Small Business Set Aside - Total", plain), true);
  assert.equal(setAsideAllowed("8(a) Set-Aside (FAR 19.8)", plain), false);
  assert.equal(setAsideAllowed("8(a) Set-Aside (FAR 19.8)", { certs: ["8a"] }), true);
  assert.equal(setAsideAllowed("Service-Disabled Veteran-Owned Small Business (SDVOSB) Set-Aside (FAR 19.14)", { certs: ["sdvosb"] }), true);
  assert.equal(setAsideAllowed("SBA Certified Women-Owned Small Business (WOSB) Program Set-Aside (FAR 19.15)", plain), false);
  assert.equal(setAsideAllowed("Small Business Set Aside - Total", { kind: "nonprofit" }), false);
});

test("profileToText describes the business for the agent", () => {
  const t = profileToText({ kind: "business", trades: ["painting"], county: "Miami-Dade", size: "6-20", maxJob: "250000", certs: ["sbe"] });
  assert.match(t, /small business in Miami-Dade County, Florida/);
  assert.match(t, /painting/);
  assert.match(t, /\$250,000/);
  assert.match(t, /Miami-Dade SBE/);
  assert.equal(profileToText(null), "");
});

test("research grants are recognized and hidden by default", () => {
  const nih = { title: "Feasibility Trials (R34 Clinical Trial Required)", agency: "National Institutes of Health", desc: "", categories: ["Health"], eligible: ["small_business"], closes: "2026-12-01" };
  const food = { title: "Community Food Projects", agency: "Department of Agriculture", desc: "local food", categories: ["Food and Nutrition"], eligible: ["nonprofit"], closes: "" };
  assert.equal(isResearchGrant(nih), true);
  assert.equal(isResearchGrant(food), false);
  assert.deepEqual(filterGrants([nih, food]), [food]);
  assert.deepEqual(filterGrants([nih, food], { hideResearch: false }).length, 2);
  assert.deepEqual(filterGrants([nih, food], { who: "small_business", hideResearch: false }), [nih]);
  assert.deepEqual(filterGrants([nih, food], { q: "food" }), [food]);
  assert.deepEqual(filterGrants([{ ...food, closes: "2026-01-01" }], { today: "2026-10-21" }), []);
});

test("Miami-Dade feed records become rows", () => {
  assert.equal(usDate("11/04/2026"), "2026-11-04");
  assert.equal(usDate("10/20/2026 12:00:00 AM"), "2026-10-20");
  assert.equal(usDate(""), "");
  const cur = currentToRow({ solicitationNumber: "RPQ No PDC-W25012", solicitationType: "Bids & Contracts", title: "MDSO HQ Roofing", openingDate: "10/29/2026", postedDate: "09/21/2026" });
  assert.equal(cur.SRC, "miami-dade"); assert.equal(cur.DUE, "2026-10-29"); assert.equal(cur.STATE, "FL");
  assert.match(cur.ID, /^mdc-[0-9a-f]{12}$/);
  assert.equal(currentToRow({ solicitationNumber: "X", title: "a" }).ID, currentToRow({ solicitationNumber: "X", title: "b" }).ID, "id depends on the number only");
  const fut = futureToRow({ webPostingCounter: 8984, documentTitle: "Water Remediation Pool", removalDate: "11/10/2026 12:00:00 AM", releaseDate: "10/20/2026 12:00:00 AM", sendFeedBack: " Julie Whiteside", emailAddress: " julie@miamidade.gov" });
  assert.equal(fut.TYPE, "Future Solicitation"); assert.equal(fut.DUE, "2026-11-10");
  assert.equal(fut.EMAIL, "julie@miamidade.gov"); assert.equal(fut.CNAME, "Julie Whiteside");
});

test("Grants.gov hits become grants", () => {
  assert.equal(mdy("11/17/2026"), "2026-11-17");
  assert.equal(mdy(""), "");
  const g = toGrant({ id: 1, number: "N", title: "<b>Food</b> &amp; farms", agency: "USDA", oppStatus: "forecasted", openDate: "", closeDate: "" },
    ["nonprofit", "nonprofit", "small_business"], { synopsis: { awardCeiling: "$250,000", fundingActivityCategories: [{ description: "Agriculture" }], synopsisDesc: "<p>Grow</p>" } });
  assert.equal(g.title, "Food & farms");
  assert.equal(g.status, "forecast");
  assert.equal(g.ceiling, 250000);
  assert.deepEqual(g.eligible, ["nonprofit", "small_business"]);
  assert.deepEqual(g.categories, ["Agriculture"]);
  assert.equal(g.link, "https://www.grants.gov/search-results-detail/1");
  assert.equal(stillOpen(g, "2026-10-21"), true);
  assert.equal(stillOpen({ closes: "2026-10-20" }, "2026-10-21"), false);
  assert.equal(toGrant({ id: 2, title: "x" }, [], undefined).ceiling, null);
});

test("stemMatcher matches at word starts only", async () => {
  const { stemMatcher } = await import("../lib.js");
  const m = stemMatcher(["construction", "paint"]);
  assert.equal(m("new construction of a hangar"), true);
  assert.equal(m("3d image reconstruction"), false);
  assert.equal(m("interior painting"), true);
  assert.equal(m("(paint) supplies"), true);
  assert.equal(stemMatcher([])("anything"), true);
  assert.equal(stemMatcher(["a.b"])("axb"), false, "regex characters are escaped");
});
