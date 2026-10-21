import { test } from "node:test";
import assert from "node:assert/strict";
import { CsvParser, cleanText, deadlineDate, isUS, simplicity, valueScore, score } from "../scripts/sam-lib.js";

const parseAll = (chunks) => {
  const p = new CsvParser(), out = [];
  for (const c of chunks) out.push(...p.push(c));
  out.push(...p.end());
  return out;
};

test("CsvParser handles quotes, commas and newlines inside fields", () => {
  const csv = 'a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n1,,3\n';
  assert.deepEqual(parseAll([csv]), [["a", "b", "c"], ["x, y", 'say "hi"', "line1\nline2"], ["1", "", "3"]]);
});

test("CsvParser gives the same records however the text is chunked", () => {
  const csv = 'id,desc\n1,"he said ""ok"", then left"\n2,plain\n';
  const whole = parseAll([csv]);
  for (let cut = 1; cut < csv.length; cut++) assert.deepEqual(parseAll([csv.slice(0, cut), csv.slice(cut)]), whole, `cut at ${cut}`);
});

test("CsvParser keeps a last record with no trailing newline", () => {
  assert.deepEqual(parseAll(['a,b\n1,"2"']), [["a", "b"], ["1", "2"]]);
});

test("windows-1252 decoding restores curly punctuation", () => {
  const bytes = new Uint8Array([0x93, 0x68, 0x69, 0x94, 0x20, 0x96, 0x20, 0x69, 0x74, 0x92, 0x73]);
  assert.equal(new TextDecoder("windows-1252").decode(bytes), "“hi” – it’s");
});

test("cleanText strips tags, decodes entities and collapses space", () => {
  assert.equal(cleanText("<p>Roof&nbsp;repair &amp; <b>paint</b></p>\n\n<br/>Bldg&#160;12 &rsquo;s"), "Roof repair & paint Bldg 12 ’s");
  assert.equal(cleanText(null), "");
});

test("deadlineDate takes the notice's own calendar day", () => {
  assert.equal(deadlineDate("2026-10-28T08:00:00-05:00"), "2026-10-28");
  assert.equal(deadlineDate("2026-10-28"), "2026-10-28");
  assert.equal(deadlineDate(""), "");
  assert.equal(deadlineDate("TBD"), "");
});

test("isUS uses place of performance, then office, blank counts as US", () => {
  assert.equal(isUS("USA", "USA"), true);
  assert.equal(isUS("", ""), true);
  assert.equal(isUS("JPN", "USA"), false);
  assert.equal(isUS("", "DEU"), false);
});

test("simplicity ranks quotable buys above sole-source and sources-sought", () => {
  const quote = simplicity({ type: "Combined Synopsis/Solicitation", title: "Gloves, NSN 8415-01", desc: "FOB destination delivery" });
  const sole = simplicity({ type: "Combined Synopsis/Solicitation", title: "Notice of intent to award sole source", desc: "" });
  const sought = simplicity({ type: "Sources Sought", title: "Market research", desc: "" });
  assert.ok(quote > sole && quote > sought);
  for (const s of [quote, sole, sought]) { assert.ok(s >= 0 && s <= 100); assert.equal(s % 5, 0); }
});

test("valueScore is log-scaled and bounded; unknown value is low but not zero", () => {
  assert.equal(valueScore(20e3), 0);
  assert.equal(valueScore(5e6), 100);
  assert.equal(valueScore(1e9), 100);
  assert.ok(valueScore(500e3) > valueScore(50e3));
  assert.equal(valueScore(null), 10);
  assert.equal(score(null, 0), 6);
});
