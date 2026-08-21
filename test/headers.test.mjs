/**
 * Guards against a class of bug that is invisible in production.
 *
 * fetch() requires every HTTP header value to be latin-1 encodable. A single
 * character above U+00FF — an em dash, a curly quote, an accented name — makes
 * fetch throw before the request leaves the process.
 *
 * That would be harmless if it surfaced. It does not: hermes() catches
 * everything and returns null so the router fails soft, meaning the only
 * symptom of a bad header is that Hermes silently never works and every
 * request quietly falls back to Claude. The token savings vanish and nothing
 * anywhere reports an error.
 *
 * This happened. "Sam — TRC Chief of Staff" in X-Title, found only by running
 * a real request against a real key. CI could not catch it because CI has no
 * OpenRouter key, so the code path never executed.
 *
 * Run: node test/headers.test.mjs
 */
import { openRouterHeaders } from "../lib/llm.js";

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

// Exactly what fetch does internally when building a ByteString.
function firstNonLatin1(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code > 255) return { index: i, char: str[i], code };
  }
  return null;
}

console.log("— OpenRouter headers are latin-1 safe —");
const headers = openRouterHeaders();
ok(Object.keys(headers).length > 0, "headers object is not empty");

for (const [name, value] of Object.entries(headers)) {
  const bad = firstNonLatin1(String(value));
  ok(
    bad === null,
    bad === null
      ? `${name}: latin-1 safe`
      : `${name}: contains "${bad.char}" (U+${bad.code.toString(16).toUpperCase()}) at index ${bad.index} — fetch will throw`,
  );
  const badName = firstNonLatin1(name);
  ok(badName === null, `${name}: header NAME latin-1 safe`);
}

// The real proof: hand them to the actual Headers constructor, which applies
// the same ByteString conversion fetch does.
console.log("\n— accepted by the Headers constructor —");
try {
  new Headers(headers);
  ok(true, "new Headers(openRouterHeaders()) succeeds");
} catch (err) {
  ok(false, `Headers constructor rejected them: ${err.message}`);
}

// Catch the specific character that caused the original bug.
console.log("\n— the character that caused this —");
ok(!JSON.stringify(headers).includes("—"), "no em dash (U+2014) anywhere in the headers");

// And prove the detector actually detects, so a green run means something.
console.log("\n— detector sanity —");
const planted = firstNonLatin1("Sam — TRC");
ok(planted !== null && planted.code === 8212, "detector finds a planted em dash (guards against a vacuous pass)");
ok(firstNonLatin1("Sam - TRC") === null, "detector passes clean ASCII");

console.log(`\n${failures === 0 ? "ALL HEADER CHECKS PASSED" : `*** ${failures} CHECK(S) FAILED ***`}`);
process.exit(failures === 0 ? 0 : 1);
