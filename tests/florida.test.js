import { test } from "node:test";
import assert from "node:assert/strict";
import { FL_COUNTIES, countyOf, SOUTH_FLORIDA } from "../florida.js";

test("all 67 Florida counties have a unique tile and label", () => {
  const entries = Object.entries(FL_COUNTIES);
  assert.equal(entries.length, 67);
  const cells = new Set(entries.map(([, [, c, r]]) => `${c},${r}`));
  assert.equal(cells.size, 67, "no two counties share a tile");
  const labels = new Set(entries.map(([, [l]]) => l));
  assert.equal(labels.size, 67, "labels are unique");
});

test("countyOf maps cities and bases, case and spacing insensitive", () => {
  assert.equal(countyOf("Miami"), "Miami-Dade");
  assert.equal(countyOf("  HOMESTEAD "), "Miami-Dade");
  assert.equal(countyOf("Eglin AFB"), "Okaloosa");
  assert.equal(countyOf("Patrick Air Force Base"), "Brevard");
  assert.equal(countyOf("Saint Petersburg"), "Pinellas");
  assert.equal(countyOf("Nowhere"), "");
  assert.equal(countyOf(""), "");
});

test("county feed rows always land in Miami-Dade", () => {
  assert.equal(countyOf("", "miami-dade"), "Miami-Dade");
  assert.equal(countyOf("Doral", "sam.gov"), "Miami-Dade");
});

test("every county the lookup returns has a tile", () => {
  for (const c of SOUTH_FLORIDA) assert.ok(FL_COUNTIES[c], c);
  for (const city of ["miami", "tampa", "orlando", "jacksonville", "pensacola", "key west", "naples", "gainesville"]) assert.ok(FL_COUNTIES[countyOf(city)], city);
});
