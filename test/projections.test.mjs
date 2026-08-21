/**
 * Verifies the compounding maths by brute-force simulation.
 *
 * The closed-form annuity formula is easy to get subtly wrong, and these
 * numbers inform real financial decisions, so every formula result is checked
 * against a month-by-month loop that shares none of its logic.
 *
 * Run: node test/projections.test.mjs
 */
import { futureValue, projectInvestment } from "../lib/projections.js";

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

// Independent month-by-month simulation — no shared code with futureValue().
function simulate(initial, monthly, years, annualPct) {
  const r = Math.pow(1 + annualPct / 100, 1 / 12) - 1;
  let bal = initial;
  for (let m = 0; m < Math.round(years * 12); m++) {
    bal = bal * (1 + r);
    bal += monthly;
  }
  return bal;
}

console.log("— closed form vs simulation —");
for (const [initial, monthly, years, rate] of [
  [15000, 200, 30, 7.93],
  [15000, 200, 15, 7.93],
  [15000, 200, 40, 5.93],
  [0,     500, 20, 9.93],
  [50000, 0,   10, 3.0],
  [1000,  100, 5,  0.0],    // zero return — annuity formula divides by r
  [0,     0,   10, 8.0],    // all zeros
]) {
  const f = futureValue(initial, monthly, years, rate).total;
  const s = simulate(initial, monthly, years, rate);
  const rel = s === 0 ? Math.abs(f) : Math.abs(f - s) / s;
  ok(rel < 1e-9, `${initial}+${monthly}/mo ${years}y @${rate}% → €${f.toFixed(2)} (rel diff ${rel.toExponential(1)})`);
}

console.log("\n— effective-annual convention —");
// 7% effective annual, monthly rate = 1.07^(1/12)-1. NOT 7%/12, which would
// give ~243,994 and imply a true 7.23% annual return.
ok(Math.abs(futureValue(0, 200, 30, 7).total - 233891) < 50,
   "€200/mo 30y @7% effective = ~€233,891 (not the €243,994 of the nominal/12 convention)");
// A lump sum at an effective rate must exactly equal the simple power formula.
ok(Math.abs(futureValue(10000, 0, 25, 6).total - 10000 * Math.pow(1.06, 25)) < 1e-6,
   "lump sum matches (1+r)^n exactly");

console.log("\n— projection invariants —");
const p = projectInvestment({ initial: 15000, monthly: 200, years: [15, 20, 30, 40] });
ok(p.horizons.length === 4, "four horizons returned");
ok(p.horizons.every(h => h.contributed === 15000 + 200 * h.years * 12), "contributed = lump + monthly × months");
ok(p.horizons.every(h => h.conservative.nominal < h.base.nominal && h.base.nominal < h.optimistic.nominal),
   "scenarios strictly ordered conservative < base < optimistic");
ok(p.horizons.every(h => h.base.real < h.base.nominal), "real value below nominal under positive inflation");
ok(p.horizons.every(h => h.base.feeDrag > 0), "fee drag positive");
ok(p.horizons.every((h, i) => i === 0 || h.base.nominal > p.horizons[i - 1].base.nominal),
   "value increases with horizon");
ok(p.horizons.every(h => Math.abs((h.base.fromLumpSum + h.base.fromContributions) - h.base.nominal) < 1e-6),
   "lump-sum and contribution components sum to the total");
ok(p.horizons.every(h => Math.abs(h.base.growth - (h.base.nominal - h.contributed)) < 1e-6),
   "growth = total − contributed");

// Fee drag must scale with the horizon — a TER compounds against you.
const fees = p.horizons.map(h => h.base.feeDrag);
ok(fees.every((f, i) => i === 0 || f > fees[i - 1]), "fee drag grows with horizon");

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `*** ${failures} CHECK(S) FAILED ***`}`);
process.exit(failures === 0 ? 0 : 1);
