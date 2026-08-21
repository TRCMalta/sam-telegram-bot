/**
 * End-to-end checks against a real Postgres.
 *
 * The schema, the memory layer, open items and the portfolio all run real SQL.
 * A syntax error or a bad constraint here would break Sam's boot in production,
 * and unit tests over pure functions cannot catch that.
 *
 * Run: DATABASE_URL=postgres://... node test/integration.test.mjs
 */
import { initDb, dbAvailable, q, kvGet, kvSet, closeDb } from "../lib/db.js";
import * as mem from "../lib/memory.js";
import * as items from "../lib/openitems.js";
import * as fin from "../lib/finance.js";

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

console.log("— schema —");
const up = await initDb();
ok(up && dbAvailable(), "initDb applied the schema");

// Start from a clean slate. These assertions count rows, so leftover data from
// a previous run would fail them for the wrong reason.
await q(`TRUNCATE conversations, conversation_summaries, open_items, relationships,
         kv, holdings, trades, trade_journal, watchlist RESTART IDENTITY CASCADE`);

// Idempotent: boot runs this every time, so a redeploy must not fail.
ok(await initDb(), "initDb is idempotent (safe on every boot)");

const tables = await q(`SELECT table_name FROM information_schema.tables
                        WHERE table_schema='public' ORDER BY table_name`);
const names = tables.rows.map(r => r.table_name);
for (const t of ["conversations","conversation_summaries","open_items","relationships","kv",
                 "holdings","trades","trade_journal","watchlist"]) {
  ok(names.includes(t), `table ${t} exists`);
}

console.log("\n— kv (proactive dedupe) —");
await kvSet("test:key", { hello: "world" });
ok((await kvGet("test:key"))?.hello === "world", "kv round trip");
await kvSet("test:key", { hello: "again" });
ok((await kvGet("test:key"))?.hello === "again", "kv upsert overwrites");
ok((await kvGet("test:missing", "fallback")) === "fallback", "kv returns fallback when absent");

console.log("\n— conversation memory —");
const chat = "test-chat-1";
await mem.saveTurn(chat, "user", "what's my pipeline looking like", "telegram");
await mem.saveTurn(chat, "assistant", "Twelve open opportunities.", "telegram");
const ctx = await mem.loadContext(chat);
ok(ctx.messages.length === 2, `two turns loaded (got ${ctx.messages.length})`);
ok(ctx.messages[0].role === "user", "history starts on a user turn (Claude requires this)");
ok(ctx.messages[0].content === "what's my pipeline looking like", "content round trips intact");

// The critical property: a restart must not lose it.
const chat2 = "test-chat-2";
await mem.saveTurn(chat2, "user", "remember this", "whatsapp");
const direct = await q("SELECT content FROM conversations WHERE chat_id=$1", [chat2]);
ok(direct.rows.length === 1 && direct.rows[0].content === "remember this",
   "turn is durably on disk, not just in the cache");

console.log("\n— open items —");
const it = await items.createItem({
  title: "Send Jonathan the Q3 numbers", counterparty: "Jonathan Dalli",
  dueDate: "2020-01-01", detail: "before the board call",
});
ok(it && it.id, "commitment created");
ok(it.kind === "commitment", "defaults to commitment");
const open = await items.listItems({ status: "open" });
ok(open.some(o => o.id === it.id), "appears in the open list");
const overdue = await items.listItems({ status: "open", overdueOnly: true });
ok(overdue.some(o => o.id === it.id), "a past due date shows as overdue");
const due = await items.dueSoon({ withinDays: 0 });
ok(due.some(o => o.id === it.id), "dueSoon picks it up for chasing");
const closed = await items.closeItem(it.id);
ok(closed.status === "done" && closed.closed_at, "closing sets status and timestamp");
ok(!(await items.listItems({ status: "open" })).some(o => o.id === it.id), "closed item leaves the open list");

// Creating an item with a counterparty should also record the relationship.
ok((await items.listRelationships()).some(r => r.name === "Jonathan Dalli"),
   "counterparty auto-logged as a relationship");

console.log("\n— relationships —");
await items.touchRelationship("Maria Borg", { org: "Betsson", cadenceDays: 30,
  at: new Date(Date.now() - 90 * 86400000).toISOString() });
const stale = await items.staleRelationships();
ok(stale.some(s => s.name === "Maria Borg"), "90 days against a 30-day cadence flags as stale");
ok(!stale.some(s => s.name === "Jonathan Dalli"), "contact with no cadence set is not flagged");
await items.markRelationshipsAlerted(["Maria Borg"]);
ok(!(await items.staleRelationships()).some(s => s.name === "Maria Borg"),
   "alerting suppresses the repeat for a week");

console.log("\n— portfolio —");
await fin.upsertHolding({ symbol: "nvda", quantity: 50, avgCost: 118, currency: "USD" });
await fin.upsertHolding({ symbol: "NVDA", quantity: 60, avgCost: 120, currency: "USD" });
const held = await fin.listHoldings();
ok(held.length === 1 && held[0].symbol === "NVDA", "symbol normalised to upper case, upserted not duplicated");
ok(Number(held[0].quantity) === 60, "quantity updated on conflict");

await fin.upsertHolding({ symbol: "MT2030", quantity: 10000, avgCost: 98.5,
  assetClass: "bond", couponRate: 3.25, maturity: "2030-06-15", currency: "EUR" });
const bond = (await fin.listHoldings()).find(h => h.symbol === "MT2030");
ok(bond && Number(bond.coupon_rate) === 3.25 && bond.maturity, "bond coupon and maturity stored");

console.log("\n— trades —");
await fin.recordTrade({ symbol: "AAPL", side: "buy", quantity: 10, price: 100, externalId: "ext-1" });
const dup = await fin.recordTrade({ symbol: "AAPL", side: "buy", quantity: 10, price: 100, externalId: "ext-1" });
ok(dup === null, "duplicate external_id ignored — statement re-import is idempotent");
await fin.recordTrade({ symbol: "AAPL", side: "sell", quantity: 10, price: 130 });
const trades = await fin.listTrades({ symbol: "AAPL" });
ok(trades.length === 2, `two AAPL trades recorded (got ${trades.length})`);
const { closed: rt } = fin.fifoRealised(trades);
ok(rt.length === 1 && Math.abs(rt[0].pnl - 300) < 1e-6, `realised +300 from stored trades (got ${rt[0]?.pnl})`);

console.log("\n— journal + watchlist —");
const j = await fin.addJournalEntry({ symbol: "AAPL", thesis: "earnings beat", planStop: 95 });
ok(j && j.id, "journal entry saved");
ok((await fin.listJournal({ symbol: "AAPL" })).length === 1, "journal reads back");
const jc = await fin.closeJournalEntry(j.id, { outcome: "hit target", lesson: "size up next time" });
ok(jc.outcome === "hit target", "journal entry closes with outcome");
await fin.addToWatchlist({ symbol: "tsla", alertBelow: 200, note: "wait for a dip" });
const wl = await fin.listWatchlist();
ok(wl.length === 1 && wl[0].symbol === "TSLA" && Number(wl[0].alert_below) === 200, "watchlist add with alert level");
await fin.addToWatchlist({ symbol: "TSLA", alertBelow: 180 });
ok(Number((await fin.listWatchlist())[0].alert_below) === 180, "re-adding updates the level rather than duplicating");
ok(await fin.removeFromWatchlist("TSLA"), "watchlist remove");

console.log("\n— discipline —");
const disc = await fin.tradingDiscipline({ days: 3650 });
ok(disc.enoughData === true, "discipline runs against stored trades");
ok(typeof disc.winRate === "number", `win rate computed (${disc.winRate})`);

console.log(`\n${failures === 0 ? "ALL INTEGRATION CHECKS PASSED" : `*** ${failures} CHECK(S) FAILED ***`}`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
