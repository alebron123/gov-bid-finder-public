// Pure logic shared by the page and the tests. Nothing here touches the DOM.

const DAY_MS = 86400e3;

// WHY: toISOString() is UTC, so in a US evening it already reads tomorrow and a
// contract due today drops out early. Dates in the feed are local calendar days.
export const localISODate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDaysISO = (days, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return localISODate(d);
};

// Whole calendar days from `today` to `due`, both YYYY-MM-DD. Due today is 0.
// WHY: both strings parse as UTC midnight, so the difference is an exact number of
// days with no daylight-saving or time-of-day drift.
export const daysBetween = (today, due) => Math.round((Date.parse(due) - Date.parse(today)) / DAY_MS);

// SAM.gov records "No Set aside used" as a set-aside value. It means the opposite:
// open to everyone. Treating it as truthy inflated the small-business count.
export const isSetAside = (label) => !!label && !/^no set[\s-]?aside/i.test(label);

export const countOpen = (rows, dueIdx, today) => {
  let n = 0;
  for (const r of rows) if (r[dueIdx] >= today) n++;
  return n;
};

// A renewal whose end date has passed is no longer a contract you can prepare for.
export const liveRenewals = (rows, endIdx, today) => rows.filter((r) => r[endIdx] >= today);

// The feed sometimes carries 13 months; the page promises the last 12.
export const recentMonths = (months, n = 12) => months.slice(-n);

// WHY 5x: the snapshot's latest month held 7,374 awards against a median of ~190
// for the others, a ~39x jump caused by how records were collected, not by spending.
// Genuine month-to-month swings in award counts stay well under 5x the median.
const COVERAGE_SKEW_RATIO = 5;
export const coverageSkewed = (months) => {
  if (months.length < 3) return false;
  const counts = months.slice(0, -1).map((m) => m.value).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];
  return median > 0 && months[months.length - 1].value > COVERAGE_SKEW_RATIO * median;
};

// The drafted outreach email as plain text, ready to paste into any mail client.
export const emailText = ({ to, su, bo }) => [to ? `To: ${to}` : "", `Subject: ${su}`, "", bo].filter((l, i) => i > 0 || l).join("\n");
