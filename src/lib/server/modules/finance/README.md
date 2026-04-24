# Finance Module Facade

This directory is the route-facing public facade for the target Finance umbrella.
At this stage it is intentionally a thin compatibility shell.

Current runtime implementations still live in `ar`, `expense`, `tax`, and `reporting`.
Routes should prefer `createFinanceApi(ctx)` so the route layer depends on a stable
Finance boundary instead of individual finance subdomains. Route imports should enter
through `$lib/server/modules/finance` rather than deep-linking `finance/api`.

Current public groups:

- `documents`: contract / quotation / purchase order / supplier invoice doc-hub and detail flows
- `billing`: customer invoice flows and project billing totals
- `expenses`: expense pages, uploads, and business-trip flows
- `revenue`: project revenue record pages and detail flows
- `taxes`: GST / corporate / individual tax queries and settings
- `insights`: dashboard, project finance overview, and reporting read models

Phase rules:

- Do not move schemas or repositories here yet.
- Do not rewrite formulas while adopting the facade.
- Keep subdomain APIs available for module-internal compatibility behind this facade.
- Keep routes as adapters: parse HTTP/page input, call Finance API, map response.
- Keep agent and query entrypoints on the Finance root export instead of importing
  `ar`, `expense`, `tax`, or `reporting` directly.
- Use `finance/compat` for temporary helper re-exports that still need a stable
  Finance-owned compatibility path.
- Keep this compatibility layer small: prefer `index.ts`, `api.ts`, and
  `compat.ts` only, instead of reintroducing per-group facade files here.
