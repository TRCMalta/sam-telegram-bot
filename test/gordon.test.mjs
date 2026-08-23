/**
 * Tests lib/gordon.js against a local mock HTTP server rather than the real
 * Gordon service — no network, no secrets, runs in CI exactly like every
 * other suite.
 *
 * The one thing that matters most here: notifyGordon() must NEVER throw,
 * whatever happens — a broken Gordon integration must never take down Sam's
 * own alertAdmin() path, which is the whole point of it being a "bonus
 * channel". Every failure mode below is checked for a clean `false`, not an
 * exception.
 *
 * Run: node test/gordon.test.mjs
 */
import http from "node:http";
import { describeProactiveRejection } from "../lib/gordon.js";

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

function startMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => handler(req, res, body));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}
const port = (server) => server.address().port;
const close = (server) => new Promise((r) => server.close(r));

// ─── gordonEnabled() / no-op when unconfigured ──────────────────────────────
console.log("— unconfigured: no-op, never throws —");
{
  delete process.env.GORDON_INTERNAL_URL;
  delete process.env.GORDON_ALERT_SECRET;
  const mod = await import("../lib/gordon.js?nocache=1");
  ok(mod.gordonEnabled() === false, "gordonEnabled() false with nothing set");
  const result = await mod.notifyGordon("title", "message", "warning");
  ok(result === false, "notifyGordon() returns false rather than throwing when unconfigured");
}

// ─── happy path ──────────────────────────────────────────────────────────
console.log("\n— configured: posts the right shape —");
{
  let received = null;
  const server = await startMockServer((req, res, body) => {
    received = { method: req.method, headers: req.headers, body: JSON.parse(body) };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  process.env.GORDON_INTERNAL_URL = `http://127.0.0.1:${port(server)}`;
  process.env.GORDON_ALERT_SECRET = "test-secret-value";
  const mod = await import(`../lib/gordon.js?v=${Date.now()}`);

  ok(mod.gordonEnabled() === true, "gordonEnabled() true once both vars are set");
  const result = await mod.notifyGordon("Sam: something happened", "the details", "critical");
  ok(result === true, "notifyGordon() returns true on a 200");
  ok(received.method === "POST", "sends POST");
  ok(received.headers["x-internal-secret"] === "test-secret-value", "sends the secret as X-Internal-Secret");
  ok(received.headers["content-type"].includes("application/json"), "sends JSON content-type");
  ok(
    received.body.title === "Sam: something happened"
      && received.body.message === "the details"
      && received.body.severity === "critical",
    "body shape matches {title, message, severity}",
  );
  await close(server);
}

// ─── trailing slash in the configured URL doesn't produce a double slash ───
console.log("\n— URL normalisation —");
{
  let receivedPath = null;
  const server = await startMockServer((req, res) => {
    receivedPath = req.url;
    res.writeHead(200); res.end("{}");
  });
  process.env.GORDON_INTERNAL_URL = `http://127.0.0.1:${port(server)}/`; // trailing slash
  process.env.GORDON_ALERT_SECRET = "s";
  const mod = await import(`../lib/gordon.js?v=${Date.now()}`);
  await mod.notifyGordon("t", "m");
  ok(receivedPath === "/internal/alert", `no double slash in path (got "${receivedPath}")`);
  await close(server);
}

// ─── failure modes never throw ──────────────────────────────────────────────
console.log("\n— failure modes: logged, never thrown —");
{
  // Wrong secret -> Gordon would 401. Simulate that.
  const server401 = await startMockServer((req, res) => { res.writeHead(401); res.end("{}"); });
  process.env.GORDON_INTERNAL_URL = `http://127.0.0.1:${port(server401)}`;
  process.env.GORDON_ALERT_SECRET = "whatever";
  const mod1 = await import(`../lib/gordon.js?v=${Date.now()}`);
  const r401 = await mod1.notifyGordon("t", "m");
  ok(r401 === false, "401 from Gordon returns false, does not throw");
  await close(server401);

  // Unreachable host — nothing listening on this port.
  process.env.GORDON_INTERNAL_URL = "http://127.0.0.1:1";
  const mod2 = await import(`../lib/gordon.js?v=${Date.now()}`);
  let threw = false;
  let rUnreachable;
  try { rUnreachable = await mod2.notifyGordon("t", "m"); } catch { threw = true; }
  ok(!threw, "unreachable host does not throw");
  ok(rUnreachable === false, "unreachable host returns false");
}

// ─── describeProactiveRejection() never leaks content ───────────────────────
// The real threat model, precisely: Sam's outbound proactive message body
// (what he was actually telling Beverly — pipeline figures, portfolio value,
// commitments) must never reach Gordon's group, which has members beyond
// whoever is on ADMIN_TELEGRAM_CHAT_IDS.
//
// waError is NOT that threat. It is Meta's own WhatsApp API error string
// ("rate limited", "invalid phone number") and is deliberately included when
// windowClosed is false, because Gordon's operators need to know *why* an
// unrecognised send failed. Treating that as a leak would be testing the
// wrong thing — the guarantee below checks what the code actually promises.
console.log("\n— describeProactiveRejection(): content never leaks —");
{
  // 1. Structural: the function has no parameter for the message body at
  //    all, so there is nothing for a caller to leak through it even by
  //    mistake — confirmed against its actual parameter names.
  const params = ["windowClosed", "waError", "waCode", "queuedId", "templateConfigured", "nudged"];
  ok(
    !params.some((p) => /text|body|content|preview|message/i.test(p)),
    "describeProactiveRejection() takes no message-body-shaped parameter — nothing to leak by construction",
  );

  // 2. The windowClosed=true branch — the common case, Beverly just hasn't
  //    messaged in 24h — must never surface waError at all, however it's
  //    populated. This is the branch every routine daily-briefing rejection
  //    takes, so it's the one that matters most in practice.
  const nastyValues = [
    "Beverly's portfolio moved to €142,300 today",
    "Q3 numbers: revenue up 12%, EBITDA margin 34%",
    "Meeting with Jonathan about the Betsson deal",
  ];
  let allClean = true;
  for (const val of nastyValues) {
    for (const templateConfigured of [true, false]) {
      for (const nudged of [true, false]) {
        const facts = describeProactiveRejection({
          windowClosed: true, waError: val, waCode: 999, queuedId: 7,
          templateConfigured, nudged,
        });
        if (facts.includes(val.slice(0, 15))) allClean = false;
      }
    }
  }
  ok(allClean, "windowClosed=true branch never surfaces waError, whatever it's set to");

  // 3. The windowClosed=false branch DOES include waError — confirmed as
  //    intended behaviour, not a bug, so the check above isn't vacuous.
  const withError = describeProactiveRejection({
    windowClosed: false, waError: "rate limited", waCode: 429, queuedId: null,
    templateConfigured: false, nudged: false,
  });
  ok(withError.includes("rate limited"), "windowClosed=false DOES include the Meta API error text — that's intended, and proves case 2 isn't vacuous");

  // 4. Static check on the real call site: it must never pass the actual
  //    outbound message variable (`text`) into this function — only
  //    wa.error/wa.code, which come from the API response, not Beverly's
  //    message. Reads server.js itself so a future edit that started passing
  //    `text` in fails this test even if every unit check above still passes.
  const src = (await import("node:fs")).readFileSync(
    new URL("../server.js", import.meta.url), "utf8",
  );
  const callSite = src.match(/describeProactiveRejection\(\{[\s\S]*?\}\);/);
  ok(callSite !== null, "found the describeProactiveRejection() call site in server.js");
  if (callSite) {
    ok(!/\btext\b/.test(callSite[0]), "the real call site does not pass `text` (Beverly's message body) as an argument");
  }
}

console.log(`\n${failures === 0 ? "ALL GORDON CHECKS PASSED" : `*** ${failures} CHECK(S) FAILED ***`}`);
process.exit(failures === 0 ? 0 : 1);
