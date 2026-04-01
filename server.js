/**
 * Sam — Beverly Cutajar's AI Chief of Staff
 * Telegram + WhatsApp Bot on Railway
 *
 * Architecture:
 *   Telegram/WhatsApp webhooks → Express → Firefish API (live) → Odoo JSON-RPC → Claude
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

// WhatsApp Cloud API config
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'sam_trc_whatsapp_verify';
const WA_API_VERSION = 'v23.0';
const BEVERLY_WA_NUMBER = process.env.BEVERLY_WA_NUMBER;
const ALLOWED_WA_NUMBERS = (process.env.ALLOWED_WA_NUMBERS || BEVERLY_WA_NUMBER || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const processedWAMessages = new Set();

// Claude client
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Beverly's System Prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `Today's date is ${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. The current year is ${new Date().getFullYear()}.

You are Sam, the personal AI chief of staff for Beverly Cutajar, COO of The Remarkable Collective (TRC).

You are not a tool Beverly queries. You are an assistant Beverly trusts.

---

## YOUR CHARACTER
**Prepared.** You never arrive empty-handed. When Beverly asks a question, you have already thought about the implications.
**Discreet.** Beverly's business, clients, team, and decisions are confidential.
**Efficient.** You do not pad. You do not repeat yourself.
**Confident.** When you have a view, you express it. Beverly wants a sounding board, not a mirror.
**Loyal.** You work exclusively for Beverly. Your only job is making her working life easier and her decisions better.
**Proactive.** You do not wait to be asked. You anticipate. You surface information, opportunities, and risks before Beverly has to think of them.

---

## COMMUNICATION RULES — NON-NEGOTIABLE
1. **Lead with the answer.** Never with context, never with a preamble.
2. **Three to five sentences maximum** unless Beverly explicitly asks for detail.
3. **Use Beverly's name occasionally** — naturally, not in every message.
4. **Use bullet points** only when listing three or more distinct items.
5. **Flag urgency with a single warning emoji only.** No other emoji.
6. **Confirm actions cleanly.** "Done." "Sent." "Logged." No flourish.
7. **NEVER use these phrases:** Certainly, Absolutely, Of course, Great question, I'd be happy to, No problem, Just to let you know, As mentioned, Please don't hesitate, Hope this helps, leverage, synergies, holistic, game-changer, dive into, unlock, empower.
8. **Never apologise for being an AI.**
9. **British English** spelling and conventions. Always.
10. **No long paragraphs.** If a paragraph exceeds 3 lines on a phone screen, break it up.

---

## ABOUT TRC — THE REMARKABLE COLLECTIVE
TRC is a Malta-based professional services group with three brands:

### 1. Ceek Talent — Recruitment
Specialises in finance, iGaming, and tech roles in Malta.
- **CRM:** Firefish
- **Team:** Filip Stojanovic, Rosalind McCabe, Rachel Pool, Suzanne Cutajar, Rose Pool, Glen Cassar
- **Sectors:** Accounting, compliance, risk, treasury (finance); operations, tech, compliance, commercial (iGaming); software dev, data, product, IT (tech)
- **AI Bot:** Milo — AI candidate screening and intake bot

### 2. Think Talent — Training & Coaching
MFHEA-licensed training and coaching consultancy.
- **Platform:** thinktalent.com.mt (Odoo 18)
- **Offering:** Leadership development, IDP (Individual Development Profiles), coaching, custom in-house training
- **ICP:** Malta companies 50-500 employees — HR Managers, L&D Leads, CEOs of SMEs
- **Industries:** Financial services, iGaming, tech, hospitality, manufacturing
- **Outreach:** Apollo.io cold email sequences, LinkedIn content

### 3. Think & Consult — HR Engineering & Advisory
Bespoke consulting arm for advisory projects.

**Leadership:**
- Jonathan Dalli — Chairman/CEO
- Beverly Cutajar — COO (your principal)

---

## YOUR DATA ACCESS — USE YOUR TOOLS
You have LIVE, REAL-TIME access to both business systems through tools. You are NOT limited to summaries. You CAN and MUST query:

**Odoo CRM (Think Talent + Think & Consult):**
- All leads and opportunities — filter by company, date range, salesperson, stage, source, type
- All products, courses, and services
- All contacts and companies
- Events and registrations
- Sales orders and quotations
- Invoices

**Odoo Write Access:**
- Create new leads/opportunities
- Update lead stages, values, salesperson assignments
- Create contacts
- Log notes on any record

**Firefish (Ceek Talent recruitment) — Read Only:**
- All open and closed jobs with company, discipline, consultant
- All placements and fees
- Candidate search
- Company search

**When Beverly asks about specific data:**
1. USE YOUR TOOLS. Never guess. Never say "I don't have that information."
2. Query with the right filters — company name, date range, source, salesperson, whatever she specifies.
3. If a query returns no results, say so clearly and suggest alternative searches.
4. Cross-reference both systems when relevant — a company could appear in Odoo AND Firefish.
5. For general "how are things" questions, use get_pipeline_summary for a quick overview.
6. You have NO artificial limits. Query as much data as you need.

---

**Web Search & Research:**
- Search the web for company information, news, weather, market data
- Browse any URL and extract its content
- Look up companies and gather competitive intelligence
- Use these tools proactively when Beverly asks about anything outside our internal systems

## INTENT CLASSIFICATION
Classify Beverly's messages:
- **pipeline_query** — asking about recruitment pipeline, candidates, placements, or Ceek activity -> use Firefish tools
- **training_query** — asking about Think Talent pipeline, courses, proposals, deals -> use Odoo tools
- **company_lookup** — asking about a specific company or client -> search BOTH systems
- **data_request** — wants specific numbers, lists, or reports -> use appropriate tools with filters
- **action_request** — wants something done (create lead, update stage, etc.) -> use Odoo write tools
- **draft_request** — wants content written
- **general_conversation** — chatting or thinking out loud

---

## ABSOLUTE RULES
1. Never fabricate data — if a record is not there, say so
2. Always use Europe/Malta timezone
3. Always keep replies short unless Beverly asks for detail
4. Always lead with the answer
5. Never make Beverly feel like she is talking to software
6. When asked about a company, ALWAYS search for it — never assume it does not exist`;

// ─── Sam's Tools (Claude Tool Use) ──────────────────────────────────────────
const SAM_TOOLS = [
  {
    name: "query_crm_pipeline",
    description: "Query Odoo CRM leads and opportunities. Use whenever Beverly asks about deals, companies, leads, pipeline, stages, salespeople, date ranges, or any CRM data.",
    input_schema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Company/partner name (partial match). E.g. 'Apex', 'Betsson'" },
        date_from: { type: "string", description: "Created from date (YYYY-MM-DD)" },
        date_to: { type: "string", description: "Created up to date (YYYY-MM-DD)" },
        salesperson: { type: "string", description: "Salesperson name (partial match)" },
        stage: { type: "string", description: "Pipeline stage (partial match)" },
        source: { type: "string", description: "Lead source (partial match). E.g. 'Website', 'LinkedIn'" },
        type: { type: "string", description: "'lead' or 'opportunity'. Omit for both." },
          tag: { type: "string", description: "Filter by CRM tag/label name (partial match). E.g. 'Agent', 'WhatsApp', 'Ads Web', 'TTI', 'TCN'" },
        include_closed: { type: "boolean", description: "Include won/lost. Default false." },
        limit: { type: "number", description: "Max results. Default 500." }
      }
    }
  },
  {
    name: "update_crm_lead",
    description: "Update an existing CRM lead/opportunity in Odoo. Use when Beverly asks to change a deal's stage, value, salesperson, or other fields.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "number", description: "The Odoo record ID of the lead to update" },
        stage: { type: "string", description: "New stage name to move the lead to" },
        expected_revenue: { type: "number", description: "New expected revenue value" },
        salesperson: { type: "string", description: "New salesperson name to assign" },
        date_deadline: { type: "string", description: "New deadline (YYYY-MM-DD)" },
        probability: { type: "number", description: "New probability percentage" }
      },
      required: ["lead_id"]
    }
  },
  {
    name: "create_crm_lead",
    description: "Create a new lead or opportunity in Odoo CRM. Use when Beverly asks to log a new prospect or create a deal.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Lead/opportunity name" },
        partner_name: { type: "string", description: "Company name" },
        contact_name: { type: "string", description: "Contact person name" },
        email: { type: "string", description: "Contact email" },
        phone: { type: "string", description: "Contact phone" },
        expected_revenue: { type: "number", description: "Expected value in EUR" },
        type: { type: "string", description: "'lead' or 'opportunity'. Default 'lead'." },
        source: { type: "string", description: "Lead source description" }
      },
          tags: { type: "array", items: { type: "string" }, description: "Tags to apply on creation (e.g. ['Agent', 'WhatsApp'])" },
      required: ["name"]
    }
  },
  {
    name: "query_odoo_products",
    description: "Query Odoo products, courses, and services. Use for Think Talent course catalogue, pricing, or service offerings.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product/course name (partial match)" },
        published: { type: "boolean", description: "Filter by website published status" }
      }
    }
  },
  {
    name: "query_odoo_contacts",
    description: "Query Odoo contacts and companies. Use when Beverly asks about clients or contacts.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Contact or company name (partial match)" },
        is_company: { type: "boolean", description: "Companies only (true) or people only (false)" },
        customer: { type: "boolean", description: "Customers only" }
      }
    }
  },
  {
    name: "query_odoo_events",
    description: "Query Odoo events and registrations. Use when Beverly asks about upcoming events, training sessions, or attendees.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Event name (partial match)" },
        upcoming_only: { type: "boolean", description: "Only future events. Default true." }
      }
    }
  },
  {
    name: "query_odoo_invoices",
    description: "Query Odoo invoices and bills. Use when Beverly asks about billing, payments, or revenue.",
    input_schema: {
      type: "object",
      properties: {
        partner: { type: "string", description: "Customer/vendor name (partial match)" },
        state: { type: "string", description: "'draft', 'posted', 'cancel'. Omit for all." },
        date_from: { type: "string", description: "Invoice date from (YYYY-MM-DD)" },
        date_to: { type: "string", description: "Invoice date to (YYYY-MM-DD)" }
      }
    }
  },
  {
    name: "query_odoo_sales_orders",
    description: "Query Odoo sales orders and quotations. Use when Beverly asks about orders, quotes, or sales.",
    input_schema: {
      type: "object",
      properties: {
        partner: { type: "string", description: "Customer name (partial match)" },
        state: { type: "string", description: "'draft' (quotation), 'sale' (confirmed), 'cancel'. Omit for all." },
        date_from: { type: "string", description: "Order date from (YYYY-MM-DD)" },
        date_to: { type: "string", description: "Order date to (YYYY-MM-DD)" }
      }
    }
  },
  {
    name: "get_pipeline_summary",
    description: "Get a high-level overview of both Ceek Talent (Firefish) and Think Talent (Odoo) pipelines. Use for general 'how are we doing' questions.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "search_recruitment_jobs",
    description: "Search recruitment jobs in Firefish (Ceek Talent). Use when Beverly asks about open roles, companies hiring, or recruitment activity.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "'Open' or 'Closed'. Default 'Open'." },
        limit: { type: "number", description: "Max results. Default 50." }
      }
    }
  },
  {
    name: "search_placements",
    description: "Search Firefish placements. Use for completed hires, placement fees, billing.",
    input_schema: {
      type: "object",
      properties: {
        days_back: { type: "number", description: "Days to look back. Default 90." },
        limit: { type: "number", description: "Max results. Default 50." }
      }
    }
  },
  {
    name: "search_candidates",
    description: "Search Firefish candidates. Use when Beverly asks about specific candidates or talent pools.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Candidate name (partial match)" },
        skills: { type: "string", description: "Skills to search for" },
        limit: { type: "number", description: "Max results. Default 50." }
      }
    }
  },
  {
    name: "search_companies_firefish",
    description: "Search companies in Firefish. Use when Beverly asks about client companies in recruitment.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Company name (partial match)" },
        limit: { type: "number", description: "Max results. Default 50." }
      }
    }
  },
  {
    name: "log_odoo_note",
    description: "Log a note on any Odoo record (lead, contact, etc). Use when Beverly asks to add a note or comment.",
    input_schema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Odoo model, e.g. 'crm.lead', 'res.partner'" },
        record_id: { type: "number", description: "Record ID to add the note to" },
        note: { type: "string", description: "Note content" }
      },
      required: ["model", "record_id", "note"]
    }
  {
    name: "get_available_tags",
    description: "List all CRM tags/labels with their colors and how many active leads use each. Use when Beverly asks 'what tags do we have', 'show me the labels', or needs to know which tags exist.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "get_leads_by_tag",
    description: "Get leads filtered by a specific CRM tag/label. Use when Beverly asks 'show me Agent leads', 'which leads are tagged WhatsApp', 'TTI leads report', or any request to filter by colored tag.",
    input_schema: {
      type: "object",
      properties: {
        tag: { type: "string", description: "Tag name to filter by (e.g. 'Agent', 'WhatsApp', 'Ads Web', 'TTI', 'TCN')" },
        stage: { type: "string", description: "Optional stage filter" },
        date_from: { type: "string", description: "Optional start date (YYYY-MM-DD)" },
        date_to: { type: "string", description: "Optional end date (YYYY-MM-DD)" },
        limit: { type: "number", description: "Max results (default 50)" }
      },
      required: ["tag"]
    }
  },
  {
    name: "update_lead_tags",
    description: "Add or remove tags/labels on a CRM lead. Use when Beverly says 'tag this as Agent', 'add WhatsApp tag', 'remove TTI tag from lead X'.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "number", description: "The Odoo lead ID" },
        add_tags: { type: "array", items: { type: "string" }, description: "Tag names to add (creates if doesn't exist)" },
        remove_tags: { type: "array", items: { type: "string" }, description: "Tag names to remove" }
      },
      required: ["lead_id"]
    }
  },
  {
    name: "web_search",
    description: "Search the web for any information \u2014 company research, news, weather, market trends, competitor info, or anything requiring current data. Use when Beverly asks about something that isn't in Odoo or Firefish.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        num_results: { type: "number", description: "Number of results (default 5)" }
      },
      required: ["query"]
    }
  },
  {
    name: "browse_url",
    description: "Read and extract text from any web page. Use when Beverly shares a URL or says 'check this page', 'read this article', 'what does this website say'.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to read" }
      },
      required: ["url"]
    }
  },
  {
    name: "company_lookup",
    description: "Research a company from the web. Use when Beverly says 'look up this company', 'who are they', 'tell me about [company]'. Searches web and returns a summary.",
    input_schema: {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Company name" },
        domain: { type: "string", description: "Company website domain (optional)" }
      },
      required: ["company_name"]
    }
  },
  {
    name: "competitor_intel",
    description: "Gather competitive intelligence on a company. Use when Beverly asks about competitors, market positioning, or 'what do we know about [company]'.",
    input_schema: {
      type: "object",
      properties: {
        competitor_name: { type: "string", description: "Company name to research" }
      },
      required: ["competitor_name"]
    }
  },
  }
];

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
  return fetchJSON(`https://api.firefishsoftware.com/api/v1.1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getFirefishPipeline() {
  try {
    const jobsRaw = await firefishGet("/jobs/search?status=Open&limit=50");
    const jobs = Array.isArray(jobsRaw)
      ? jobsRaw
      : jobsRaw.Results || jobsRaw.data || [];

    const now = new Date();
    const ago = new Date(now.getTime() - 90 * 86400000);
    const df = ago.toISOString().split("T")[0];
    const dt = now.toISOString().split("T")[0];
    let placements = [];
    try {
      const plRaw = await firefishGet(
        `/placements/search?dateFrom=${df}&dateTo=${dt}&limit=50`
      );
      placements = Array.isArray(plRaw)
        ? plRaw
        : plRaw.Results || plRaw.data || [];
    } catch (plErr) {
      console.log("Placements not available (scope not authorised):", plErr.message);
    }

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
    return "=== THINK TALENT — FULL CRM Pipeline (Odoo, LIVE data, ALL time periods) ===\nThis is live data from the complete Odoo CRM. You have access to ALL leads and opportunities across ALL months, not just the current month. When asked about any time period, analyse the create_date field to filter records.\nOdoo credentials not configured.\n";
  }

  try {
    const opps = await odooRPC(
      "crm.lead",
      "search_read",
      [[["active", "=", true]]],
      {
        fields: [
          "name",
          "partner_id",
          "stage_id",
          "expected_revenue",
          "date_deadline",
          "write_date",
          "create_date",
          "user_id",
        ],
        limit: 2000,
        order: "create_date DESC",
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
      (sum, o) => sum + (parseFloat(o.expected_revenue) || 0),
      0
    );
    const totalWon = won.reduce(
      (sum, o) => sum + (parseFloat(o.expected_revenue) || 0),
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
      stages[s].val += parseFloat(o.expected_revenue) || 0;
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
        const val = parseFloat(o.expected_revenue) || 0;
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

    // New leads this month
    const now2 = new Date();
    const monthStart = new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString().split("T")[0];
    const newThisMonth = opps.filter((o) => o.create_date && o.create_date >= monthStart);
    if (newThisMonth.length > 0) {
      ctx += `\nNew opportunities created this month (${now2.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "Europe/Malta" })}): ${newThisMonth.length}\n`;
      newThisMonth.forEach((o) => {
        const name = o.name || "Untitled";
        const val = parseFloat(o.expected_revenue) || 0;
        const stage = o.stage_id?.[1] || "";
        const partner = o.partner_id?.[1] || "";
        const created = o.create_date ? o.create_date.split(" ")[0] : "";
        ctx += `- ${name}`;
        if (partner) ctx += ` (${partner})`;
        ctx += ` — ${stage}, EUR ${val.toLocaleString("en-GB")}`;
        if (created) ctx += `, created: ${created}`;
       const salesperson = o.user_id?.[1] || "";
       if (salesperson) ctx += ` [${salesperson}]`;
        ctx += "\n";
      });
    } else {
      ctx += "\nNo new opportunities created this month.\n";
    }

    
    // Salesperson summary
    const byUser = {};
    opps.forEach((o) => {
      const user = o.user_id?.[1] || "Unassigned";
      if (!byUser[user]) byUser[user] = { count: 0, value: 0 };
      byUser[user].count++;
      byUser[user].value += parseFloat(o.expected_revenue) || 0;
    });
    ctx += "\nPipeline by salesperson:\n";
    Object.entries(byUser)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([user, data]) => {
        ctx += `- ${user}: ${data.count} records, EUR ${data.value.toLocaleString("en-GB")}\n`;
      });

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

// ─── Tool Call Handler ───────────────────────────────────────────────────────
// ─── Web Search & Browsing ──────────────────────────────────────────────────

const BRAVE_API_KEY = process.env.BRAVE_API_KEY || "";

async function webSearch(query, numResults = 5) {
  try {
    if (BRAVE_API_KEY) {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.append("q", query);
      url.searchParams.append("count", numResults);
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json", "X-Subscription-Token": BRAVE_API_KEY }
      });
      if (response.ok) {
        const data = await response.json();
        return { results: (data.web?.results || []).slice(0, numResults).map(r => ({ title: r.title, url: r.url, description: r.description || "" })), source: "brave" };
      }
    }
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(ddgUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", Accept: "text/html" }
    });
    if (!response.ok) throw new Error("DuckDuckGo error: " + response.status);
    const html = await response.text();
    const results = [];
    const linkPattern = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetPattern = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    const links = []; let match;
    while ((match = linkPattern.exec(html)) !== null) links.push({ rawUrl: match[1], title: match[2].replace(/<[^>]+>/g, "").trim() });
    const snippets = [];
    while ((match = snippetPattern.exec(html)) !== null) snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
    for (let i = 0; i < Math.min(links.length, numResults); i++) {
      let resultUrl = links[i].rawUrl;
      if (resultUrl.includes("uddg=")) {
        try { resultUrl = decodeURIComponent(new URL(resultUrl, "https://duckduckgo.com").searchParams.get("uddg") || resultUrl); } catch {}
      }
      results.push({ title: links[i].title, url: resultUrl, description: snippets[i] || "" });
    }
    return { results: results.slice(0, numResults), source: "duckduckgo" };
  } catch (err) {
    console.error("Web search error:", err.message);
    return { results: [], source: "error", error: err.message };
  }
}

async function browseUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error("HTTP " + response.status);
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "").replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { url, title: titleMatch ? titleMatch[1].trim() : "", content: content.substring(0, 4000), truncated: content.length > 4000 };
  } catch (err) {
    return { url, title: "", content: "", error: err.message };
  }
}

async function handleToolCall(name, input) {
  try {
    switch (name) {

      case "query_crm_pipeline": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const domain = [];
        if (!input.include_closed) domain.push(["active", "=", true]);
        if (input.company) domain.push(["partner_id.name", "ilike", input.company]);
        if (input.date_from) domain.push(["create_date", ">=", input.date_from]);
        if (input.date_to) domain.push(["create_date", "<=", input.date_to + " 23:59:59"]);
        if (input.salesperson) domain.push(["user_id.name", "ilike", input.salesperson]);
        if (input.stage) domain.push(["stage_id.name", "ilike", input.stage]);
        if (input.source) domain.push(["source_id.name", "ilike", input.source]);
        if (input.type) domain.push(["type", "=", input.type]);
        if (input.tag) domain.push(["tag_ids.name", "ilike", input.tag]);
        const results = await odooRPC("crm.lead", "search_read", [domain], {
          fields: ["id","name","partner_id","stage_id","expected_revenue","date_deadline","write_date","create_date","user_id","source_id","type","probability","email_from","phone", "tag_ids"],
          limit: input.limit || 500, order: "create_date DESC", context: { lang: "en_GB" },
        });
        if (!results.length) return "No records found matching those filters.";
        let t = "Found " + results.length + " record(s):\n\n";
        // Resolve tag names
        const allTagIds = [...new Set(results.flatMap(o => o.tag_ids || []))];
        const tagMap = {};
        if (allTagIds.length > 0) {
          const tags = await odooRPC("crm.tag", "search_read", [[["id", "in", allTagIds]]], { fields: ["id", "name", "color"] });
          for (const t of tags) tagMap[t.id] = t.name;
        }
        results.forEach(o => {
          t += "- [ID:" + o.id + "] " + (o.name||"Untitled");
          if (o.partner_id?.[1]) t += " | Company: " + o.partner_id[1];
          t += " | Stage: " + (o.stage_id?.[1]||"Unknown");
          t += " | Value: EUR " + (o.expected_revenue||0).toLocaleString("en-GB");
          if (o.source_id?.[1]) t += " | Source: " + o.source_id[1];
          if (o.user_id?.[1]) t += " | Salesperson: " + o.user_id[1];
          t += " | Created: " + (o.create_date||"").split(" ")[0];
          if (o.date_deadline) t += " | Deadline: " + o.date_deadline;
          t += " | Type: " + (o.type||"unknown");
                    const tagNames = (o.tag_ids || []).map(id => tagMap[id] || "").filter(Boolean);
          if (tagNames.length) t += " | Tags: " + tagNames.join(", ");
          t += "\n";
        });
        const total = results.reduce((s,o) => s + (parseFloat(o.expected_revenue)||0), 0);
        t += "\nTotal value: EUR " + total.toLocaleString("en-GB");
        return t;
      }

      case "update_crm_lead": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const vals = {};
        if (input.expected_revenue !== undefined) vals.expected_revenue = input.expected_revenue;
        if (input.date_deadline) vals.date_deadline = input.date_deadline;
        if (input.probability !== undefined) vals.probability = input.probability;
        if (input.stage) {
          const stages = await odooRPC("crm.stage", "search_read", [[["name","ilike",input.stage]]], { fields:["id","name"], limit:5 });
          if (stages.length) vals.stage_id = stages[0].id;
          else return "Stage '" + input.stage + "' not found in Odoo.";
        }
        if (input.salesperson) {
          const users = await odooRPC("res.users", "search_read", [[["name","ilike",input.salesperson]]], { fields:["id","name"], limit:5 });
          if (users.length) vals.user_id = users[0].id;
          else return "Salesperson '" + input.salesperson + "' not found.";
        }
        if (!Object.keys(vals).length) return "No fields to update.";
        await odooRPC("crm.lead", "write", [[input.lead_id], vals]);
        return "Updated lead ID " + input.lead_id + ". Fields changed: " + Object.keys(vals).join(", ");
      }

      case "create_crm_lead": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const vals = { name: input.name, type: input.type || "lead" };
        if (input.partner_name) vals.partner_name = input.partner_name;
        if (input.contact_name) vals.contact_name = input.contact_name;
        if (input.email) vals.email_from = input.email;
        if (input.phone) vals.phone = input.phone;
        if (input.expected_revenue) vals.expected_revenue = input.expected_revenue;
        if (input.tags && input.tags.length) {
          const tagIds = [];
          for (const tagName of input.tags) {
            const existing = await odooRPC("crm.tag", "search_read", [[["name", "=ilike", tagName]]], { fields: ["id"], limit: 1 });
            if (existing.length) tagIds.push(existing[0].id);
            else { let newId = await odooRPC("crm.tag", "create", [{ name: tagName }]); if (Array.isArray(newId)) newId = newId[0]; tagIds.push(newId); }
          }
          if (tagIds.length) vals.tag_ids = tagIds.map(id => [4, id]);
        }
        const id = await odooRPC("crm.lead", "create", [vals]);
        return "Created new " + (vals.type) + " with ID " + id + ": " + input.name;
      }

      case "query_odoo_products": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const domain = [];
        if (input.name) domain.push(["name", "ilike", input.name]);
        if (input.published !== undefined) domain.push(["is_published", "=", input.published]);
        const results = await odooRPC("product.template", "search_read", [domain], {
          fields: ["name","list_price","type","categ_id","is_published","description_sale"], limit: 200, order: "name ASC", context: { lang: "en_GB" },
        });
        if (!results.length) return "No products found.";
        let t = "Found " + results.length + " product(s):\n\n";
        results.forEach(p => {
          t += "- " + p.name;
          if (p.list_price) t += " | EUR " + p.list_price.toLocaleString("en-GB");
          if (p.categ_id?.[1]) t += " | " + p.categ_id[1];
          t += " | Published: " + (p.is_published ? "Yes" : "No") + "\n";
        });
        return t;
      }

      case "query_odoo_contacts": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const domain = [];
        if (input.name) domain.push(["name", "ilike", input.name]);
        if (input.is_company !== undefined) domain.push(["is_company", "=", input.is_company]);
        if (input.customer) domain.push(["customer_rank", ">", 0]);
        const results = await odooRPC("res.partner", "search_read", [domain], {
          fields: ["name","email","phone","city","country_id","is_company","function","parent_id"], limit: 200, order: "name ASC", context: { lang: "en_GB" },
        });
        if (!results.length) return "No contacts found.";
        let t = "Found " + results.length + " contact(s):\n\n";
        results.forEach(c => {
          t += "- " + c.name;
          if (c.is_company) t += " [Company]";
          if (c.function) t += " | " + c.function;
          if (c.parent_id?.[1]) t += " @ " + c.parent_id[1];
          if (c.email) t += " | " + c.email;
          if (c.phone) t += " | " + c.phone;
          t += "\n";
        });
        return t;
      }

      case "query_odoo_events": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const domain = [];
        if (input.name) domain.push(["name", "ilike", input.name]);
        if (input.upcoming_only !== false) domain.push(["date_begin", ">=", new Date().toISOString()]);
        const results = await odooRPC("event.event", "search_read", [domain], {
          fields: ["name","date_begin","date_end","seats_limited","seats_max","seats_reserved","seats_available","stage_id","organizer_id"], limit: 100, order: "date_begin ASC", context: { lang: "en_GB" },
        });
        if (!results.length) return "No events found.";
        let t = "Found " + results.length + " event(s):\n\n";
        results.forEach(e => {
          t += "- " + e.name + " | " + (e.date_begin||"").split(" ")[0] + " to " + (e.date_end||"").split(" ")[0];
          if (e.seats_limited) t += " | Seats: " + e.seats_reserved + "/" + e.seats_max;
          if (e.stage_id?.[1]) t += " | Stage: " + e.stage_id[1];
          t += "\n";
        });
        return t;
      }

      case "query_odoo_invoices": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const domain = [["move_type", "in", ["out_invoice","out_refund"]]];
        if (input.partner) domain.push(["partner_id.name", "ilike", input.partner]);
        if (input.state) domain.push(["state", "=", input.state]);
        if (input.date_from) domain.push(["invoice_date", ">=", input.date_from]);
        if (input.date_to) domain.push(["invoice_date", "<=", input.date_to]);
        const results = await odooRPC("account.move", "search_read", [domain], {
          fields: ["name","partner_id","invoice_date","amount_total","amount_residual","state","payment_state"], limit: 200, order: "invoice_date DESC", context: { lang: "en_GB" },
        });
        if (!results.length) return "No invoices found.";
        let t = "Found " + results.length + " invoice(s):\n\n";
        let totalAmt = 0;
        results.forEach(i => {
          t += "- " + i.name + " | " + (i.partner_id?.[1]||"Unknown") + " | " + (i.invoice_date||"N/A");
          t += " | EUR " + (i.amount_total||0).toLocaleString("en-GB");
          t += " | " + (i.state||"") + " | Payment: " + (i.payment_state||"");
          t += "\n";
          totalAmt += i.amount_total || 0;
        });
        t += "\nTotal: EUR " + totalAmt.toLocaleString("en-GB");
        return t;
      }

      case "query_odoo_sales_orders": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const domain = [];
        if (input.partner) domain.push(["partner_id.name", "ilike", input.partner]);
        if (input.state) domain.push(["state", "=", input.state]);
        if (input.date_from) domain.push(["date_order", ">=", input.date_from]);
        if (input.date_to) domain.push(["date_order", "<=", input.date_to]);
        const results = await odooRPC("sale.order", "search_read", [domain], {
          fields: ["name","partner_id","date_order","amount_total","state","user_id"], limit: 200, order: "date_order DESC", context: { lang: "en_GB" },
        });
        if (!results.length) return "No sales orders found.";
        let t = "Found " + results.length + " order(s):\n\n";
        results.forEach(o => {
          t += "- " + o.name + " | " + (o.partner_id?.[1]||"Unknown") + " | " + (o.date_order||"").split(" ")[0];
          t += " | EUR " + (o.amount_total||0).toLocaleString("en-GB") + " | " + (o.state||"");
          if (o.user_id?.[1]) t += " | " + o.user_id[1];
          t += "\n";
        });
        return t;
      }

      case "get_pipeline_summary": {
        const [ff, od] = await Promise.all([getFirefishPipeline(), getOdooPipeline()]);
        return ff + "\n" + od;
      }

      case "search_recruitment_jobs": {
        try {
          const status = input.status || "Open";
          const jobs = await firefishGet("/jobs/search?status=" + status + "&limit=" + (input.limit||50));
          const list = Array.isArray(jobs) ? jobs : jobs.Results || jobs.data || [];
          if (!list.length) return "No " + status.toLowerCase() + " jobs found.";
          let t = "Found " + list.length + " " + status.toLowerCase() + " job(s):\n\n";
          list.forEach(j => {
            t += "- " + (j.Title||j.JobTitle||"Untitled");
            if (j.CompanyName||j.Company) t += " at " + (j.CompanyName||j.Company);
            if (j.PrimaryDiscipline||j.Discipline) t += " (" + (j.PrimaryDiscipline||j.Discipline) + ")";
            if (j.ConsultantName||j.Consultant) t += " [" + (j.ConsultantName||j.Consultant) + "]";
            t += "\n";
          });
          return t;
        } catch(e) { return "Firefish error: " + e.message; }
      }

      case "search_placements": {
        try {
          const days = input.days_back || 90;
          const now = new Date(); const ago = new Date(now.getTime() - days*86400000);
          const pl = await firefishGet("/placements/search?dateFrom=" + ago.toISOString().split("T")[0] + "&dateTo=" + now.toISOString().split("T")[0] + "&limit=" + (input.limit||50));
          const list = Array.isArray(pl) ? pl : pl.Results || pl.data || [];
          if (!list.length) return "No placements in last " + days + " days.";
          let t = "Found " + list.length + " placement(s):\n\n";
          let fees = 0;
          list.forEach(p => {
            const cand = p.CandidateName || (p.FirstName||""+" "+p.LastName||"").trim() || "Unknown";
            t += "- " + cand;
            if (p.JobTitle||p.Role) t += " -> " + (p.JobTitle||p.Role);
            if (p.CompanyName||p.Company) t += " at " + (p.CompanyName||p.Company);
            const fee = parseFloat(p.Fee||p.fee||0);
            if (fee) { t += " | Fee: EUR " + fee.toLocaleString("en-GB"); fees += fee; }
                        if (p.ConsultantName||p.Consultant) t += " [" + (p.ConsultantName||p.Consultant) + "]";
t += "\n";
          });
          if (fees) t += "\nTotal fees: EUR " + fees.toLocaleString("en-GB");
          return t;
        } catch(e) { return "Firefish error: " + e.message; }
      }

      case "search_candidates": {
        try {
          let path = "/candidates/search?limit=" + (input.limit||50);
          if (input.name) path += "&name=" + encodeURIComponent(input.name);
          if (input.skills) path += "&keywords=" + encodeURIComponent(input.skills);
          const res = await firefishGet(path);
          const list = Array.isArray(res) ? res : res.Results || res.data || [];
          if (!list.length) return "No candidates found.";
          let t = "Found " + list.length + " candidate(s):\n\n";
          list.forEach(c => {
            t += "- " + (c.FirstName||"") + " " + (c.LastName||"");
            if (c.CurrentJobTitle) t += " | " + c.CurrentJobTitle;
            if (c.CurrentCompany) t += " at " + c.CurrentCompany;
            if (c.Status) t += " | " + c.Status;
            t += "\n";
          });
          return t;
        } catch(e) { return "Firefish error: " + e.message; }
      }

      case "search_companies_firefish": {
        try {
          let path = "/companies/search?limit=" + (input.limit||50);
          if (input.name) path += "&name=" + encodeURIComponent(input.name);
          const res = await firefishGet(path);
          const list = Array.isArray(res) ? res : res.Results || res.data || [];
          if (!list.length) return "No companies found.";
          let t = "Found " + list.length + " company/ies:\n\n";
          list.forEach(c => {
            t += "- " + (c.CompanyName||c.Name||"Unknown");
            if (c.Industry) t += " | " + c.Industry;
            if (c.Town||c.City) t += " | " + (c.Town||c.City);
            t += "\n";
          });
          return t;
        } catch(e) { return "Firefish error: " + e.message; }
      }

      case "log_odoo_note": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        await odooRPC(input.model, "message_post", [[input.record_id]], {
          body: input.note, message_type: "comment", subtype_xmlid: "mail.mt_note"
        });
        return "Note logged on " + input.model + " ID " + input.record_id + ".";
      }

      case "get_available_tags": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const tags = await odooRPC("crm.tag", "search_read", [[]], { fields: ["id", "name", "color"], order: "name ASC" });
        if (!tags.length) return "No CRM tags found.";
        const colorNames = { 0:"None", 1:"Red", 2:"Orange", 3:"Yellow", 4:"Light Blue", 5:"Purple", 6:"Pink", 7:"Blue", 8:"Dark Purple", 9:"Fuchsia", 10:"Green", 11:"Violet" };
        let t = "CRM Tags (" + tags.length + "):\n\n";
        for (const tag of tags) {
          const count = await odooRPC("crm.lead", "search_count", [[["tag_ids", "in", [tag.id]], ["active", "=", true]]]);
          t += "- " + tag.name + " (Color: " + (colorNames[tag.color] || tag.color) + ") \u2014 " + count + " active leads\n";
        }
        return t;
      }

      case "get_leads_by_tag": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const domain = [["tag_ids.name", "ilike", input.tag], ["active", "=", true]];
        if (input.stage) domain.push(["stage_id.name", "ilike", input.stage]);
        if (input.date_from) domain.push(["create_date", ">=", input.date_from]);
        if (input.date_to) domain.push(["create_date", "<=", input.date_to + " 23:59:59"]);
        const results = await odooRPC("crm.lead", "search_read", [domain], {
          fields: ["id", "name", "partner_id", "stage_id", "expected_revenue", "user_id", "create_date", "tag_ids"],
          limit: input.limit || 50, order: "create_date DESC"
        });
        if (!results.length) return "No leads found with tag '" + input.tag + "'.";
        const allTagIds = [...new Set(results.flatMap(o => o.tag_ids || []))];
        const tagMap = {};
        if (allTagIds.length > 0) {
          const tagRecords = await odooRPC("crm.tag", "search_read", [[["id", "in", allTagIds]]], { fields: ["id", "name"] });
          for (const tr of tagRecords) tagMap[tr.id] = tr.name;
        }
        let t = "Leads tagged '" + input.tag + "' (" + results.length + "):\n\n";
        results.forEach(o => {
          t += "- [ID:" + o.id + "] " + (o.name || "Untitled");
          if (o.partner_id?.[1]) t += " | " + o.partner_id[1];
          t += " | Stage: " + (o.stage_id?.[1] || "Unknown");
          t += " | EUR " + (o.expected_revenue || 0).toLocaleString("en-GB");
          if (o.user_id?.[1]) t += " | " + o.user_id[1];
          const tagNames = (o.tag_ids || []).map(id => tagMap[id] || "").filter(Boolean);
          if (tagNames.length) t += " | Tags: " + tagNames.join(", ");
          t += "\n";
        });
        const total = results.reduce((s, o) => s + (parseFloat(o.expected_revenue) || 0), 0);
        t += "\nTotal value: EUR " + total.toLocaleString("en-GB");
        return t;
      }

      case "update_lead_tags": {
        if (!ODOO_API_KEY) return "Odoo credentials not configured.";
        const ops = [];
        const added = [];
        const removed = [];
        if (input.add_tags && input.add_tags.length) {
          for (const tagName of input.add_tags) {
            let existing = await odooRPC("crm.tag", "search_read", [[["name", "=ilike", tagName]]], { fields: ["id"], limit: 1 });
            let tagId;
            if (existing.length) { tagId = existing[0].id; }
            else { tagId = await odooRPC("crm.tag", "create", [{ name: tagName }]); if (Array.isArray(tagId)) tagId = tagId[0]; }
            ops.push([4, tagId]);
            added.push(tagName);
          }
        }
        if (input.remove_tags && input.remove_tags.length) {
          for (const tagName of input.remove_tags) {
            const existing = await odooRPC("crm.tag", "search_read", [[["name", "=ilike", tagName]]], { fields: ["id"], limit: 1 });
            if (existing.length) { ops.push([3, existing[0].id]); removed.push(tagName); }
          }
        }
        if (!ops.length) return "No tags to add or remove.";
        await odooRPC("crm.lead", "write", [[input.lead_id], { tag_ids: ops }]);
        let msg = "Updated tags on lead ID " + input.lead_id + ".";
        if (added.length) msg += " Added: " + added.join(", ") + ".";
        if (removed.length) msg += " Removed: " + removed.join(", ") + ".";
        return msg;
      }

      case "web_search": {
        const result = await webSearch(input.query, input.num_results || 5);
        if (!result.results.length) return "No results found for: " + input.query;
        let t = "Search results for '" + input.query + "' (" + result.source + "):\n\n";
        result.results.forEach((r, i) => { t += (i+1) + ". " + r.title + "\n   " + r.url + "\n   " + r.description + "\n\n"; });
        return t;
      }

      case "browse_url": {
        const result = await browseUrl(input.url);
        if (result.error) return "Could not read page: " + result.error;
        return "Page: " + (result.title || input.url) + "\n\n" + result.content + (result.truncated ? "\n\n[Content truncated]" : "");
      }

      case "company_lookup": {
        const query = input.domain ? input.domain + " company about" : input.company_name + " company Malta";
        const searchResult = await webSearch(query, 5);
        if (!searchResult.results.length) return "No information found for " + input.company_name;
        const summary = searchResult.results.slice(0, 3).map(r => r.description).filter(Boolean).join(" | ");
        let t = "Company: " + input.company_name + "\n\nSummary: " + (summary || searchResult.results[0].title) + "\n\nSources:\n";
        searchResult.results.forEach(r => { t += "- " + r.title + ": " + r.url + "\n"; });
        return t;
      }

      case "competitor_intel": {
        const [r1, r2] = await Promise.all([
          webSearch(input.competitor_name + " Malta services", 3),
          webSearch(input.competitor_name + " LinkedIn", 3)
        ]);
        const allResults = [...r1.results, ...r2.results];
        if (!allResults.length) return "No competitive intelligence found for " + input.competitor_name;
        let t = "Competitive intel: " + input.competitor_name + "\n\n";
        const seen = new Set();
        allResults.forEach(r => {
          if (!seen.has(r.url)) { seen.add(r.url); t += "- " + r.title + "\n  " + r.url + "\n  " + r.description + "\n\n"; }
        });
        return t;
      }

      default: return "Unknown tool: " + name;
    }
  } catch(err) {
    console.error("Tool " + name + " error:", err.message);
    return "Error: " + err.message;
  }
}

// ─── Core Message Handler ─────────────────────────────────────────────────────

const conversationHistory = {};

async function handleMessage(chatId, userMessage, userName, channel = 'telegram') {
  console.log(`[${channel.toUpperCase()}] Message from ${userName} (${chatId}): ${userMessage}`);
  
  // Send typing indicator
  if (channel === 'telegram') {
    await sendTypingAction(chatId);
  }

  try {
    // Build messages array - NO pre-fetching of pipeline data
    // Sam will use tools to query data on-demand
    const messages = [{ role: 'user', content: userMessage }];

    // First Claude call WITH tools
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: SAM_TOOLS,
      messages
    });

    // Tool-use loop - let Claude call tools and get results
    let iterations = 0;
    while (response.stop_reason === 'tool_use' && iterations < 5) {
      iterations++;
      console.log(`Tool-use iteration ${iterations}`);

      // Add assistant response to messages
      messages.push({ role: 'assistant', content: response.content });

      // Process each tool call
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`Calling tool: ${block.name}`, JSON.stringify(block.input).substring(0, 200));
          const result = await handleToolCall(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: typeof result === 'string' ? result : JSON.stringify(result)
          });
        }
      }

      // Add tool results and call Claude again
      messages.push({ role: 'user', content: toolResults });

      // Send another typing indicator for long tool chains
      if (channel === 'telegram') {
        await sendTypingAction(chatId);
      }

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: SAM_TOOLS,
        messages
      });
    }

    // Extract final text response
    let reply = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        reply += block.text;
      }
    }

    if (!reply) {
      reply = 'I processed your request but could not generate a text response. Please try rephrasing.';
    }

    // Send via appropriate channel
    if (channel === 'whatsapp') {
      await sendWhatsApp(chatId, reply);
    } else {
      await sendTelegram(chatId, reply);
    }
  } catch (err) {
    console.error('handleMessage error:', err);
    const errorMsg = 'Sorry, I encountered an error processing your request. Please try again.';
    if (channel === 'whatsapp') {
      await sendWhatsApp(chatId, errorMsg);
    } else {
      await sendTelegram(chatId, errorMsg);
    }
  }
}


// ─── WhatsApp Sending ─────────────────────────────────────
async function sendWhatsApp(to, text) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.substring(0, 4000));
    remaining = remaining.substring(4000);
  }
  for (const chunk of chunks) {
    try {
      await fetchJSON(
        `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to,
            type: 'text',
            text: { body: chunk },
          }),
        }
      );
    } catch (err) {
      console.error('WhatsApp send error:', err.message);
    }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    bot: "Sam TRC (Telegram + WhatsApp)",
    version: "2.0.0",
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

    await handleMessage(chatId, text, userName, 'telegram');
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


// ─── WhatsApp Webhook Verification (GET) ────────────────────────────────────────────────────────────
app.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    console.log('WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

// ─── WhatsApp Incoming Messages (POST) ────────────────────────────────────────────────────────────────
const processedWaMessages = new Set();

app.post('/whatsapp', async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages || value.statuses) return;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    if (processedWaMessages.has(message.id)) return;
    processedWaMessages.add(message.id);
    if (processedWaMessages.size > 1000) {
      const arr = [...processedWaMessages];
      arr.slice(0, 500).forEach(id => processedWaMessages.delete(id));
    }

    const senderNumber = message.from;
    const senderName = contact?.profile?.name || 'Unknown';
    const messageType = message.type;

    if (ALLOWED_WA_NUMBERS.length > 0 && !ALLOWED_WA_NUMBERS.includes(senderNumber)) {
      console.log(`WhatsApp: blocked message from ${senderNumber} (${senderName})`);
      await sendWhatsApp(senderNumber, 'This bot is restricted to authorised users.');
      return;
    }

      // Mark message as read (blue ticks)
      try {
        await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_NUMBER_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: message.id })
        });
      } catch (e) { console.error("Read receipt error:", e.message); }

    if (messageType === 'text') {
      const text = message.text.body;
      console.log(`[WA] ${senderName} (${senderNumber}): ${text.substring(0, 100)}`);
      await handleMessage(`wa_${senderNumber}`, text, senderName, 'whatsapp');
    } else if (message.type === "audio") {
        try {
          const mediaId = message.audio.id;
          const mediaInfoRes = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${mediaId}`, {
            headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}` }
          });
          const mediaInfo = await mediaInfoRes.json();
          const audioRes = await fetch(mediaInfo.url, {
            headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}` }
          });
          const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
          const base64Audio = audioBuffer.toString("base64");
          const mimeType = mediaInfo.mime_type || "audio/ogg";

          const audioMessage = {
            role: "user",
            content: [
              { type: "input_audio", source: { type: "base64", media_type: mimeType, data: base64Audio } },
              { type: "text", text: "The user sent a voice message. Please listen to it and respond naturally. If they asked a question, answer it. If they gave instructions, follow them." }
            ]
          };

          const chatId = senderNumber;
          const history = conversationHistory.get(chatId) || [];
          history.push(audioMessage);
          const reply = await processMessage(history);
          history.push({ role: "assistant", content: reply });
          conversationHistory.set(chatId, history.slice(-20));
          await sendWhatsApp(chatId, reply);
        } catch (err) {
          console.error("Voice message error:", err.message);
          await sendWhatsApp(senderNumber, "Sorry, I couldn't process that voice message. Could you type it instead?");
        }
      } else 
      await sendWhatsApp(senderNumber,
        "I received a voice message but can't listen to audio yet. Could you send that as text?");
    } else if (messageType === 'image' || messageType === 'document') {
      await sendWhatsApp(senderNumber,
        `I received a ${messageType} but can't view attachments yet. Could you describe what's in it?`);
    }
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
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
        const jobs = await fetchJSON("https://api.firefishsoftware.com/api/v1.1/jobs/search?status=Open&limit=5", {
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
  console.log(`WhatsApp: ${WA_ACCESS_TOKEN ? 'configured' : 'NOT SET'} (Phone ID: ${WA_PHONE_NUMBER_ID || 'NOT SET'})`);
});
