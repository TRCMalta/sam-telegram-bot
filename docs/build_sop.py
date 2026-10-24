"""Generate Sam SOP, Word document for governance and EU AI Act audit.

Output:
  ~/Documents/Obsidian/Claude/Reference/Sam-SOP-v1.0.docx
  ~/Documents/Claude/sam-telegram-bot/docs/SOP-v1.0.docx

TRC voice rules apply to this document: British English, audit grade, no em
dashes anywhere in the body. Regenerate by running ``python3 build_sop.py``.
"""

from __future__ import annotations

import datetime as dt
import pathlib

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor


DOC_VERSION = "1.0"
DOC_DATE = dt.date.today().isoformat()
NEXT_REVIEW = (dt.date.today() + dt.timedelta(days=90)).isoformat()
OWNER = "Jonathan Cremona (Founder, The Remarkable Collective, Malta)"
APPROVER = "Jonathan Cremona"
PRINCIPAL = "Beverly Cutajar (Chairman, The Remarkable Collective)"

PRIMARY = RGBColor(0x0A, 0x0C, 0x14)
ACCENT = RGBColor(0xFF, 0x5C, 0x41)
GREY = RGBColor(0x4A, 0x4F, 0x5C)


# ---------------------------------------------------------------------------
# Helpers (mirrored from barry/docs/build_sop.py for cross-system congruence)
# ---------------------------------------------------------------------------

def add_heading(doc, text, level, color=None):
    h = doc.add_heading(text, level=level)
    if color is not None:
        for run in h.runs:
            run.font.color.rgb = color
    return h


def add_para(doc, text, bold=False, italic=False, size=11, color=None):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    if color:
        r.font.color.rgb = color
    return p


def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(text, style="List Bullet")
    if level:
        p.paragraph_format.left_indent = Cm(0.63 * (level + 1))
    return p


def add_table(doc, headers, rows, col_widths=None):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = "Light Grid Accent 1"
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for p in hdr[i].paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(10)
    for ri, row in enumerate(rows, 1):
        for ci, val in enumerate(row):
            t.rows[ri].cells[ci].text = str(val)
            for p in t.rows[ri].cells[ci].paragraphs:
                for r in p.runs:
                    r.font.size = Pt(10)
    if col_widths:
        for i, w in enumerate(col_widths):
            for row in t.rows:
                row.cells[i].width = Cm(w)
    return t


def page_break(doc):
    doc.add_page_break()


def assert_no_em_dashes(doc):
    """Belt and braces safety check. Audit standard for TRC SOPs."""
    bad = []
    for p in doc.paragraphs:
        if "—" in p.text or "–" in p.text:
            bad.append(p.text[:80])
    for tbl in doc.tables:
        for row in tbl.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    if "—" in p.text or "–" in p.text:
                        bad.append(p.text[:80])
    if bad:
        raise SystemExit(
            "Em or en dash found in SOP body. TRC voice rules forbid these. "
            "First offender: " + repr(bad[0])
        )


# ---------------------------------------------------------------------------
# Build document
# ---------------------------------------------------------------------------

doc = Document()

sec = doc.sections[0]
sec.top_margin = Cm(2.2)
sec.bottom_margin = Cm(2.2)
sec.left_margin = Cm(2.4)
sec.right_margin = Cm(2.4)

style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)

# =========================================================================
# Cover
# =========================================================================
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.LEFT
r = title.add_run("STANDARD OPERATING PROCEDURE")
r.bold = True
r.font.size = Pt(11)
r.font.color.rgb = ACCENT

sub = doc.add_paragraph()
r = sub.add_run("Sam, AI Chief of Staff for Beverly Cutajar")
r.bold = True
r.font.size = Pt(28)
r.font.color.rgb = PRIMARY

p = doc.add_paragraph()
r = p.add_run(
    "Personal AI assistant for Beverly Cutajar, Chairman of The Remarkable "
    "Collective. Sam reads Beverly's Microsoft 365 mailbox and calendar, "
    "queries Firefish (Ceek Talent recruitment CRM) and Odoo (Think Talent "
    "training CRM), drafts and sends emails on request, schedules calendar "
    "events, and delivers all interactions through Telegram and WhatsApp "
    "under an explicit confirmation gate for every outbound action."
)
r.font.size = Pt(12)
r.font.color.rgb = GREY

doc.add_paragraph()
add_table(
    doc,
    ["Field", "Value"],
    [
        ["Document title", "Sam Chief of Staff SOP"],
        ["Version", DOC_VERSION],
        ["Effective date", DOC_DATE],
        ["Principal (data subject and primary user)", PRINCIPAL],
        ["Deployer / Owner", OWNER],
        ["Approver", APPROVER],
        ["Review cycle", "Quarterly or on material change"],
        ["Next review due", NEXT_REVIEW],
        ["Classification", "Internal, Confidential"],
        [
            "Regulatory framing",
            "EU AI Act (Reg. 2024/1689) Limited Risk, GDPR "
            "(Reg. 2016/679), Malta Data Protection Act (Cap. 586)",
        ],
        [
            "Hosting",
            "Railway, project 'cheerful-connection', service "
            "'sam-telegram-bot', region US East (Virginia)",
        ],
        [
            "Repository",
            "github.com/TRCMalta/sam-telegram-bot (PUBLIC repository, "
            "no secrets in source)",
        ],
    ],
    col_widths=[5.5, 11],
)

page_break(doc)

# =========================================================================
# 1. Purpose and scope
# =========================================================================
add_heading(doc, "1. Purpose and scope", 1, PRIMARY)
add_para(
    doc,
    "This Standard Operating Procedure documents the design, operation, "
    "oversight, and lifecycle of Sam, the personal AI Chief of Staff "
    "deployed for Beverly Cutajar, Chairman of The Remarkable Collective. "
    "The document is intended for:",
)
add_bullet(doc, "Internal governance, confirming that Sam operates within stated bounds and only on Beverly's behalf.")
add_bullet(doc, "External audit, evidencing compliance with the EU AI Act limited risk regime and the GDPR.")
add_bullet(doc, "Operational continuity, enabling any future operator to run, maintain, or decommission Sam safely.")

add_heading(doc, "1.1 Scope", 2, PRIMARY)
add_para(doc, "In scope:")
add_bullet(doc, "Dual channel chat interface (Telegram Bot API and WhatsApp Cloud API) restricted to a small allowlist of phone numbers and Telegram user IDs.")
add_bullet(doc, "Conversation context layer (in-process per-chat history with LRU eviction and per-chat timeout).")
add_bullet(doc, "Anthropic Claude (Sonnet 4) tool use loop with confirmation gates on consequential actions.")
add_bullet(doc, "Microsoft 365 Graph integration, reading Beverly's mailbox, drafting and sending email on Beverly's behalf, and creating calendar events.")
add_bullet(doc, "Firefish recruitment CRM read access covering placements, candidates, companies, jobs, pipeline summary, and lead tags.")
add_bullet(doc, "Odoo JSON-RPC integration covering CRM leads and opportunities, products, contacts, events, invoices, sales orders, tag management, and note logging on the Think Talent tenant.")
add_bullet(doc, "Voice note transcription via Groq Whisper for inbound voice messages on Telegram and WhatsApp.")
add_bullet(doc, "Web search and lightweight URL browsing via Brave Search API and a direct fetch helper.")
add_bullet(doc, "Proactive coaching prompts tuned for Beverly's chairman role.")

add_para(doc, "Out of scope:")
add_bullet(doc, "Hiring or selection decisions. Sam reads Firefish but never scores or filters candidates. Recruitment screening is owned by Milo under its own SOP.")
add_bullet(doc, "Financial transactions. Sam can read Odoo invoices and sales orders but cannot create them, modify them, or initiate payments.")
add_bullet(doc, "Public facing content publishing. Sam never posts to LinkedIn, X, the Ceek website, or any other public channel.")
add_bullet(doc, "Other principals. Sam is single principal. A future CEO or COO agent runs as a forked service with separate credentials and a separate SOP.")
add_bullet(doc, "Persistent long term memory of Beverly's conversations. State of record lives in Microsoft 365, Firefish, and Odoo. Sam holds context in process only.")

page_break(doc)

# =========================================================================
# 2. System overview
# =========================================================================
add_heading(doc, "2. System overview", 1, PRIMARY)
add_para(
    doc,
    "Sam is a single instance Node.js (18 LTS) Express service hosted on "
    "Railway. The runtime has no persistent volume. Conversation history is "
    "held in process memory only and is wiped on restart. Beverly interacts "
    "with Sam via Telegram or WhatsApp. The service receives webhooks, calls "
    "the Anthropic Messages API with a defined set of tools, executes tool "
    "calls against Microsoft 365, Firefish, Odoo, Brave Search, and Groq, "
    "and replies via the same channel the request came in on.",
)

add_heading(doc, "2.1 High-level architecture", 2, PRIMARY)
add_bullet(doc, "Inbound webhook (Telegram POST /webhook or WhatsApp POST /whatsapp) lands at the Railway hosted Express endpoints.")
add_bullet(doc, "Auth gate verifies the sender is on the ALLOWED_TELEGRAM_USERS or ALLOWED_WA_NUMBERS allowlist before any LLM call is made.")
add_bullet(doc, "Voice attachments are downloaded from the Telegram or WhatsApp media URL and transcribed via Groq Whisper.")
add_bullet(doc, "Per-chat conversation history (in-process Map keyed by chat ID) is loaded and the new turn appended.")
add_bullet(doc, "Anthropic Messages API call is issued with the conversation, the Beverly tuned system prompt, and the tool registry.")
add_bullet(doc, "Tool use loop iterates up to a hard cap of 10 turns. When Claude requests a tool, the service executes it against the relevant external API and returns the result to Claude.")
add_bullet(doc, "Confirmation gate: before send_beverly_email and create_beverly_calendar_event, Sam composes a draft, presents it to Beverly in the active chat, and waits for an explicit yes.")
add_bullet(doc, "Final assistant message is formatted for mobile and sent back on the originating channel.")
add_bullet(doc, "Conversation history is pruned by LRU eviction and per-chat timeout. A Railway service restart wipes all in-flight context.")

add_heading(doc, "2.2 Decision authority", 2, PRIMARY)
add_para(
    doc,
    "Sam holds no autonomous authority over outbound communication or "
    "calendar bookings. Every email send and every calendar event creation "
    "requires an explicit confirmation from Beverly in the active chat "
    "before execution. Read operations (email search, calendar lookup, CRM "
    "query, web search) do not require confirmation because they produce no "
    "side effect. The service can be stopped instantly by removing the "
    "Telegram webhook, removing the WhatsApp subscription, revoking the "
    "Anthropic API key, or stopping the Railway service.",
)

page_break(doc)

# =========================================================================
# 3. EU AI Act classification
# =========================================================================
add_heading(doc, "3. EU AI Act classification", 1, PRIMARY)
add_para(
    doc,
    "Regulation (EU) 2024/1689, the Artificial Intelligence Act, entered "
    "into force on 1 August 2024. The classifications, roles, and "
    "obligations recorded below apply to Sam as deployed on the effective "
    "date of this SOP.",
)

add_heading(doc, "3.1 Role under the Act", 2, PRIMARY)
add_table(
    doc,
    ["Role", "Status", "Reasoning"],
    [
        [
            "Provider (Art. 3(3))",
            "No",
            "Sam does not develop or place a general purpose or high risk AI model on the EU market. It integrates Anthropic Claude and Groq Whisper through their respective APIs.",
        ],
        [
            "Deployer (Art. 3(4))",
            "YES",
            "Jonathan Cremona, sole proprietor of The Remarkable Collective in Malta, deploys Sam under his professional authority for use by Beverly Cutajar within TRC.",
        ],
        [
            "Importer / Distributor",
            "No",
            "No third party AI system is placed on the EU market by Sam.",
        ],
        [
            "Affected persons (Art. 3(2))",
            "Principal plus correspondents",
            "Primary affected natural person is Beverly Cutajar (the principal). Secondary affected persons include any natural person whose email Sam reads, summarises, or to whom Beverly sends a Sam drafted email.",
        ],
    ],
    col_widths=[3.5, 1.5, 11.5],
)

add_heading(doc, "3.2 Risk classification, Limited Risk", 2, PRIMARY)
add_para(doc, "Sam is classified as LIMITED RISK under the EU AI Act.", bold=True)
add_bullet(doc, "Not a prohibited practice under Article 5. No subliminal manipulation, no exploitation of vulnerable groups, no social scoring, no biometric categorisation, no real time remote biometric identification, no predictive policing, no emotion inference in employment.")
add_bullet(doc, "Not a high risk AI system under Article 6 or Annex III. Sam reads Firefish candidate records but does not analyse, filter, score, or evaluate them. Recruitment screening is performed by a separate system (Milo) under its own SOP. Sam queries Odoo but does not make decisions that affect access to essential services, employment, education, or law enforcement outcomes.")
add_bullet(doc, "Generative text directed at natural persons (email drafts sent on Beverly's behalf) triggers the Article 50 transparency duty (see Section 3.3).")
add_bullet(doc, "General purpose AI models used as components (Claude, Whisper) carry Article 53 to 55 obligations borne by their providers (Anthropic, Groq), not by the deployer.")

add_heading(doc, "3.3 Article 50 transparency obligations", 2, PRIMARY)
add_bullet(doc, "Art. 50(1). Beverly is informed at onboarding to Sam that she is interacting with an AI system. No further per message disclosure is required because she is the named user of the service.")
add_bullet(doc, "Art. 50(4). Email drafts generated by Sam are reviewed and explicitly confirmed by Beverly through an in chat confirmation gate before send. Beverly exercises editorial control and assumes editorial responsibility for every outbound message. The Article 50(4) editorial control exemption is claimed.")
add_bullet(doc, "No deepfake or persona impersonation. Sam never claims to be a person other than Beverly. Outgoing emails carry Beverly's existing signature as approved during onboarding.")
add_bullet(doc, "Voice notes from Beverly are transcribed for processing only. Sam does not synthesise Beverly's voice or speak as Beverly in audio form.")

add_heading(doc, "3.4 GPAI dependency declaration", 2, PRIMARY)
add_para(
    doc,
    "Obligations under Articles 53 to 55 of the AI Act on general purpose "
    "AI fall on the model providers below, not on the TRC deployer.",
)
add_table(
    doc,
    ["Model", "Provider", "Use", "EU AI Act tier"],
    [
        [
            "claude-sonnet-4-20250514",
            "Anthropic PBC",
            "Conversation, tool use orchestration, draft generation, humanised reply formatting",
            "GPAI without systemic risk (provider obligation)",
        ],
        [
            "whisper-large-v3 (Groq)",
            "Groq Inc.",
            "Voice note transcription for inbound Telegram and WhatsApp voice messages",
            "GPAI without systemic risk (provider obligation)",
        ],
    ],
    col_widths=[5.5, 2.5, 7.0, 4.0],
)

page_break(doc)

# =========================================================================
# 4. Connected services and data flows
# =========================================================================
add_heading(doc, "4. Connected services and data flows", 1, PRIMARY)
add_para(
    doc,
    "Each external service Sam connects to is listed below with purpose, "
    "data category, region of processing, and legal basis. Standard "
    "contractual clauses (SCCs) are in place with every US sub processor.",
)

add_table(
    doc,
    ["Service", "Vendor", "Purpose", "Data sent", "Region", "Legal basis"],
    [
        [
            "Anthropic Claude API",
            "Anthropic PBC",
            "Conversation, tool use orchestration, draft generation",
            "Beverly's chat turns, tool results, system prompt. No raw email bodies are persisted at the provider beyond the inference window.",
            "US (EU SCCs)",
            "Legitimate interest",
        ],
        [
            "Microsoft 365 Graph API",
            "Microsoft Ireland Operations Ltd",
            "Read mailbox, search inbox, send email on Beverly's behalf, read and create calendar events",
            "Mail subject and body excerpts, sender and recipient names, calendar event titles, attendee lists.",
            "EU (Ireland)",
            "Contract (MS 365 tenant agreement) and legitimate interest",
        ],
        [
            "WhatsApp Cloud API",
            "Meta Platforms Ireland Ltd",
            "Beverly's inbound and outbound WhatsApp chat with Sam",
            "Beverly's messages, Sam's replies, voice note audio.",
            "EU (Ireland)",
            "Legitimate interest (own communication)",
        ],
        [
            "Telegram Bot API",
            "Telegram FZ-LLC",
            "Beverly's inbound and outbound Telegram chat with Sam",
            "Beverly's messages, Sam's replies, voice note audio.",
            "International (UAE registration)",
            "Legitimate interest",
        ],
        [
            "Firefish CRM API",
            "Firefish Software Ltd",
            "Read access to placements, candidates, jobs, companies, lead tags for Ceek Talent",
            "OAuth scoped reads only. No writes from Sam (writes go through the recruiter UI or Milo).",
            "EU (UK)",
            "Contract (Ceek customer agreement) and legitimate interest",
        ],
        [
            "Odoo 18 (Think Talent tenant)",
            "Self hosted Odoo at thinktalent.com.mt",
            "CRM leads and opportunities, products, contacts, events, invoices, sales orders, tag management, note logging",
            "Customer record fields, lead names, deal values, event titles, invoice metadata, sales order references.",
            "EU (Malta hosting)",
            "Legitimate interest (own business)",
        ],
        [
            "Groq Whisper API",
            "Groq Inc.",
            "Voice note transcription",
            "Audio file from Beverly's WhatsApp or Telegram voice note.",
            "US (EU SCCs)",
            "Legitimate interest",
        ],
        [
            "Brave Search API",
            "Brave Software Inc.",
            "Web search results when Beverly asks for external information",
            "Search query string. No PII.",
            "US (EU SCCs)",
            "Legitimate interest",
        ],
        [
            "URL fetcher (browse_url)",
            "Direct fetch from public web",
            "Lightweight page fetch and summarisation",
            "Target URL only. No credentials forwarded.",
            "Public web",
            "Legitimate interest",
        ],
        [
            "Railway",
            "Railway Corp.",
            "Compute hosting (no persistent volume on this service)",
            "Source code, environment variables, runtime logs to stdout.",
            "US East (Virginia) (EU SCCs)",
            "Legitimate interest",
        ],
        [
            "GitHub (public repo)",
            "GitHub Inc.",
            "Source code repository TRCMalta/sam-telegram-bot, public",
            "Source code only. No secrets, no PII, no env files are committed.",
            "US (EU SCCs)",
            "Legitimate interest",
        ],
    ],
    col_widths=[3.0, 3.5, 4.0, 4.5, 2.5, 3.0],
)

add_heading(doc, "4.1 Sub-processor list", 2, PRIMARY)
add_bullet(doc, "Anthropic PBC, model inference. DPA at anthropic.com/legal.")
add_bullet(doc, "Microsoft Ireland Operations Ltd, Microsoft 365 Graph. Microsoft DPA applies via the TRC M365 tenant agreement.")
add_bullet(doc, "Meta Platforms Ireland Ltd, WhatsApp Business. Meta Business Tools DPA applies.")
add_bullet(doc, "Telegram FZ-LLC, bot channel.")
add_bullet(doc, "Firefish Software Ltd, recruitment CRM read access via OAuth.")
add_bullet(doc, "Groq Inc., voice transcription.")
add_bullet(doc, "Brave Software Inc., search API.")
add_bullet(doc, "Railway Corp., compute host.")
add_bullet(doc, "GitHub Inc., code host (public repository).")

add_heading(doc, "4.2 Data flow diagram (textual)", 2, PRIMARY)
add_para(
    doc,
    "Beverly on Telegram or WhatsApp, then Sam's Express webhook on "
    "Railway, then the allowlist auth gate, then optional voice "
    "transcription via Groq, then the Anthropic Messages API call with the "
    "tool registry, then tool execution against Microsoft Graph or Firefish "
    "or Odoo or Brave Search, then the confirmation gate for any outbound "
    "email or calendar event, then the action executed only on explicit "
    "yes, then the reply formatted for mobile, then sent back on the "
    "originating channel. Conversation history is held in process memory "
    "only, evicted by LRU and per-chat timeout, wiped on restart.",
)

page_break(doc)

# =========================================================================
# 5. Account isolation and security controls
# =========================================================================
add_heading(doc, "5. Account isolation and security controls", 1, PRIMARY)

add_heading(doc, "5.1 Principal isolation", 2, PRIMARY)
add_para(
    doc,
    "Sam is single principal by design. The runtime holds credentials for "
    "exactly one Microsoft 365 mailbox (BEVERLY_EMAIL), one WhatsApp "
    "principal number (BEVERLY_WA_NUMBER), and a Telegram allowlist tuned "
    "to Beverly plus Jonathan as deployer. The system prompt is Beverly "
    "specific. No second principal can be served without a forked service "
    "with separate environment variables, separate webhooks, and a "
    "separate SOP.",
)

add_heading(doc, "5.2 Allowlist enforcement", 2, PRIMARY)
add_bullet(doc, "ALLOWED_TELEGRAM_USERS is a comma separated list of Telegram user IDs. Any inbound message from an ID not on the list is silently rejected. No reply is sent and no LLM credits are spent.")
add_bullet(doc, "ALLOWED_WA_NUMBERS defaults to BEVERLY_WA_NUMBER. Any inbound WhatsApp message from a number not on the list is silently rejected.")
add_bullet(doc, "Allowlists are checked before any Claude call and before any tool execution, so unauthorised messages cost nothing and trigger no reply.")
add_bullet(doc, "Telegram and Meta provide authenticated sender identifiers in their webhook payloads. Sam does not trust user supplied identity fields beyond the platform supplied ones.")

add_heading(doc, "5.3 Secret handling", 2, PRIMARY)
add_bullet(doc, "Repository is public. Source code lives at github.com/TRCMalta/sam-telegram-bot. All credentials must live in Railway environment variables. No exception.")
add_bullet(doc, "No .env file is committed. .gitignore enforces this. Pre-push review confirms no secret was accidentally added.")
add_bullet(doc, "Microsoft 365 Graph credentials (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET) are scoped to Beverly's mailbox only via Azure app registration permissions.")
add_bullet(doc, "Firefish OAuth client credentials are scoped to the Ceek tenant with the minimum scopes needed for read operations.")
add_bullet(doc, "Odoo API key (ODOO_API_KEY) is scoped to the Think Talent admin user. Read and write scope is needed for CRM tag and note logging.")
add_bullet(doc, "WhatsApp Cloud API long lived token rotates annually per Meta policy.")
add_bullet(doc, "Anthropic, Groq, and Brave keys rotate annually or on any suspected leak.")
add_bullet(doc, "WA_VERIFY_TOKEN is non secret (used only during the Meta webhook handshake) but is still set per deployment.")
add_bullet(doc, "Application logs go to Railway stdout. Webhook payloads are visible there, but no key, secret, or token is ever logged.")

add_heading(doc, "5.4 Network exposure", 2, PRIMARY)
add_bullet(doc, "Public surface: https://sam-telegram-bot-production.up.railway.app.")
add_bullet(doc, "GET / returns a 200 health check.")
add_bullet(doc, "POST /webhook receives Telegram updates, gated by allowlist.")
add_bullet(doc, "GET /whatsapp performs the Meta webhook verification handshake. POST /whatsapp receives WhatsApp messages, gated by allowlist.")
add_bullet(doc, "GET /set-webhook re registers the Telegram webhook to the current Railway domain.")
add_bullet(doc, "GET /test-scopes, GET /debug, GET /webhook-info are operator endpoints. TBC, owner to confirm whether these should be moved behind a secret or removed in v1.1.")
add_bullet(doc, "All POST routes are protected by sender identity checks plus allowlist enforcement. No browseable secured surface is exposed.")

page_break(doc)

# =========================================================================
# 6. Human oversight
# =========================================================================
add_heading(doc, "6. Human oversight (EU AI Act Article 14, voluntary alignment)", 1, PRIMARY)
add_para(
    doc,
    "Sam is not a high risk AI system. Article 14 is not strictly required. "
    "The controls below align with its principles to evidence robust human "
    "oversight of an assistant acting on the principal's behalf.",
)
add_bullet(doc, "In chat confirmation gate on send_beverly_email. Sam drafts the email, presents it to Beverly in WhatsApp or Telegram, and waits for an explicit yes before calling Microsoft Graph.")
add_bullet(doc, "In chat confirmation gate on create_beverly_calendar_event, applying the same pattern to calendar invitations.")
add_bullet(doc, "Read operations (email search, calendar lookup, CRM query, web search) execute without confirmation but never produce a side effect on any external system.")
add_bullet(doc, "Beverly can ask Sam to redraft, summarise, list, or cancel any pending action at any point in the conversation.")
add_bullet(doc, "Tool use loop is hard capped at 10 iterations per turn to prevent runaway tool calls or recursive loops.")
add_bullet(doc, "Conversation timeout and LRU eviction prevent stale or contaminated context from influencing decisions.")
add_bullet(doc, "Kill switches. Jonathan or Beverly can stop Sam instantly by stopping the Railway service, revoking the Anthropic API key, deleting the Telegram webhook, or removing the WhatsApp app subscription.")
add_bullet(doc, "Logging. Every tool call, every confirmation response from Beverly, and every error is captured in Railway runtime logs.")

page_break(doc)

# =========================================================================
# 7. Content and output controls
# =========================================================================
add_heading(doc, "7. Content and output controls", 1, PRIMARY)
add_para(
    doc,
    "Sam's outputs are personal to Beverly. The rules below govern tone, "
    "channel formatting, and content boundaries. They are enforced both in "
    "the system prompt and through operational discipline in this SOP.",
)
add_bullet(doc, "Mobile first formatting. Outputs target a six inch screen. Replies are short, structured, and scannable.")
add_bullet(doc, "No long paragraphs. No desktop wide tables. No multi page replies.")
add_bullet(doc, "Tone matches Beverly's chairman role. Strategic, concise, advisory. Never sycophantic. Never overfamiliar.")
add_bullet(doc, "No invented facts. When data is missing, Sam asks Beverly rather than fabricates an answer.")
add_bullet(doc, "British English spelling and conventions are required at all times.")
add_bullet(doc, "Banned phrases enforced in the system prompt: Certainly, Absolutely, Of course, Great question, I'd be happy to, No problem, Just to let you know, As mentioned, Please don't hesitate, Hope this helps, leverage, synergies, holistic, game-changer, dive into, unlock, empower.")
add_bullet(doc, "No third party personal data leaks. Sam never sends a contact's email or phone number to a different recipient without explicit instruction from Beverly.")
add_bullet(doc, "Outgoing emails carry Beverly's existing signature as approved during onboarding. Sam does not invent a new signature.")
add_bullet(doc, "Web search results are summarised, not pasted in full. Sources are cited where helpful.")
add_bullet(doc, "Sensitive topics (medical, legal, financial advice for individuals) are flagged and routed to a qualified professional rather than answered directly.")

page_break(doc)

# =========================================================================
# 8. GDPR position
# =========================================================================
add_heading(doc, "8. GDPR position", 1, PRIMARY)
add_para(doc, "Personal data processed by Sam falls into three buckets.")
add_bullet(doc, "Beverly's own personal data: name, professional email, calendar, contacts, chat history with Sam. Lawful basis: own activity (legitimate interest under Art. 6(1)(f)) and the employment relationship within TRC.")
add_bullet(doc, "Third party personal data inside Beverly's mailbox, calendar, and the CRMs: names, business email addresses, meeting subjects, candidate records, customer records. Lawful basis: legitimate interest for managing the business relationship and contract where applicable.")
add_bullet(doc, "Special category data may incidentally appear inside emails (health, religion, trade union membership). Sam does not actively process these. They pass through to the LLM only as part of an email body Beverly asks Sam to read or summarise. No special category processing is performed as a primary purpose.")

add_heading(doc, "8.1 GDPR articles addressed", 2, PRIMARY)
add_table(
    doc,
    ["Article", "Topic", "Status"],
    [
        [
            "Art. 5",
            "Data minimisation, purpose limitation, storage limitation",
            "Applied. No persistent volume. Conversation history is in process only and evicted by LRU plus per-chat timeout. Service restart wipes all context.",
        ],
        [
            "Art. 6",
            "Lawful basis",
            "Legitimate interest under Art. 6(1)(f) for processing Beverly's own data and managing third party correspondence. Contract under Art. 6(1)(b) for tenant access.",
        ],
        [
            "Art. 9",
            "Special categories",
            "Not actively processed. Incidental exposure when reading inbound email bodies. Minimisation applies because no persistence occurs beyond the LLM inference window.",
        ],
        [
            "Art. 13/14",
            "Information notice",
            "Beverly is the named user and is informed. For direct correspondents, Beverly's existing privacy notice covers email correspondence. TBC, owner to confirm whether Beverly's email signature should carry an 'AI assisted' disclosure footer.",
        ],
        [
            "Art. 22",
            "Solely automated decision making with legal or similarly significant effect",
            "Not triggered. Every consequential action (email send, calendar event creation) requires Beverly's explicit confirmation in chat.",
        ],
        [
            "Art. 25",
            "Data protection by design",
            "Allowlist enforcement, no persistent storage, confirmation gates on outbound actions, secret handling in Railway environment variables only.",
        ],
        [
            "Art. 28",
            "Processor obligations",
            "DPAs in place with every named sub processor (Section 4.1).",
        ],
        [
            "Art. 30",
            "Records of processing activities",
            "This SOP, in combination with the TRC group RoPA, serves as the documented record for Sam.",
        ],
        [
            "Art. 32",
            "Security of processing",
            "TLS in transit, allowlist authentication, secrets stored in Railway environment variables, no persistent data store, public source code with secrets externalised.",
        ],
        [
            "Art. 33/34",
            "Breach notification",
            "Procedure in Section 9. Notification to the Malta IDPC within 72 hours where required, and to affected data subjects without undue delay if high risk.",
        ],
        [
            "Art. 35",
            "DPIA threshold",
            "Not triggered. No systematic large scale processing, no high risk profiling, single principal, no automated decisions with legal effect.",
        ],
        [
            "Art. 44 to 49",
            "International transfers",
            "SCCs in place with US sub processors (Anthropic, Groq, Brave, Railway, GitHub). Microsoft and Meta are EU resident. Telegram is international and treated under legitimate interest with minimal data exposure.",
        ],
    ],
    col_widths=[2.5, 5.5, 9.0],
)

page_break(doc)

# =========================================================================
# 9. Operational procedures
# =========================================================================
add_heading(doc, "9. Operational procedures", 1, PRIMARY)

add_heading(doc, "9.1 Start, stop, redeploy", 2, PRIMARY)
add_para(doc, "Railway is the production runtime. All commands below assume the railway CLI is installed and logged in to the cheerful-connection project.")
add_bullet(doc, "Start. Railway re launches on push to main. No manual start command is required for normal operation.")
add_bullet(doc, "Stop. Railway dashboard, cheerful-connection, sam-telegram-bot, Stop. Or via CLI: railway service sam-telegram-bot then railway down.")
add_bullet(doc, "Redeploy after code change. git push to TRCMalta/sam-telegram-bot main. Railway auto deploys on push.")
add_bullet(doc, "View live logs: railway logs --deployment.")
add_bullet(doc, "Update an environment variable: railway variables --set KEY=VALUE then railway redeploy.")
add_bullet(doc, "Health check: curl https://sam-telegram-bot-production.up.railway.app/ should return a 200.")
add_bullet(doc, "Set Telegram webhook: GET /set-webhook from the deployed service. This calls the Telegram setWebhook endpoint with the current Railway domain.")

add_heading(doc, "9.2 Credential rotation", 2, PRIMARY)
add_bullet(doc, "Anthropic API key. Rotate annually or on suspected leak. Update ANTHROPIC_API_KEY and redeploy.")
add_bullet(doc, "Microsoft 365 client secret. Rotate per the Azure tenant policy (typically 12 to 24 months). Update MS_CLIENT_SECRET and redeploy.")
add_bullet(doc, "Firefish OAuth client secret. Rotate per the Firefish customer policy. Update FIREFISH_CLIENT_ID and FIREFISH_CLIENT_SECRET and redeploy.")
add_bullet(doc, "Odoo API key. Rotate when the Think Talent admin user rotates the key. Update ODOO_API_KEY and redeploy.")
add_bullet(doc, "WhatsApp long lived token. Rotate annually per Meta policy. Update WA_ACCESS_TOKEN and redeploy.")
add_bullet(doc, "Telegram bot token. Rotate via BotFather if a leak is suspected. Update TELEGRAM_TOKEN, redeploy, and re-register the webhook via GET /set-webhook.")
add_bullet(doc, "Groq and Brave keys. Rotate annually or on any suspected leak.")
add_bullet(doc, "Log each rotation in Section 13 of this SOP.")

add_heading(doc, "9.3 Adding a new tool to Sam", 2, PRIMARY)
add_bullet(doc, "Add the tool definition to the SAM_TOOLS array in server.js with a clear name, description, and input schema.")
add_bullet(doc, "Implement the handler in the tool dispatch switch in the message handler.")
add_bullet(doc, "If the tool produces an external side effect (send, post, write, transfer), wire it through the confirmation gate pattern used by send_beverly_email and create_beverly_calendar_event.")
add_bullet(doc, "Test locally with a real Anthropic key against a sandbox tenant where possible.")
add_bullet(doc, "Push to main. Railway redeploys. Verify the new tool with a Telegram or WhatsApp message that exercises it end to end.")
add_bullet(doc, "Update this SOP if the tool adds a new sub processor, a new data category, or a new outbound action surface.")

add_heading(doc, "9.4 Onboarding a new allowed user", 2, PRIMARY)
add_bullet(doc, "Telegram. Obtain the user's numeric Telegram user ID (not the username). Append the ID to ALLOWED_TELEGRAM_USERS and redeploy.")
add_bullet(doc, "WhatsApp. Append the user's WhatsApp number in E.164 format without the plus sign to ALLOWED_WA_NUMBERS and redeploy.")
add_bullet(doc, "Allowlist enforcement runs before any LLM call, so unauthorised senders cost nothing and never trigger a reply.")

add_heading(doc, "9.5 Incident response", 2, PRIMARY)
add_bullet(doc, "Symptom: Sam not responding. Action: railway logs, check service status. Common causes are Anthropic quota, Microsoft Graph 401 (rotate the client secret), Meta token expiry (rotate WA_ACCESS_TOKEN).")
add_bullet(doc, "Symptom: Sam sent an unintended email. Action: emails only send after explicit Beverly confirmation, so this implies confirmation was given in error. Recover the conversation from Railway logs, review with Beverly, and tighten any prompt drift in the confirmation gate.")
add_bullet(doc, "Symptom: a non allowlisted sender successfully reached Beverly. Action: verify allowlist environment variables are current. Verify the auth gate is firing in the logs. Rotate the bot token immediately if there is any sign of compromise.")
add_bullet(doc, "Symptom: secret leaked in the public repository. Action: rotate the leaked credential immediately. Force pushing to remove the secret from history is insufficient. Treat the secret as permanently compromised once published. Rotate, redeploy, and log the incident in Section 13.")
add_bullet(doc, "Symptom: Microsoft 365 reports unusual activity from the Sam app registration. Action: revoke the client secret via the Azure portal, redeploy with a new secret, review the last 30 days of sign in logs and audit logs for the app.")
add_bullet(doc, "Symptom: Odoo or Firefish 401 storm. Action: re authenticate via the tenant admin, rotate the relevant key, redeploy. Confirm read scopes have not been narrowed by the tenant operator.")

page_break(doc)

# =========================================================================
# 10. Audit log and retention
# =========================================================================
add_heading(doc, "10. Audit log and retention", 1, PRIMARY)
add_para(
    doc,
    "Sam is built with minimal records by design. The state of record for "
    "every consequential operation lives in the integrated systems (M365, "
    "Firefish, Odoo). Sam keeps only what is needed to operate, debug, and "
    "evidence human approval.",
)
add_table(
    doc,
    ["Record", "Location", "Retained", "Purpose"],
    [
        [
            "Telegram and WhatsApp chat history",
            "In process conversationHistory map. Cleared by LRU plus per-chat timeout. Wiped on Railway restart.",
            "Minutes to hours, never persisted",
            "Multi turn conversation context only",
        ],
        [
            "Tool call traces (which tool, parameters, summary of result)",
            "Railway stdout captured to Railway logs",
            "30 days default",
            "Operational debugging and audit",
        ],
        [
            "Confirmation prompts and Beverly's yes or no response",
            "Railway stdout",
            "30 days default",
            "Evidence of human in loop authorisation for every outbound action",
        ],
        [
            "Microsoft 365 mailbox and calendar (state of record)",
            "Microsoft 365, Beverly's tenant",
            "Per Beverly's mailbox retention policy",
            "Authoritative copy of all email and calendar activity",
        ],
        [
            "Firefish records",
            "Firefish tenant (Ceek)",
            "Per Firefish tenant policy",
            "Authoritative copy of recruitment data",
        ],
        [
            "Odoo records",
            "Think Talent tenant",
            "Per Odoo tenant policy",
            "Authoritative copy of CRM, products, events, and invoices",
        ],
        [
            "Source code",
            "GitHub TRCMalta/sam-telegram-bot (public)",
            "Indefinite, versioned in git",
            "Reproducibility and incident forensics",
        ],
        [
            "Environment variables",
            "Railway service settings",
            "Until rotated",
            "Runtime configuration and credentials",
        ],
        [
            "Model calls (prompt plus raw response)",
            "Not separately stored by Sam (in memory only)",
            "Not retained",
            "Privacy minimisation",
        ],
        [
            "This SOP",
            "Obsidian vault Claude/Reference and sam-telegram-bot/docs in git",
            "Indefinite (versioned)",
            "Governance artefact",
        ],
    ],
    col_widths=[4.5, 5.0, 3.0, 5.0],
)

page_break(doc)

# =========================================================================
# 11. Risk register
# =========================================================================
add_heading(doc, "11. Risk register", 1, PRIMARY)
add_table(
    doc,
    ["#", "Risk", "Likelihood", "Impact", "Mitigation", "Owner"],
    [
        [
            "R1",
            "Sam sends an email Beverly did not approve",
            "Very low",
            "High (reputational, possible legal effect)",
            "In chat confirmation gate on every send_beverly_email. Tool use loop capped at 10 iterations. Railway logs preserve the confirmation trace.",
            "Jonathan and Beverly",
        ],
        [
            "R2",
            "Sam books or cancels a calendar event in error",
            "Low",
            "Medium",
            "Same in chat confirmation gate. Calendar invitations are reversible (decline, reschedule, retract).",
            "Jonathan and Beverly",
        ],
        [
            "R3",
            "Credential leak via the public repository",
            "Low (process controlled)",
            "Very high",
            "No .env is committed. .gitignore enforces. Code review before every push. Quarterly audit of git history for accidental secret exposure. All secrets live in Railway environment variables only.",
            "Jonathan",
        ],
        [
            "R4",
            "Unauthorised sender bypasses the allowlist",
            "Very low",
            "High",
            "Allowlist check is the first action in both webhook handlers. Telegram and Meta provide authenticated sender identifiers.",
            "Jonathan",
        ],
        [
            "R5",
            "Microsoft Graph client secret compromised",
            "Low",
            "Very high",
            "Client secret rotated per Azure policy. Sign in logs reviewed quarterly. App permissions scoped to Beverly's mailbox only.",
            "Jonathan",
        ],
        [
            "R6",
            "LLM hallucination invents email content or CRM facts",
            "Low (mitigated by gate)",
            "Medium",
            "Confirmation gate means Beverly reads every word before any email is sent. System prompt forbids invented facts. Sam asks rather than fabricates when data is missing.",
            "Beverly (editorial control)",
        ],
        [
            "R7",
            "Service goes down at a critical moment",
            "Low",
            "Low",
            "Beverly retains all native channels (email, calendar, phone) and is not dependent on Sam. Recovery is a Railway redeploy on the next push.",
            "Jonathan",
        ],
        [
            "R8",
            "Public repository exposes architecture detail useful to an attacker",
            "Acknowledged trade off",
            "Low",
            "Architecture transparency is a positive for TRC. Security relies on credentials and allowlists, not on obscurity.",
            "Jonathan",
        ],
        [
            "R9",
            "Cross tenant data leak between Microsoft 365, Firefish, and Odoo",
            "Very low",
            "High",
            "Tools are scoped per tenant. No tool writes data from one system into another without Beverly's explicit instruction.",
            "Jonathan",
        ],
        [
            "R10",
            "Voice transcription leaks audio of sensitive conversation to Groq in the US",
            "Low",
            "Medium",
            "Beverly is briefed not to record sensitive third party conversations as voice notes for Sam. SCCs cover the Groq transfer.",
            "Beverly",
        ],
        [
            "R11",
            "Region pin (Railway US East Virginia) creates EU transfer exposure",
            "Acknowledged",
            "Low",
            "SCCs with Railway Corp. cover the transfer. Migration to a Railway EU region may be considered in v1.1. TBC, owner to decide.",
            "Jonathan",
        ],
        [
            "R12",
            "Operator endpoints (/debug, /test-scopes, /webhook-info) leak internal state",
            "Low",
            "Medium",
            "TBC, owner to confirm whether these endpoints should be moved behind a secret or removed in v1.1.",
            "Jonathan",
        ],
    ],
    col_widths=[1.0, 4.5, 2.0, 2.5, 5.5, 2.0],
)

page_break(doc)

# =========================================================================
# 12. Decommissioning
# =========================================================================
add_heading(doc, "12. Decommissioning procedure", 1, PRIMARY)
add_bullet(doc, "Step 1. Announce the stop date to Beverly. Provide a minimum of one week notice for any non emergency wind down.")
add_bullet(doc, "Step 2. Telegram. Delete the webhook with curl https://api.telegram.org/bot$TELEGRAM_TOKEN/deleteWebhook.")
add_bullet(doc, "Step 3. WhatsApp. Remove the webhook subscription in the Meta App Dashboard for the Sam app.")
add_bullet(doc, "Step 4. Microsoft 365. Revoke the client secret in the Azure portal so the Sam app registration can no longer call Microsoft Graph. Remove the app registration entirely if Sam is being retired permanently.")
add_bullet(doc, "Step 5. Firefish. Revoke the OAuth client.")
add_bullet(doc, "Step 6. Odoo. Rotate the Think Talent admin API key so the retired ODOO_API_KEY no longer authenticates.")
add_bullet(doc, "Step 7. Revoke the Anthropic, Groq, and Brave API keys.")
add_bullet(doc, "Step 8. Archive the Railway service. Do not delete it immediately because the logs are needed for the 30 day audit window. Delete after 30 days if appropriate.")
add_bullet(doc, "Step 9. Revoke the Telegram bot via BotFather (/deletebot) once the audit window closes.")
add_bullet(doc, "Step 10. Mark the project as archived in the Obsidian project note (01-Projects/AI-Chief-of-Staff.md and any Sam specific note) and move source notes to 08-Archive/ if the wider CoS programme is being retired.")
add_bullet(doc, "Step 11. Archive the GitHub repository. The repository may stay public for reference or be moved to a private archive organisation.")
add_bullet(doc, "Step 12. Append the decommissioning date and reason to Section 13 of this SOP. The final SOP version is stored alongside the archived service state in the Obsidian vault and in the repository.")

page_break(doc)

# =========================================================================
# 13. Document history
# =========================================================================
add_heading(doc, "13. Document history", 1, PRIMARY)
add_table(
    doc,
    ["Version", "Date", "Author", "Change"],
    [
        [
            "1.0",
            DOC_DATE,
            "Jonathan Cremona plus Claude (Anthropic)",
            "Initial SOP. Covers Sam as deployed on Railway service sam-telegram-bot (project cheerful-connection) with dual channel Telegram and WhatsApp, claude-sonnet-4-20250514, Microsoft Graph, Firefish, Odoo, Groq Whisper, and Brave Search integrations.",
        ],
    ],
    col_widths=[2.0, 3.0, 6.5, 6.0],
)

# =========================================================================
# 14. Acceptance and signature
# =========================================================================
add_heading(doc, "14. Acceptance and signature", 1, PRIMARY)
add_para(
    doc,
    "By signing below, the deployer confirms that Sam operates within the "
    "bounds described in this document, that the EU AI Act classification "
    "is supported by the operational facts, and that the GDPR position is "
    "accurate. Open TBC items listed below will be closed within the next "
    "review cycle.",
)
doc.add_paragraph()
add_para(doc, "Open TBC items at signature time:", bold=True)
add_bullet(doc, "Confirm whether GET /debug, GET /test-scopes, and GET /webhook-info should be moved behind a secret or removed in v1.1.")
add_bullet(doc, "Confirm whether Beverly's email signature should include an 'AI assisted' disclosure footer for Article 13/14 transparency.")
add_bullet(doc, "Decide whether to migrate the Railway region from US East (Virginia) to an EU region to remove the SCC dependency on Railway.")
add_bullet(doc, "Confirm the Microsoft 365 client secret rotation schedule set by the Azure tenant policy.")
add_bullet(doc, "Confirm the WhatsApp Cloud API display name approval status and the production phone number registration.")
add_bullet(doc, "Brief Beverly explicitly not to record sensitive third party voice notes for Sam (Groq US transfer exposure).")
add_bullet(doc, "Confirm Beverly's current corporate title for the next SOP revision (Chairman per the AI Chief of Staff playbook, COO per the deployed system prompt).")
doc.add_paragraph()
add_para(doc, "Signature: ___________________________________________", size=12)
add_para(doc, "Name: Jonathan Cremona", size=12)
add_para(doc, "Role: Deployer (sole proprietor, The Remarkable Collective, Malta)", size=12)
add_para(doc, "Date: ____________________", size=12)


# Safety net for TRC voice rules
assert_no_em_dashes(doc)


# Save
out1 = pathlib.Path.home() / "Documents" / "Obsidian" / "Claude" / "Reference" / "Sam-SOP-v1.0.docx"
out2 = pathlib.Path(__file__).parent / "SOP-v1.0.docx"
out1.parent.mkdir(parents=True, exist_ok=True)
out2.parent.mkdir(parents=True, exist_ok=True)
doc.save(out1)
doc.save(out2)
print(f"saved -> {out1}")
print(f"saved -> {out2}")
