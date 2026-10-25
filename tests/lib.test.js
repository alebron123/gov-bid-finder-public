import { test } from "node:test";
import assert from "node:assert/strict";
import { localISODate, addDaysISO, daysBetween, isSetAside, countOpen, liveRenewals, recentMonths, coverageSkewed, emailText } from "../lib.js";

test("localISODate uses the local calendar day, not UTC", () => {
  // 11pm local: toISOString() would already read the next day in any US zone.
  const lateEvening = new Date(2026, 9, 21, 23, 30);
  assert.equal(localISODate(lateEvening), "2026-10-21");
  assert.equal(localISODate(new Date(2026, 0, 5, 0, 1)), "2026-01-05");
});

test("addDaysISO crosses month and year boundaries", () => {
  assert.equal(addDaysISO(7, new Date(2026, 9, 28, 12)), "2026-11-04");
  assert.equal(addDaysISO(1, new Date(2026, 11, 31, 12)), "2027-01-01");
  assert.equal(addDaysISO(0, new Date(2026, 9, 21, 23, 59)), "2026-10-21");
});

test("daysBetween counts calendar days, with due-today as 0", () => {
  assert.equal(daysBetween("2026-10-21", "2026-10-21"), 0);
  assert.equal(daysBetween("2026-10-21", "2026-10-22"), 1);
  assert.equal(daysBetween("2026-10-21", "2026-09-26"), -25);
  // Spans the US daylight-saving change on Nov 1 without drifting.
  assert.equal(daysBetween("2026-10-30", "2026-11-03"), 4);
});

test("isSetAside rejects the 'No Set aside used' value", () => {
  assert.equal(isSetAside("No Set aside used"), false);
  assert.equal(isSetAside("No Set-Aside Used"), false);
  assert.equal(isSetAside(""), false);
  assert.equal(isSetAside(null), false);
  assert.equal(isSetAside("Small Business Set Aside - Total"), true);
  assert.equal(isSetAside("8(a) Set-Aside (FAR 19.8)"), true);
  assert.equal(isSetAside("Service-Disabled Veteran-Owned Small Business (SDVOSB) Set-Aside (FAR 19.14)"), true);
});

test("countOpen counts only notices due today or later", () => {
  const rows = [["a", "2026-10-20"], ["b", "2026-10-21"], ["c", "2026-11-01"]];
  assert.equal(countOpen(rows, 1, "2026-10-21"), 2);
  assert.equal(countOpen([], 1, "2026-10-21"), 0);
});

test("liveRenewals drops contracts that already ended", () => {
  const rows = [["x", "2026-09-26"], ["y", "2026-10-21"], ["z", "2027-03-01"]];
  assert.deepEqual(liveRenewals(rows, 1, "2026-10-21").map((r) => r[0]), ["y", "z"]);
});

test("recentMonths keeps the last 12 of a 13-month feed", () => {
  const months = Array.from({ length: 13 }, (_, i) => ({ label: `m${i}`, value: 1 }));
  const out = recentMonths(months, 12);
  assert.equal(out.length, 12);
  assert.equal(out[0].label, "m1");
  assert.equal(recentMonths(months.slice(0, 3), 12).length, 3);
});

test("coverageSkewed flags a final month that dwarfs the rest", () => {
  const steady = [100, 120, 110, 130, 90].map((value) => ({ value }));
  assert.equal(coverageSkewed(steady), false);
  // Shape of the Sep 2026 snapshot: ~190 a month, then 7,374.
  const skewed = [113, 102, 138, 187, 179, 182, 190, 215, 250, 406, 897, 7374].map((value) => ({ value }));
  assert.equal(coverageSkewed(skewed), true);
  assert.equal(coverageSkewed([{ value: 1 }, { value: 100 }]), false, "too few months to judge");
  assert.equal(coverageSkewed([{ value: 0 }, { value: 0 }, { value: 50 }]), false, "zero median");
});

test("emailText renders a pasteable draft", () => {
  assert.equal(emailText({ to: "a@b.com", su: "Hi", bo: "Body\nline" }), "To: a@b.com\nSubject: Hi\n\nBody\nline");
  assert.equal(emailText({ to: "", su: "Hi", bo: "Body" }), "Subject: Hi\n\nBody");
});
