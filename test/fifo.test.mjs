/**
 * FIFO realised P&L checks.
 *
 * Cost-basis matching decides what Beverly's records say she made or lost, and
 * an off-by-one-lot error is invisible until it reconciles wrong against a
 * broker statement. Each case is hand-computed in the comment.
 *
 * Run: node test/fifo.test.mjs
 */
import { fifoRealised } from "../lib/finance.js";

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

const T = (symbol, side, quantity, price, day, fees = 0) => ({
  symbol, side, quantity, price, fees,
  traded_at: `2026-01-${String(day).padStart(2, "0")}T10:00:00Z`,
  currency: "USD",
});

// ── 1. Simple round trip: buy 10 @100, sell 10 @120 → +200
{
  const { closed, openLots } = fifoRealised([T("AAA", "buy", 10, 100, 1), T("AAA", "sell", 10, 120, 5)]);
  ok(closed.length === 1 && near(closed[0].pnl, 200), `simple round trip = +200 (got ${closed[0]?.pnl})`);
  ok(!openLots.AAA, "no open lot left");
  ok(near(closed[0].holdingDays, 4), `holding period 4 days (got ${closed[0]?.holdingDays})`);
}

// ── 2. FIFO ordering: buy 10@100, buy 10@200, sell 10@150.
//      Must consume the £100 lot first → +500, leaving the 200 lot open.
{
  const { closed, openLots } = fifoRealised([
    T("BBB", "buy", 10, 100, 1), T("BBB", "buy", 10, 200, 2), T("BBB", "sell", 10, 150, 3),
  ]);
  ok(closed.length === 1 && near(closed[0].pnl, 500), `FIFO takes oldest lot: +500 (got ${closed[0]?.pnl})`);
  ok(openLots.BBB && near(openLots.BBB.quantity, 10) && near(openLots.BBB.avgCost, 200),
     `remaining lot is 10 @200 (got ${openLots.BBB?.quantity} @${openLots.BBB?.avgCost})`);
}

// ── 3. Partial sell spanning two lots: buy 10@100, buy 10@200, sell 15@150.
//      10 from the 100 lot (+500) and 5 from the 200 lot (−250) → two round trips.
{
  const { closed, openLots } = fifoRealised([
    T("CCC", "buy", 10, 100, 1), T("CCC", "buy", 10, 200, 2), T("CCC", "sell", 15, 150, 3),
  ]);
  ok(closed.length === 2, `sell spanning lots produces 2 round trips (got ${closed.length})`);
  ok(near(closed[0].pnl, 500) && near(closed[1].pnl, -250),
     `+500 then -250 (got ${closed[0]?.pnl}, ${closed[1]?.pnl})`);
  ok(openLots.CCC && near(openLots.CCC.quantity, 5) && near(openLots.CCC.avgCost, 200),
     `5 left @200 (got ${openLots.CCC?.quantity} @${openLots.CCC?.avgCost})`);
}

// ── 4. Fees reduce P&L on both sides.
//      buy 10@100 fee 5, sell 10@120 fee 7 → 200 − 5 − 7 = 188
{
  const { closed } = fifoRealised([T("DDD", "buy", 10, 100, 1, 5), T("DDD", "sell", 10, 120, 5, 7)]);
  ok(near(closed[0].pnl, 188), `fees deducted both sides = 188 (got ${closed[0]?.pnl})`);
}

// ── 5. Fees apportioned on a partial disposal.
//      buy 20@100 fee 10, sell 10@120 fee 4.
//      buy-fee share = 10 × 10/20 = 5; sell-fee share = 4 × 10/10 = 4 → 200 − 5 − 4 = 191
{
  const { closed, openLots } = fifoRealised([T("EEE", "buy", 20, 100, 1, 10), T("EEE", "sell", 10, 120, 5, 4)]);
  ok(near(closed[0].pnl, 191), `apportioned fees = 191 (got ${closed[0]?.pnl})`);
  ok(near(openLots.EEE.quantity, 10), "10 still open");
}

// ── 6. Unmatched sell is surfaced, not silently dropped.
{
  const { closed } = fifoRealised([T("FFF", "sell", 5, 50, 1)]);
  ok(closed.length === 1 && closed[0].unmatched === true && closed[0].pnl === null,
     "sell with no matching buy flagged unmatched with null pnl");
}

// ── 7. Chronological correctness — input given newest-first must still be FIFO.
{
  const reversed = [T("GGG", "sell", 10, 150, 3), T("GGG", "buy", 10, 200, 2), T("GGG", "buy", 10, 100, 1)];
  const { closed, openLots } = fifoRealised(reversed);
  ok(closed.length === 1 && near(closed[0].pnl, 500),
     `re-sorts unordered input before matching: +500 (got ${closed[0]?.pnl})`);
  ok(near(openLots.GGG.avgCost, 200), "correct lot left open after re-sort");
}

// ── 8. Multiple symbols stay independent.
{
  const { closed, openLots } = fifoRealised([
    T("HHH", "buy", 10, 100, 1), T("III", "buy", 10, 500, 1),
    T("HHH", "sell", 10, 110, 2),
  ]);
  ok(closed.length === 1 && closed[0].symbol === "HHH" && near(closed[0].pnl, 100),
     "symbols matched independently");
  ok(openLots.III && near(openLots.III.quantity, 10), "other symbol untouched");
}

// ── 9. Full exit then re-entry — average cost must reset, not blend.
{
  const { closed, openLots } = fifoRealised([
    T("JJJ", "buy", 10, 100, 1), T("JJJ", "sell", 10, 90, 2), T("JJJ", "buy", 5, 300, 3),
  ]);
  ok(near(closed[0].pnl, -100), `realised loss -100 (got ${closed[0]?.pnl})`);
  ok(near(openLots.JJJ.avgCost, 300), `re-entry cost basis is 300, not blended (got ${openLots.JJJ?.avgCost})`);
}

// ── 10. Fractional shares (T212 allows them) must not drift.
{
  const { closed, openLots } = fifoRealised([
    T("KKK", "buy", 0.5, 100, 1), T("KKK", "buy", 0.25, 200, 2), T("KKK", "sell", 0.6, 150, 3),
  ]);
  // 0.5 @100 → +25 ; 0.1 @200 → −5
  ok(closed.length === 2 && near(closed[0].pnl, 25) && near(closed[1].pnl, -5, 1e-9),
     `fractional lots: +25 then -5 (got ${closed[0]?.pnl}, ${closed[1]?.pnl})`);
  ok(near(openLots.KKK.quantity, 0.15, 1e-9), `0.15 left (got ${openLots.KKK?.quantity})`);
}

console.log(`\n${failures === 0 ? "ALL FIFO CHECKS PASSED" : `*** ${failures} CHECK(S) FAILED ***`}`);
process.exit(failures === 0 ? 0 : 1);
