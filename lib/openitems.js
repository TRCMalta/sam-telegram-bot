/**
 * lib/openitems.js — commitments, decisions and relationships.
 *
 * The chief-of-staff blueprint calls this out as core, and Sam had none of it.
 * Without it he can answer "what's in the pipeline" but not "what did I promise
 * Jonathan last week" — which is the question a real chief of staff exists to
 * answer.
 *
 * Three record types share one table, distinguished by `kind`, so the proactive
 * layer can chase commitments without nagging about decisions:
 *   commitment — something Beverly owes someone, or someone owes her
 *   decision   — a call she made, kept for the reasoning rather than the action
 *   followup   — a soft intention with no hard promise attached
 */
import { q, dbAvailable } from "./db.js";

export const ITEM_KINDS = ["commitment", "decision", "followup"];
export const ITEM_STATUSES = ["open", "done", "dropped"];

export async function createItem({
  title, kind = "commitment", detail = null, counterparty = null,
  owner = "beverly", dueDate = null, source = "chat",
}) {
  if (!ITEM_KINDS.includes(kind)) kind = "commitment";
  const r = await q(
    `INSERT INTO open_items (kind, title, detail, counterparty, owner, due_date, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [kind, title, detail, counterparty, owner, dueDate, source],
  );
  const item = r && r.rows.length ? r.rows[0] : null;
  // A commitment to a named person is also a contact touch.
  if (item && counterparty) await touchRelationship(counterparty);
  return item;
}

export async function listItems({
  status = "open", kind = null, counterparty = null, overdueOnly = false, limit = 50,
} = {}) {
  const where = [];
  const params = [];
  if (status)       { params.push(status);       where.push(`status = $${params.length}`); }
  if (kind)         { params.push(kind);         where.push(`kind = $${params.length}`); }
  if (counterparty) { params.push(`%${counterparty}%`); where.push(`counterparty ILIKE $${params.length}`); }
  if (overdueOnly)  { where.push("due_date IS NOT NULL AND due_date < CURRENT_DATE"); }
  params.push(limit);
  const r = await q(
    `SELECT * FROM open_items ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY (due_date IS NULL), due_date ASC, created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return r ? r.rows : [];
}

export async function updateItem(id, { title, detail, dueDate, counterparty, status }) {
  const r = await q(
    `UPDATE open_items SET
       title = COALESCE($2, title),
       detail = COALESCE($3, detail),
       due_date = COALESCE($4, due_date),
       counterparty = COALESCE($5, counterparty),
       status = COALESCE($6, status),
       closed_at = CASE WHEN $6 IN ('done','dropped') THEN now() ELSE closed_at END,
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, title, detail, dueDate, counterparty, status],
  );
  return r && r.rows.length ? r.rows[0] : null;
}

export async function closeItem(id, status = "done") {
  if (!["done", "dropped"].includes(status)) status = "done";
  return updateItem(id, { status });
}

/** Items due soon or already overdue — the proactive layer's chase list. */
export async function dueSoon({ withinDays = 3 } = {}) {
  const r = await q(
    `SELECT * FROM open_items
     WHERE status = 'open' AND kind IN ('commitment','followup')
       AND due_date IS NOT NULL
       AND due_date <= CURRENT_DATE + ($1 || ' days')::interval
     ORDER BY due_date ASC`,
    [String(withinDays)],
  );
  return r ? r.rows : [];
}

export async function markChased(ids) {
  if (!ids.length) return;
  await q("UPDATE open_items SET last_chased_at = now() WHERE id = ANY($1::bigint[])", [ids]);
}

// ─── Relationships ───────────────────────────────────────────────────────────

/**
 * Record that Beverly has been in touch with someone.
 *
 * Called whenever a person surfaces in a commitment or is explicitly logged.
 * The point is not a CRM — it is catching the relationship that has quietly
 * gone cold, which is a blind spot no calendar surfaces.
 */
export async function touchRelationship(name, { org = null, role = null, cadenceDays = null, notes = null, at = null } = {}) {
  const r = await q(
    `INSERT INTO relationships (name, org, role, cadence_days, notes, last_contact_at, updated_at)
     VALUES ($1,$2,$3,$4,$5, COALESCE($6, now()), now())
     ON CONFLICT (name) DO UPDATE SET
       org = COALESCE(EXCLUDED.org, relationships.org),
       role = COALESCE(EXCLUDED.role, relationships.role),
       cadence_days = COALESCE(EXCLUDED.cadence_days, relationships.cadence_days),
       notes = COALESCE(EXCLUDED.notes, relationships.notes),
       last_contact_at = GREATEST(EXCLUDED.last_contact_at, relationships.last_contact_at),
       updated_at = now()
     RETURNING *`,
    [name.trim(), org, role, cadenceDays, notes, at],
  );
  return r && r.rows.length ? r.rows[0] : null;
}

export async function listRelationships({ limit = 100 } = {}) {
  const r = await q("SELECT * FROM relationships ORDER BY last_contact_at DESC NULLS LAST LIMIT $1", [limit]);
  return r ? r.rows : [];
}

/**
 * People Beverly has drifted from.
 *
 * Only flags contacts with an explicit cadence — otherwise every name ever
 * mentioned becomes an alert, and the alerts stop meaning anything.
 */
export async function staleRelationships({ defaultCadenceDays = null } = {}) {
  const r = await q(
    `SELECT *,
            EXTRACT(DAY FROM now() - last_contact_at)::int AS days_since
     FROM relationships
     WHERE cadence_days IS NOT NULL
       AND last_contact_at IS NOT NULL
       AND last_contact_at < now() - (cadence_days || ' days')::interval
       AND (last_alerted_at IS NULL OR last_alerted_at < now() - interval '7 days')
     ORDER BY days_since DESC`,
    [],
  );
  if (r) return r.rows;
  return [];
}

export async function markRelationshipsAlerted(names) {
  if (!names.length) return;
  await q("UPDATE relationships SET last_alerted_at = now() WHERE name = ANY($1::text[])", [names]);
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatItems(items, { heading = "Open items" } = {}) {
  if (!items.length) return "Nothing open.";
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`*${heading}* (${items.length})`, ""];
  for (const i of items) {
    const due = i.due_date ? new Date(i.due_date).toISOString().slice(0, 10) : null;
    const overdue = due && due < today;
    const bits = [`• ${i.title}`];
    if (i.counterparty) bits.push(`— ${i.counterparty}`);
    if (due) bits.push(overdue ? `⚠ overdue ${due}` : `(due ${due})`);
    lines.push(bits.join(" "));
    if (i.detail) lines.push(`   ${i.detail}`);
  }
  return lines.join("\n");
}

export function dbBackedOrNull() {
  return dbAvailable();
}
