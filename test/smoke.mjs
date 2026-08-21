/**
 * Boot smoke test.
 *
 * Sam ships with every new integration optional, which only matters if the
 * "nothing configured" path genuinely still boots. That is easy to break
 * silently — a top-level import of a missing module, a schema call that throws
 * before listen(), an await that never resolves. This starts the real server
 * and proves it serves traffic.
 *
 * Runs in two modes:
 *   degraded — no DATABASE_URL, no router, no market data
 *   full     — DATABASE_URL present (skipped when there is no database)
 *
 * Run: node test/smoke.mjs
 */
import { spawn } from "node:child_process";

const PORT = Number(process.env.SMOKE_PORT || 3971);
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

/**
 * Wait for the server to finish booting, then read its capabilities.
 *
 * Polling the HTTP endpoint alone is not enough: express starts accepting
 * connections the instant app.listen() is called, so a 200 can arrive before
 * boot has finished and the capability flags would read false for things that
 * are merely still initialising. The [BOOT] log line is emitted last, so it is
 * the honest "fully up" signal. Waiting on it makes this test deterministic
 * instead of a race.
 */
async function waitForBoot(getOutput, port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (/\[BOOT\]/.test(getOutput())) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/healthz/capabilities`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return await res.json();
      } catch { /* listener not accepting yet */ }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function bootAndProbe(label, extraEnv, port) {
  console.log(`\n— ${label} —`);
  const child = spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      ANTHROPIC_API_KEY: "sk-ant-smoke-test",
      TELEGRAM_TOKEN: "smoke:token",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let out = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });

  let crashed = false;
  child.on("exit", (code) => { if (code !== 0 && code !== null) crashed = true; });

  const caps = await waitForBoot(() => out, port);
  const result = { caps, out, crashed };

  child.kill("SIGKILL");
  await new Promise((r) => child.on("close", r));
  return result;
}

// ── degraded: nothing configured ──
{
  const { caps, out, crashed } = await bootAndProbe(
    "degraded boot (no database, no router, no market data)",
    { DATABASE_URL: "", OPENROUTER_API_KEY: "", FINNHUB_API_KEY: "", T212_API_KEY: "" },
    PORT,
  );
  ok(!crashed, "process did not exit with an error");
  ok(caps !== null, "server finished booting and served /healthz/capabilities");
  if (caps) {
    ok(caps.tools > 0, `tools registered (${caps.tools})`);
    ok(caps.capabilities.durableMemory === false, "durable memory correctly reported off");
    ok(caps.capabilities.investmentProjections === true, "projections work with no dependencies");
    ok(caps.capabilities.tradeExecution === false, "trade execution is off — and must always be");
  }
  ok(/memory-only mode/.test(out), "logs that it is running memory-only");
  if (!caps) console.log(out.split("\n").slice(-15).join("\n"));
}

// ── full: with a database ──
if (process.env.DATABASE_URL) {
  const { caps, out, crashed } = await bootAndProbe(
    "full boot (database connected)",
    { DATABASE_URL: process.env.DATABASE_URL, PGSSL: process.env.PGSSL || "off", BEVERLY_WA_NUMBER: "35699000000" },
    PORT + 1,
  );
  ok(!crashed, "process did not exit with an error");
  ok(caps !== null, "server came up with the database attached");
  if (caps) {
    ok(caps.capabilities.durableMemory === true, "durable memory reported live");
    ok(caps.capabilities.openItemTracking === true, "open-item tracking reported live");
    ok(caps.capabilities.tradeExecution === false, "trade execution still off with everything connected");
  }
  ok(/\[DB\] schema ready/.test(out), "schema applied on boot");
  ok(/\[PROACTIVE\] scheduled/.test(out), "proactive cadence started");
  if (!caps) console.log(out.split("\n").slice(-15).join("\n"));
} else {
  console.log("\n— full boot — SKIPPED (no DATABASE_URL)");
}

console.log(`\n${failures === 0 ? "ALL SMOKE CHECKS PASSED" : `*** ${failures} CHECK(S) FAILED ***`}`);
process.exit(failures === 0 ? 0 : 1);
