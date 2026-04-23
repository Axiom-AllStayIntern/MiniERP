# SmartFin Modular Architecture Migration Tracker

## Target Mapping

| Current area | Target layer | Phase 1 status |
| --- | --- | --- |
| `src/routes/(app)` and `src/routes/api` | `src/app` adapters | Keep in place; thin incrementally |
| `src/lib/components/workflow-panel` and `src/lib/workflow` | `src/app/ai-panel`, `src/app/task-mode`, `src/platform/workflow`, `src/platform/tasks` | Documented only |
| `src/lib/server/modules/ar`, `expense`, `tax`, `reporting` | `src/modules/finance` | Finance umbrella documented |
| `src/lib/server/modules/project` | `src/modules/project` | Future migration |
| `src/lib/server/modules/person`, `employee` | `src/modules/hr` | Future migration |
| `src/lib/server/document-intake` | `src/modules/document-intake` | Future migration |
| `src/lib/server/modules/registry`, `context`, `event-bus`, `enabled` | `src/platform/registry`, `events`, `config` | Contract types added |
| `src/lib/server/db`, `drizzle`, `workers` | `src/infrastructure/db`, `queue`, `ocr` | Future migration |

## Phase 1 Completion Criteria

- Target layer directories exist with explicit ownership docs.
- Platform contract types exist and can be mapped to the current registry.
- Finance umbrella boundary is documented.
- Architecture report command shows current boundary debt without failing CI.
- One read-only route uses a module public API instead of direct DB access.

## Phase 1 Current Baseline

Last verified with `npm.cmd run check:architecture-report`:

| Metric | Initial Phase 1 baseline | Current |
| --- | ---: | ---: |
| Hard-gated direct route DB imports | 0 | 0 |
| Legacy route DB bridge imports | 54 | 31 |
| Route imports of module internals | 6 | 0 |
| Layout direct DB imports | 0 | 0 |
| Layout legacy DB bridge imports | 0 | 0 |

Additional verification:

- `npm.cmd run check:modular-boundary` passes.
- `npm.cmd run check` passes with 0 errors and the existing 12 Svelte warnings.
- Migrated pilot plus follow-up read/write adapters keep route handlers as app adapters and move DB access behind public APIs for reporting, project shell/list/detail actions, project documents, project expenses/revenue, customers, and tax summaries/settings.

## Prohibited During Phase 1

- No schema or migration changes.
- No business formula rewrites.
- No full module moves.
- No deletion of `legacy-db`.
- No hard CI failure for existing architecture debt beyond the current hard gate.

## Next Migration Order

1. Project HR pages: migrate `projects/[id]/employees` and `projects/[id]/employees/[peId]` as a dedicated mini-phase because they combine roster, allocation, staff-cost settlement, and component writes.
2. Expense app pages: migrate global expenses/reimbursements/upload routes behind `ExpenseApi`.
3. Document Hub and intake APIs: isolate upload/OCR/save/status flows behind Document Intake and Platform file contracts before moving code.
4. Invoice file APIs: move `api/invoices/out/*` preview/PDF/import-line routes behind AR public APIs.
5. Collapse AR, Expense, Tax, and Reporting into a formal Finance public boundary once the route debt is low enough.
6. Move platform and infrastructure implementations after compatibility wrappers exist.
