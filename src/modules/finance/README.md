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

Current bridge status:
- Executable Finance facade assembly now lives under this target directory.
- `src/lib/server/modules/finance` remains as the compatibility entrypoint for
  existing callers while migration continues.
- The compatibility shell has been reduced to root-level entrypoints rather than
  mirroring per-group Finance files under `src/lib/server/modules/finance`.

Phase 2 focus:
- Consolidate external Finance entrypoints so routes, agent domains, and query
  handlers all consume Finance instead of legacy finance submodules.
- Keep `ar`, `expense`, `tax`, and `reporting` as internal implementation slices
  until their internals can be lifted safely.
- Route helper-style compatibility exports through `finance/compat` instead of
  exposing `expense/repository` or `tax/service` directly to outside callers.
- Keep raw legacy API coupling isolated to `contracts.ts` and `adapters.ts`
  rather than spreading legacy types across Finance group files.
