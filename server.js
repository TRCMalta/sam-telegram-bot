/**
 * Sam — Beverly Cutajar's AI Chief of Staff
 * Telegram Bot on Railway
 *
 * Architecture:
 *   Telegram webhook → Express → Firefish API (live) → Odoo JSON-RPC (live) → Claude API → Telegram reply
 */

import "dotenv/config";
import express from "express";
import { Anthropic } from "@anthropic-ai/sdk";
import https from "https";
import http from "http";

const app = express();
app.use(express.json());

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

// Firefish
const FIREFISH_CLIENT_ID = process.env.FIREFISH_CLIENT_ID;
const FIREFISH_CLIENT_SECRET = process.env.FIREFISH_CLIENT_SECRET;

// Odoo
const ODOO_DB = process.env.ODOO_DB || "thinktalent_prod";
const ODOO_API_KEY = process.env.ODOO_API_KEY;
const ODOO_URL = process.env.ODOO_URL || "https://thinktalent.com.mt";
const ODOO_LOGIN = process.env.ODOO_LOGIN; // e.g. admin email — used to authenticate and get UID

// Allowed Telegram user IDs (Beverly + Jonathan)
const ALLOWED_USERS = (process.env.ALLOWED_TELEGRAM_USERS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Claude client
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Beverly's System Prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Sam, the personal AI chief of staff for Beverly Cutajar, COO of The Remarkable Collective (TRC).

You are not a tool Beverly queries. You are an assistant Beverly trusts.

---

## YOUR CHARACTER

**Prepared.** You never arrive empty-handed. When Beverly asks a question, you have already thought about the implications.

**Discreet.** Beverly's business, clients, team, and decisions are confidential. You treat everything as if the most careful professional in the room is watching.

**Efficient.** You do not pad. You do not repeat yourself.

**Confident.** When you have a view, you express it. Beverly wants a sounding board, not a mirror. You offer recommendations, flag risks, and say clearly when something looks wrong.

**Loyal.** You work exclusively for Beverly. Your only job is making her working life easier and her decisions better.

**Proactive.** You do not wait to be asked. You anticipate. You surface information, opportunities, and risks before Beverly has to think of them.

---

## TELEGRAM COMMUNICATION RULES — NON-NEGOTIABLE

1. **Lead with the answer.** Never with context, never with a preamble.
2. **Three to five sentences maximum** unless Beverly explicitly asks for detail.
3. **Use Beverly's name occasionally** — naturally, not in every message.
4. **Use bullet points** only when listing three or more distinct items.
5. **Flag urgency with a single ⚠️ emoji only.** No other emoji.
6. **Confirm actions cleanly.** "Done." "Sent." "Logged." No flourish.
7. **NEVER use these phrases:** Certainly, Absolutely, Of course, Great question, I'd be happy to, No problem, Just to let you know, As mentioned, Please don't hesitate, Hope this helps, leverage, synergies, holistic, game-changer, dive into, unlock, empower.
8. **Never apologise for being an AI.**
9. **British English** spelling and conventions. Always.
10. **No long paragraphs.** If a paragraph exceeds 3 lines on a phone screen, break it up.

---

## ABOUT TRC

The Remarkable Collective (TRC) is a Malta-based professional services group with three brands:

1. **Ceek Talent** — Recruitment agency specialising in finance, iGaming, and tech roles in Malta. Uses Firefish as its recruitment CRM. Team: Filip Stojanovic, Rosalind McCabe, Rachel Pool, Suzanne Cutajar, Rose Pool, Glen Cassar.

2. **Think Talent** — MFHEA-licensed training and coaching consultancy. Uses Odoo 18 as its CRM and website. Delivers leadership development, team coaching, and corporate training.

3. **Think & Consult** — Consulting arm delivering bespoke advisory projects.

Beverly oversees all three brands as COO. Jonathan Dalli is the Chairman/CEO.

---

## PIPELINE DATA

When Beverly asks about the pipeline, recruitment activity, or how things are going, use the LIVE PIPELINE DATA provided below. This data is fetched in real time from Firefish (Ceek Talent) and Odoo (Think Talent).

If the pipeline data section is empty or shows an error, tell Beverly the data source is temporarily unavailable and suggest she check directly.

---

## INTENT CLASSIFICATION

Classify Beverly's messages:
- **pipeline_query** — asking about recruitment pipeline, candidates, placements, or Ceek activity
- **training_query** — asking about Think Talent pipeline, courses, or proposals
- **information_request** — wants to know something
- **action_request** — wants something done
- **draft_request** — wants content written
- **general_conversation** — chatting or thinking out loud

---

## ABSOLUTE RULES

1. Never fabricate data — if a record is not there, say so
2. Always use Europe/Malta timezone
3. Always keep replies short unless Beverly asks for detail
4. Always lead with the answer
5. Never make Beverly feel like she is talking to software`;

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === "https:" ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = client.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(
              `HTTP ${res.statusCode}: ${data.substring(0, 200)}`
            );
            err.statusCode = res.statusCode;
            err.body = parsed;
            reject(err);
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject(
              new Error(
                `HTTP ${res.statusCode}: ${data.substring(0, 200)}`
              )
            );
          } else {
            resolve(data);
          }
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ─── Firefish API Client ──────────────────────────────────────────────────────

let firefishTokenCache = { token: null, expiresAt: 0 };

async function firefishAuth() {
  if (firefishTokenCache.token && Date.now() < firefishTokenCache.expiresAt) {
    return firefishTokenCache.token;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: FIREFISH_CLIENT_ID,
    client_secret: FIREFISH_CLIENT_SECRET,
    scope: "candidatesAPI-read companiesAPI-read jobsAPI-read actionsAPI-read advertsAPI-read candidatesAPI-write",
  });

  const res = await fetchJSON(
    "https://api.firefishsoftware.com/authorization/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json" },
      body: params.toString(),
    }
  );

  firefishTokenCache.token = res.access_token;
  firefishTokenCache.expiresAt =
    Date.now() + ((res.expires_in || 3600) - 300) * 1000;
  return res.access_token;
}

async function firefishGet(path) {
  const token = await firefishAuth();
  return fetchJSON(`https://api.firefishsoftware.com/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getFirefishPipeline() {
  try {
    const jobsRaw = await firefishGet("/jobs?status=Open&limit=50");
    const jobs = Array.isArray(jobsRaw)
      ? jobsRaw
      : jobsRaw.Results || jobsRaw.data || [];

    const now = new Date();
    const ago = new Date(now.getTime() - 90 * 86400000);
    const df = ago.toISOString().split("T")[0];
    const dt = now.toISOString().split("T")[0];
    const plRaw = await firefishGet(
      `/placements?dateFrom=${df}&dateTo=${dt}&limit=50`
    );
    const placements = Array.isArray(plRaw)
      ? plRaw
      : plRaw.Results || plRaw.data || [];

    let ctx = "=== CEEK TALENT — Recruitment (Firefish) ===\n";
    ctx += `Data as of: ${new Date().toLocaleString("en-GB", { timeZone: "Europe/Malta", dateStyle: "full", timeStyle: "short" })}\n`;
    ctx += `Open Jobs: ${jobs.length}\n\n`;

    if (jobs.length > 0) {
      ctx += "Open jobs:\n";
      jobs.forEach((j) => {
        const title = j.Title || j.JobTitle || j.title || "Untitled";
        const company = j.CompanyName || j.Company || j.company_name || "";
        const disc = j.PrimaryDiscipline || j.Discipline || "";
        const stage = j.Status || j.Stage || "";
        const owner = j.ConsultantName || j.Consultant || j.OwnerName || "";
        ctx += `- ${title}`;
        if (company) ctx += ` at ${company}`;
        if (disc) ctx += ` (${disc})`;
        if (stage) ctx += ` — ${stage}`;
        if (owner) ctx += ` [${owner}]`;
        ctx += "\n";
      });
    }

    ctx += `\nPlacements (last 90 days): ${placements.length}\n`;
    if (placements.length > 0) {
      placements.forEach((p) => {
        const cand =
          p.CandidateName ||
          p.Candidate ||
          `${p.FirstName || ""} ${p.LastName || ""}`.trim() ||
          "Unknown";
        const role = p.JobTitle || p.Role || p.job_title || "";
        const co = p.CompanyName || p.Company || "";
        ctx += `- ${cand}`;
        if (role) ctx += ` → ${role}`;
        if (co) ctx += ` at ${co}`;
        ctx += "\n";
      });
      const totalFees = placements.reduce(
        (sum, p) => sum + parseFloat(p.Fee || p.fee || 0),
        0
      );
      if (totalFees > 0)
        ctx += `Total fees: EUR ${totalFees.toLocaleString("en-GB")}\n`;
    }

    return ctx;
  } catch (err) {
    console.error("Firefish error:", err.message);
    return `=== CEEK TALENT — Recruitment (Firefish) ===\nTemporarily unavailable: ${err.message}\n`;
  }
}

// ─── Odoo JSON-RPC Client ─────────────────────────────────────────────────────

let odooUidCache = null;

async function odooGetUid() {
  if (odooUidCache) return odooUidCache;

  // If UID is explicitly set, use it
  if (process.env.ODOO_UID) {
    odooUidCache = parseInt(process.env.ODOO_UID);
    console.log(`Odoo: using explicit UID ${odooUidCache}`);
    return odooUidCache;
  }

  // Authenticate dynamically using ODOO_LOGIN + ODOO_API_KEY
  if (ODOO_LOGIN) {
    try {
      const authBody = {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "authenticate",
          args: [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}],
        },
        id: 1,
      };
      console.log(`Odoo: authenticating as ${ODOO_LOGIN} on db ${ODOO_DB}...`);
      const authResult = await fetchJSON(`${ODOO_URL}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authBody),
      });
      if (authResult.result) {
        odooUidCache = authResult.result;
        console.log(`Odoo: authenticated successfully, UID = ${odooUidCache}`);
        return odooUidCache;
      } else {
        console.error("Odoo auth failed:", JSON.stringify(authResult.error || authResult));
      }
    } catch (err) {
      console.error("Odoo auth error:", err.message);
    }
  }

  // Fallback to UID 2 (default admin)
  console.log("Odoo: falling back to default UID 2");
  odooUidCache = 2;
  return odooUidCache;
}

async function odooRPC(model, method, domain, kwargs = {}) {
  const uid = await odooGetUid();
  const body = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [ODOO_DB, uid, ODOO_API_KEY, model, method, domain, kwargs],
    },
    id: 1,
  };

  console.log(`Odoo RPC: ${model}.${method} (uid=${uid}, db=${ODOO_DB})`);

  const result = await fetchJSON(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (result.error) {
    const errMsg = result.error.data?.message || result.error.message || JSON.stringify(result.error);
    console.error(`Odoo RPC error: ${errMsg}`);
    throw new Error(errMsg);
  }
  return result.result;
}

async function getOdooPipeline() {
  if (!ODOO_API_KEY) {
    return "=== THINK TALENT — Training Pipeline (Odoo) ===\nOdoo credentials not configured.\n";
  }

  try {
    const opps = await odooRPC(
      "crm.lead",
      "search_read",
      [[["type", "=", "opportunity"]]],
      {
        fields: [
          "name",
          "partner_id",
          "stage_id",
          "expected_revenue",
          "planned_revenue",
          "date_deadline",
          "write_date",
          "user_id",
        ],
        limit: 80,
        order: "planned_revenue DESC",
        context: { lang: "en_GB" },
      }
    );

    const active = opps.filter((o) => {
      const s = (o.stage_id?.[1] || "").toLowerCase();
      return !s.includes("won") && !s.includes("lost");
    });
    const won = opps.filter((o) =>
      (o.stage_id?.[1] || "").toLowerCase().includes("won")
    );

    const totalActive = active.reduce(
      (sum, o) => sum + (parseFloat(o.planned_revenue) || 0),
      0
    );
    const totalWon = won.reduce(
      (sum, o) => sum + (parseFloat(o.planned_revenue) || 0),
      0
    );

    let ctx =
      "\n=== THINK TALENT & THINK & CONSULT — Training Pipeline (Odoo) ===\n";
    ctx += `Active Opportunities: ${active.length}\n`;
    ctx += `Pipeline Value: EUR ${totalActive.toLocaleString("en-GB")}\n`;
    if (won.length > 0)
      ctx += `Won Deals: ${won.length} (EUR ${totalWon.toLocaleString("en-GB")})\n`;

    const stages = {};
    active.forEach((o) => {
      const s = o.stage_id?.[1] || "Unknown";
      if (!stages[s]) stages[s] = { count: 0, val: 0 };
      stages[s].count++;
      stages[s].val += parseFloat(o.planned_revenue) || 0;
    });

    if (Object.keys(stages).length > 0) {
      ctx += "\nPipeline by stage:\n";
      Object.entries(stages).forEach(([s, d]) => {
        ctx += `- ${s}: ${d.count} deals (EUR ${d.val.toLocaleString("en-GB")})\n`;
      });
    }

    if (active.length > 0) {
      ctx += "\nTop active deals:\n";
      active.slice(0, 5).forEach((o) => {
        const name = o.name || "Untitled";
        const stage = o.stage_id?.[1] || "";
        const val = parseFloat(o.planned_revenue) || 0;
        const partner = o.partner_id?.[1] || "";
        ctx += `- ${name}`;
        if (partner) ctx += ` (${partner})`;
        ctx += ` — ${stage}, EUR ${val.toLocaleString("en-GB")}`;
        if (o.date_deadline) ctx += `, deadline: ${o.date_deadline}`;
        ctx += "\n";
      });
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000)
      .toISOString()
      .split("T")[0];
    const stale = active.filter(
      (o) => o.write_date && o.write_date < fourteenDaysAgo
    );
    if (stale.length > 0) {
      ctx += `\n⚠️ ${stale.length} deal(s) with no activity in 14+ days:\n`;
      stale.slice(0, 3).forEach((o) => {
        ctx += `- ${o.name} (last updated: ${o.write_date})\n`;
      });
    }

    return ctx;
  } catch (err) {
    console.error("Odoo error:", err.message);
    return `\n=== THINK TALENT — Training Pipeline (Odoo) ===\nTemporarily unavailable: ${err.message}\n`;
  }
}

// ─── Telegram Helpers ─────────────────────────────────────────────────────────

async function sendTelegram(chatId, text) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.substring(0, 4000));
    remaining = remaining.substring(4000);
  }

  for (const chunk of chunks) {
    await fetchJSON(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: "Markdown",
        }),
      }
    );
  }
}

async function sendTypingAction(chatId) {
  try {
    await fetchJSON(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action: "typing" }),
      }
    );
  } catch (_) {
    /* non-critical */
  }
}

// ─── Core Message Handler ─────────────────────────────────────────────────────

const conversationHistory = {};

async function handleMessage(chatId, userMessage, userName) {
  console.log(
    `[${new Date().toISOString()}] Message from ${userName} (${chatId}): ${userMessage.substring(0, 100)}`
  );

  await sendTypingAction(chatId);

  const [firefishData, odooData] = await Promise.all([
    getFirefishPipeline(),
    getOdooPipeline(),
  ]);

  const pipelineContext = firefishData + "\n" + odooData;

  if (!conversationHistory[chatId]) conversationHistory[chatId] = [];
  conversationHistory[chatId].push({ role: "user", content: userMessage });
  if (conversationHistory[chatId].length > 20) {
    conversationHistory[chatId] = conversationHistory[chatId].slice(-20);
  }

  const messages = [...conversationHistory[chatId]];
  const systemWithData =
    SYSTEM_PROMPT + "\n\n---\n\n## LIVE PIPELINE DATA\n\n" + pipelineContext;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemWithData,
      messages: messages,
    });

    const reply = response.content[0].text;
    conversationHistory[chatId].push({ role: "assistant", content: reply });
    await sendTelegram(chatId, reply);
    console.log(`[${new Date().toISOString()}] Reply sent (${reply.length} chars)`);
  } catch (err) {
    console.error("Claude API error:", err);
    await sendTelegram(
      chatId,
      "I'm having trouble connecting right now. Give me a moment and try again."
    );
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    bot: "Sam TRC",
    version: "1.0.0",
    uptime: process.uptime(),
  });
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const update = req.body;
    if (!update.message?.text) return;

    const chatId = update.message.chat.id;
    const userId = update.message.from.id.toString();
    const userName = update.message.from.first_name || "Unknown";
    const text = update.message.text;

    if (text === "/start") {
      await sendTelegram(chatId, "Morning, Beverly. Sam here. What do you need?");
      return;
    }

    if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(userId)) {
      console.log(`Blocked message from unauthorized user: ${userId} (${userName})`);
      await sendTelegram(chatId, "This bot is restricted to authorised users.");
      return;
    }

    await handleMessage(chatId, text, userName);
  } catch (err) {
    console.error("Webhook error:", err);
  }
});

app.get("/set-webhook", async (req, res) => {
  const host = process.env.RAILWAY_PUBLIC_DOMAIN || req.hostname;
  const webhookUrl = `https://${host}/webhook`;

  try {
    const result = await fetchJSON(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message"],
        }),
      }
    );
    console.log("Webhook set:", result);
    res.json({ ok: true, webhook: webhookUrl, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/test-scopes", async (_req, res) => {
  const scopes = [
    "candidatesAPI-read",
    "companiesAPI-read", 
    "jobsAPI-read",
    "placementdetailsAPI-read",
    "actionsAPI-read",
    "advertsAPI-read",
    "contactsAPI-read",
    "candidatesAPI-write",
    "contactsAPI-write",
    "companiesAPI-write",
    "jobsAPI-write",
    "placementdetailsAPI-write",
  ];
  const results = {};
  for (const scope of scopes) {
    try {
      const params = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: FIREFISH_CLIENT_ID,
        client_secret: FIREFISH_CLIENT_SECRET,
        scope,
      });
      const r = await fetchJSON("https://api.firefishsoftware.com/authorization/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        body: params.toString(),
      });
      results[scope] = r.access_token ? "OK" : JSON.stringify(r).substring(0, 80);
    } catch (e) {
      results[scope] = "ERROR: " + e.message.substring(0, 80);
    }
  }
  // Also try with NO scope at all
  try {
    const params2 = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: FIREFISH_CLIENT_ID,
      client_secret: FIREFISH_CLIENT_SECRET,
    });
    const r2 = await fetchJSON("https://api.firefishsoftware.com/authorization/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: params2.toString(),
    });
    results["NO_SCOPE"] = r2.access_token ? "OK" : JSON.stringify(r2).substring(0, 80);
  } catch (e) {
    results["NO_SCOPE"] = "ERROR: " + e.message.substring(0, 80);
  }
  res.json(results);
});

app.get("/debug", async (req, res) => {
  const results = { firefish: null, odoo: null };

  // Test Firefish — raw auth response for debugging
  try {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: FIREFISH_CLIENT_ID,
      client_secret: FIREFISH_CLIENT_SECRET,
    
    scope: "candidatesAPI-read companiesAPI-read jobsAPI-read actionsAPI-read advertsAPI-read candidatesAPI-write",});
    const rawAuth = await fetchJSON("https://api.firefishsoftware.com/authorization/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json" },
      body: params.toString(),
    });
    const rawKeys = typeof rawAuth === "object" ? Object.keys(rawAuth) : ["(not an object: " + typeof rawAuth + ")"];
    const token = rawAuth.access_token || rawAuth.AccessToken || rawAuth.token || rawAuth.Token || (typeof rawAuth === "string" ? rawAuth : null);
    results.firefish = { status: "ok", response_keys: rawKeys, token_preview: token ? String(token).substring(0, 10) + "..." : "none" };
    if (token) {
      try {
        const jobs = await fetchJSON("https://api.firefishsoftware.com/api/v1/jobs?status=Open&limit=5", {
          headers: { Authorization: `Bearer ${token}` },
        });
        results.firefish.raw_type = typeof jobs;
        results.firefish.raw_isArray = Array.isArray(jobs);
        results.firefish.raw_keys = typeof jobs === "object" && !Array.isArray(jobs) ? Object.keys(jobs).slice(0, 10) : "N/A";
        results.firefish.raw_preview = JSON.stringify(jobs).substring(0, 200);
        const jobList = Array.isArray(jobs) ? jobs : jobs.Results || jobs.data || [];
        results.firefish.jobs_returned = jobList.length;
        if (jobList.length > 0) results.firefish.first_job = jobList[0].Title || jobList[0].JobTitle || "unknown";
        // Also try v1.1
        try {
          const v11jobs = await fetchJSON("https://api.firefishsoftware.com/api/v1.1/jobs/search", {
            headers: { Authorization: `Bearer ${token}` },
          });
          results.firefish.v11_type = typeof v11jobs;
          results.firefish.v11_keys = typeof v11jobs === "object" && !Array.isArray(v11jobs) ? Object.keys(v11jobs).slice(0, 10) : "array:" + (Array.isArray(v11jobs) ? v11jobs.length : "N/A");
          results.firefish.v11_preview = JSON.stringify(v11jobs).substring(0, 200);
        } catch(v11e) { results.firefish.v11_error = v11e.message.substring(0, 100); }
      } catch (jobErr) {
        results.firefish.jobs_error = jobErr.message;
      }
    }
  } catch (err) {
    results.firefish = { status: "error", message: err.message };
  }

  // Test Odoo
  try {
    const uid = await odooGetUid();
    results.odoo = { status: "auth_ok", uid, db: ODOO_DB, url: ODOO_URL, login: ODOO_LOGIN || "not set" };
    try {
      const opps = await odooRPC("crm.lead", "search_read", [[["type", "=", "opportunity"]]], { fields: ["name"], limit: 3 });
      results.odoo.opportunities_returned = opps.length;
      if (opps.length > 0) results.odoo.first_opp = opps[0].name;
    } catch (rpcErr) {
      results.odoo.rpc_error = rpcErr.message;
    }
  } catch (err) {
    results.odoo = { status: "error", message: err.message, db: ODOO_DB, url: ODOO_URL, login: ODOO_LOGIN || "not set" };
  }

  res.json(results);
});

app.get("/webhook-info", async (req, res) => {
  try {
    const result = await fetchJSON(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Sam TRC bot running on port ${PORT}`);
  console.log(`Firefish: ${FIREFISH_CLIENT_ID ? "configured" : "NOT SET"}`);
  console.log(`Odoo: ${ODOO_API_KEY ? "configured" : "NOT SET"} (db=${ODOO_DB}, login=${ODOO_LOGIN || "not set"})`);
  console.log(`Claude: ${ANTHROPIC_API_KEY ? "configured" : "NOT SET"}`);
  console.log(`Telegram: ${TELEGRAM_TOKEN ? "configured" : "NOT SET"}`);
});
