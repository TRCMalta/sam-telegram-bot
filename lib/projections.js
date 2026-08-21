/**
 * lib/projections.js — deterministic investment maths for Beverly.
 *
 * Deliberately NOT done by the language model. Compounding arithmetic over a
 * 40-year horizon is exactly the kind of thing LLMs get subtly wrong, and a
 * wrong number here is a real financial decision made on bad information.
 * Every figure below comes from a closed-form formula.
 *
 * It is also free: no tokens, no API, no latency.
 *
 * Honesty rules baked into the output:
 *   - Always a RANGE of return scenarios, never one confident number.
 *     A single figure implies a precision that does not exist.
 *   - Always the inflation-adjusted (real) value alongside the nominal one.
 *     "€1.2m in 40 years" means far less than it sounds.
 *   - Always net of fund fees, because a TER compounds against you exactly
 *     the way returns compound for you.
 *   - Always the contributed-vs-growth split, so the effect of compounding
 *     is visible rather than asserted.
 */

// Long-run reference points. These are historical averages, not forecasts,
// and the output says so. Sources: S&P 500 total return since 1926 has
// averaged roughly 10% nominal / ~7% real, with very wide dispersion over
// any individual 15-40 year window.
export const RETURN_PRESETS = {
  "s&p 500":   { conservative: 6, base: 8,   optimistic: 10, label: "S&P 500" },
  "sp500":     { conservative: 6, base: 8,   optimistic: 10, label: "S&P 500" },
  "world":     { conservative: 5, base: 7,   optimistic: 9,  label: "Global equities (FTSE All-World)" },
  "msci world":{ conservative: 5, base: 7,   optimistic: 9,  label: "MSCI World" },
  "bonds":     { conservative: 1.5, base: 3, optimistic: 4.5, label: "Investment-grade bonds" },
  "balanced":  { conservative: 3.5, base: 5.5, optimistic: 7.5, label: "60/40 balanced" },
};

// Typical ongoing charge for a large UCITS index ETF. Beverly can override.
export const DEFAULT_TER_PCT = 0.07;
// ECB target. Malta is in the eurozone.
export const DEFAULT_INFLATION_PCT = 2.0;

/**
 * Future value of a lump sum plus a level monthly contribution.
 *
 * Uses an ordinary annuity (contribution at each month END), which is the
 * conservative convention — a start-of-month contribution earns one extra
 * month of growth.
 *
 * @param initial     lump sum invested today
 * @param monthly     contribution per month
 * @param years       horizon
 * @param annualNetPct  annual return AFTER fees, as a percent
 */
export function futureValue(initial, monthly, years, annualNetPct) {
  const n = Math.round(years * 12);
  // Convert an annual EFFECTIVE rate to its monthly equivalent via the twelfth
  // root. This is deliberate and matters.
  //
  // Many online calculators instead use annual/12 as the monthly rate. That
  // treats the headline figure as a nominal rate compounded monthly, which
  // quietly raises the true annual return (7% becomes an effective 7.23%) and
  // inflates a 30-year result by roughly 4%. When anyone quotes "the S&P 500
  // returned 8% a year" they mean the effective annualised return, so the
  // twelfth root is the faithful reading — and the more conservative one.
  //
  // If Beverly cross-checks against a web calculator and sees a bigger number,
  // this convention is why.
  const r = Math.pow(1 + annualNetPct / 100, 1 / 12) - 1;

  const fvLump = initial * Math.pow(1 + r, n);
  // r can be 0 if someone passes a 0% return; the annuity formula divides by r.
  const fvContrib = r === 0
    ? monthly * n
    : monthly * ((Math.pow(1 + r, n) - 1) / r);

  return { fvLump, fvContrib, total: fvLump + fvContrib, months: n, monthlyRate: r };
}

/**
 * Full projection across several horizons and several return scenarios.
 */
export function projectInvestment({
  initial = 0,
  monthly = 0,
  years = [15, 20, 30, 40],
  instrument = "s&p 500",
  returns = null,          // { conservative, base, optimistic } to override the preset
  terPct = DEFAULT_TER_PCT,
  inflationPct = DEFAULT_INFLATION_PCT,
  currency = "EUR",
} = {}) {
  const preset = returns
    ? { ...returns, label: (returns.label || instrument) }
    : (RETURN_PRESETS[String(instrument).toLowerCase().trim()] || RETURN_PRESETS["s&p 500"]);

  const scenarios = ["conservative", "base", "optimistic"];
  const horizons = [...years].sort((a, b) => a - b).map((yrs) => {
    const contributed = initial + monthly * Math.round(yrs * 12);

    const byScenario = {};
    for (const s of scenarios) {
      const grossPct = preset[s];
      // A fund's ongoing charge is levied on assets, so it comes straight off
      // the return and then compounds against you for the whole horizon.
      const netPct = grossPct - terPct;
      const { total, fvLump, fvContrib } = futureValue(initial, monthly, yrs, netPct);
      const real = total / Math.pow(1 + inflationPct / 100, yrs);
      // What the same money would be worth having never been invested.
      const feeDrag = futureValue(initial, monthly, yrs, grossPct).total - total;

      byScenario[s] = {
        grossReturnPct: grossPct,
        netReturnPct: Number(netPct.toFixed(3)),
        nominal: total,
        real,
        fromLumpSum: fvLump,
        fromContributions: fvContrib,
        growth: total - contributed,
        growthMultiple: contributed > 0 ? total / contributed : 0,
        feeDrag,
      };
    }
    return { years: yrs, contributed, ...byScenario, byScenario };
  });

  return {
    inputs: { initial, monthly, instrument: preset.label, terPct, inflationPct, currency },
    assumedReturns: {
      conservative: preset.conservative,
      base: preset.base,
      optimistic: preset.optimistic,
    },
    horizons,
  };
}

function money(n, currency = "EUR") {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : currency + " ";
  const abs = Math.abs(n);
  // Keep long horizons readable on a phone without losing the real figure.
  if (abs >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}m`;
  if (abs >= 10_000)    return `${sym}${Math.round(n).toLocaleString("en-GB")}`;
  return `${sym}${n.toFixed(0)}`;
}

/**
 * Render for WhatsApp/Telegram — narrow screen, scannable, no wide tables.
 */
export function formatProjection(p) {
  const { initial, monthly, instrument, terPct, inflationPct, currency } = p.inputs;
  const c = (n) => money(n, currency);
  const L = [];

  L.push(`*${instrument} projection*`);
  L.push(`${c(initial)} today${monthly > 0 ? ` + ${c(monthly)}/month` : ""}`);
  L.push("");

  for (const h of p.horizons) {
    const b = h.base;
    L.push(`*${h.years} years*`);
    L.push(`You'd put in: ${c(h.contributed)}`);
    L.push(`Likely value: ${c(b.nominal)}  (range ${c(h.conservative.nominal)} – ${c(h.optimistic.nominal)})`);
    L.push(`Of that, growth: ${c(b.growth)} — ${b.growthMultiple.toFixed(1)}x your money`);
    L.push(`In today's money: ${c(b.real)}`);
    L.push("");
  }

  L.push(`_Assumptions_`);
  L.push(`Returns: ${p.assumedReturns.conservative}% / ${p.assumedReturns.base}% / ${p.assumedReturns.optimistic}% a year before fees.`);
  L.push(`Fund fee ${terPct}% a year deducted. Inflation ${inflationPct}% for the "today's money" line.`);
  L.push(`Contributions assumed at month end, never increased.`);
  L.push("");
  L.push(`These are historical averages, not forecasts. Real markets don't deliver an average every year — the order returns arrive in matters, and a long flat stretch early on changes the outcome materially. A euro investor in a US index also carries USD/EUR currency risk unless the fund is hedged. Tax treatment isn't modelled here; that one's worth putting to a licensed adviser.`);

  return L.join("\n");
}
