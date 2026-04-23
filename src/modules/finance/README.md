# Finance Module Boundary

Finance is the first product-grade module boundary. It must become usable in
standalone mode and suite mode.

Target ownership:
- Expense and reimbursement flows
- Revenue and customer invoice flows
- Supplier invoice, receipt, purchase order, and finance document flows
- GST, tax, and profit reporting rules
- Finance task workflows
- Finance AI capabilities
- Finance workspace entry metadata

Current legacy subdomains:
- `src/lib/server/modules/ar`
- `src/lib/server/modules/expense`
- `src/lib/server/modules/tax`
- `src/lib/server/modules/reporting`

Integration rule:
- Project and HR context must be consumed through lookup adapters or public
  contracts, not by importing their repositories or schemas directly.
- `project_id` is an external enhancement by default. A specific workflow or
  tenant policy may make it required later.

Phase 1 keeps all legacy code in place and only establishes this umbrella
boundary for incremental migration.
