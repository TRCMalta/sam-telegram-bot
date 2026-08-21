/**
 * Fallback routing checks.
 *
 * The keyword classifier runs whenever Hermes is unavailable. If it under-
 * selects, Sam loses the tool he needed and cannot answer; if it never fires,
 * every message pays for all 43 tool schemas. Both matter, so these cases are
 * drawn from how Beverly actually writes.
 *
 * Run: node test/routing.test.mjs
 */
import { heuristicDomains } from "../lib/llm.js";

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

// [message, domains that MUST be selected]
const cases = [
  ["work out the compounded return on 15k plus 200 a month over 30 years", ["finance"]],
  ["what's my portfolio worth", ["finance"]],
  ["bought 50 NVDA at 118 this morning", ["finance"]],
  ["how's the S&P doing", ["finance"]],
  ["am I actually making money trading", ["finance"]],
  ["what do I owe Jonathan", ["memory"]],
  ["what's outstanding this week", ["memory"]],
  ["remind me what we decided about the Betsson proposal", ["memory"]],
  ["any emails from Maria", ["m365"]],
  ["what's on my calendar tomorrow", ["m365"]],
  ["how many candidates did we place last month", ["firefish"]],
  ["show me the Ceek recruitment pipeline", ["firefish"]],
  ["what leads came in from the website", ["odoo"]],
  ["is that course eligible for MySkills", ["odoo"]],
  ["find me a flight to London", ["web"]],
  ["look up Betsson's latest news", ["web"]],
];

console.log("— domain selection —");
for (const [msg, expected] of cases) {
  const got = heuristicDomains(msg);
  const hit = got !== null && expected.every((e) => got.includes(e));
  ok(hit, `"${msg.slice(0, 48)}${msg.length > 48 ? "…" : ""}" → ${got ? got.join(",") : "null"} (need ${expected.join(",")})`);
}

console.log("\n— no false signal on smalltalk —");
for (const msg of ["thanks", "morning Sam", "ok", "perfect, cheers", "yes please"]) {
  const got = heuristicDomains(msg);
  ok(got === null, `"${msg}" → null (falls through to full tool set, which is correct for ambiguity)`);
}

console.log("\n— empty input —");
ok(heuristicDomains("") === null, "empty string → null");
ok(heuristicDomains(null) === null, "null → null");

console.log(`\n${failures === 0 ? "ALL ROUTING CHECKS PASSED" : `*** ${failures} CHECK(S) FAILED ***`}`);
process.exit(failures === 0 ? 0 : 1);
