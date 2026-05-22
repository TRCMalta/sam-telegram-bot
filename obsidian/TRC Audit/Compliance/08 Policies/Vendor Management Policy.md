---
type: policy
status: draft
last_updated: 2026-05-22
review_cycle: annual
owner: Jonathan (Governor)
---

# Vendor Management Policy

Procedure for adding, reviewing, and removing third-party vendors that touch TRC personal data or critical operations.

## Adding a vendor

1. Document the proposed use case as a draft note in `Integrations/`.
2. Confirm the vendor's establishment country and onward sub-processors.
3. Sign a [[Data Processing Agreement|DPA]] under [[GDPR Article 28 - Processors|Article 28]] before any personal data flows.
4. If the vendor is outside EU/EEA, complete a Transfer Impact Assessment.
5. Add the vendor to `../05 Processors and DPAs/Register.md` and the Transfer Register.
6. Update affected ROPA entries.
7. Run [[Judge Dredd]] to refresh the audit artefacts.

## Annual review

- Re-confirm the DPA is current and not superseded.
- Re-confirm international-transfer safeguard.
- Re-confirm sub-processor list.
- Capture screenshots into `../Evidence/`.

## Removing a vendor

- Confirm all TRC personal data has been deleted or returned (Article 28(3)(g)).
- Mark the entry "retired" in the processor register.
- Update ROPAs.
