import { test } from "node:test";
import assert from "node:assert/strict";
import { quantileBins } from "../charts.js";

test("quantileBins spreads skewed counts across all five shades", () => {
  // Shape of the state map: a few states with hundreds, most with a handful.
  const counts = [1, 2, 3, 5, 7, 10, 14, 23, 33, 62, 84, 125, 136, 203];
  const bin = quantileBins(counts);
  const used = new Set(counts.map(bin));
  assert.equal(used.size, 5, "every shade is used, not just the palest");
  assert.equal(bin(1), 0);
  assert.equal(bin(203), 4);
});

test("quantileBins marks zero as empty and is monotonic", () => {
  const bin = quantileBins([0, 0, 4, 9, 16, 25, 36]);
  assert.equal(bin(0), -1);
  let prev = -1;
  for (const v of [1, 4, 9, 16, 25, 36, 100]) { assert.ok(bin(v) >= prev); prev = bin(v); }
});

test("quantileBins with no data never throws", () => {
  assert.equal(quantileBins([])(5), -1);
  assert.equal(quantileBins([0, 0])(0), -1);
  assert.equal(quantileBins([7])(7), 4);
});
