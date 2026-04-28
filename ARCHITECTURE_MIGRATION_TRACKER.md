# SmartFin Modular Architecture Migration Tracker

## Target Mapping

Detailed stage sequencing now lives in `MODULAR_MIGRATION_PHASES.md`.

| Current area | Target layer | Phase 1 status |
| --- | --- | --- |
| `src/routes/(app)` and `src/routes/api` | `src/app` adapters | Keep in place; thin incrementally |
| `src/lib/components/workflow-panel` and `src/lib/workflow` | `src/app/ai-panel`, `src/app/task-mode`, `src/platform/workflow`, `src/platform/tasks` | Documented only |
| `src/lib/server/modules/ar`, `expense`, `tax`, `reporting` | `src/modules/finance` | Finance umbrella documented |
| `src/lib/server/modules/project` | `src/modules/project` | Phase 4 public entrypoint added |
| `src/lib/server/modules/person`, `employee` | `src/modules/hr` | Phase 4 public entrypoint added |
| `src/lib/server/document-intake` | `src/modules/document-intake` | Phase 4 public entrypoint added |
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
| Legacy route DB bridge imports | 54 | 0 |
| Route imports of module internals | 6 | 0 |
| Route direct Finance subdomain API imports | 39 | 0 |
| Agent direct Finance subdomain imports | 4 | 0 |
| Other direct Finance subdomain imports | 2 | 0 |
| Finance target non-bridge legacy imports | 7 | 0 |
| Legacy runtime entrypoint imports | 10 | 0 |
| Legacy DB compatibility imports | 5 | 0 |
| Route direct Project/HR/Document Intake legacy API imports | 22 | 0 |
| Phase 4 target non-bridge legacy imports | 7 | 0 |
| Phase 5 target legacy handler imports | 4 | 0 |
| Legacy module bootstrap imports | 1 | 0 |
| Legacy business compatibility entrypoint imports | 44 | 0 |
| Deprecated server shim imports | 8 | 0 |
| Layout direct DB imports | 0 | 0 |
| Layout legacy DB bridge imports | 0 | 0 |

Additional verification:

- `npm.cmd run check:modular-boundary` passes.
- `npm.cmd run check` passes with 0 errors and the existing 12 Svelte warnings.
- Migrated pilot plus follow-up read/write adapters keep route handlers as app adapters and move DB access behind public APIs for reporting, project shell/list/detail actions, project documents, project expenses/revenue, project staffing, employee master pages, Finance Doc Hub pages, global expenses, business trips, document status/OCR status, document upload/confirm/intake save flows, customer invoice preview/PDF/import-line APIs, guarded AR/Expense upload APIs, customers, and tax summaries/settings.
- Added the Finance umbrella facade at `src/lib/server/modules/finance`; route callers now enter Finance through stable groups (`documents`, `billing`, `expenses`, `revenue`, `taxes`, `insights`) instead of directly importing finance subdomain APIs.
- Split the Finance facade into grouped internal files and standardized route imports on the `src/lib/server/modules/finance` root export rather than `finance/api`.
- Moved Finance facade assembly into `src/modules/finance` and left `src/lib/server/modules/finance` as a compatibility shell.
- Consolidated agent query/domain callers behind Finance exports so agent entrypoints no longer import `ar`, `expense`, `tax`, or `reporting` directly.
- Routed legacy helper shims through `finance/compat`, removing the remaining non-route external imports of `expense/repository` and `tax/service`.
- Reduced `src/lib/server/modules/finance` to thin root-level compatibility entrypoints instead of mirroring grouped Finance files there.
- Introduced explicit internal Finance contracts/adapters so target-layer group files no longer depend directly on legacy subdomain API types.
- Added a Phase 2C report metric for non-bridge legacy imports inside `src/modules/finance`; the current target-layer count is 0.
- Started Phase 3A by moving active registry, event bus, context, config, and DB implementations into `src/platform` and `src/infrastructure`, while keeping legacy imports on compatibility re-exports.
- Added a Phase 3 report metric for legacy runtime entrypoint imports and reduced it from 10 to 0 by moving the first caller batch to target-layer runtime paths.
- Added a Phase 3 report metric for legacy DB compatibility imports and reduced it from 5 to 0 by moving remaining `legacy-db` and `db/schema` callers to `src/infrastructure/db`.
- Moved the active schema barrel assembly into `src/infrastructure/db/schema.ts` and reduced `src/lib/server/db/schema.ts` to a compatibility re-export.
- Moved active module bootstrap registration into `src/platform/registry/register-all.ts` and reduced `src/lib/server/modules/register-all.ts` to a compatibility side-effect shim.
- Retired the remaining zero-caller Finance, audit, bootstrap, and deprecated
  helper compatibility shells after the Phase 6 metrics reached zero.

## Phase 2 Goal: Finance Internal Convergence

Phase 2 keeps the app runnable while moving Finance from a compatibility facade
to a true target-layer module.

Phase 2 objectives:

- Make Finance the single public entrypoint for routes, query handlers, and
  agent/domain integrations.
- Keep `ar`, `expense`, `tax`, and `reporting` as internal implementation slices
  behind Finance until their internals can be lifted safely.
- Move executable composition and compatibility bridges into `src/modules/finance`
  while preserving the existing runtime behavior.
- Add report-only metrics for any remaining direct imports of finance legacy
  subdomains from outside Finance.

Phase 2 exit criteria:

- Non-Finance callers enter Finance through Finance-owned entrypoints, not
  through `ar`, `expense`, `tax`, or `reporting`.
- Former compatibility entrypoints under `src/lib/server/modules/finance` are
  removable and were later retired once caller count reached zero.
- Architecture report remains green and `npm.cmd run check` still passes.
- Business rules, formulas, schema, and migrations remain unchanged.

## Phase 2 Status

Phase 2 exit criteria are now satisfied.

- Non-Finance callers enter Finance through Finance-owned entrypoints.
- The former `src/lib/server/modules/finance` compatibility entrypoints were
  later retired once no production callers remained.
- Architecture report is green and `npm.cmd run check` passes.
- No business formulas, schema, or migrations were changed.

## Phase 3 Goal: Platform / Infrastructure Compatibility Extraction

Phase 3 moves shared runtime mechanisms into target-layer directories while
keeping all existing imports working through compatibility re-exports.

Phase 3 objectives:

- Move active registry, event bus, context, config, and DB implementations into
  `src/platform` and `src/infrastructure`.
- Keep legacy entrypoints in `src/lib/server` and `src/lib/server/modules` as
  thin re-exports during the transition.
- Avoid caller churn while the target-layer runtime becomes the active
  implementation.

Phase 3 exit criteria:

- Active implementations for registry, events, context, config, and DB live in
  target directories.
- Legacy entrypoints for those runtime mechanisms are thin compatibility shells.
- Architecture report remains green and `npm.cmd run check` still passes.
- No schema, workflow, or business-rule changes are introduced.

## Phase 3 Status

Phase 3 exit criteria are now satisfied.

- Active implementations for registry, events, context, config, and DB now live
  in `src/platform` and `src/infrastructure`.
- The active schema barrel is now assembled under `src/infrastructure/db`
  instead of `src/lib/server/db`.
- Report-only metrics now cover both legacy runtime entrypoint imports and
  legacy DB compatibility imports; both counts are currently 0.
- Safe caller migrations have moved direct imports to target-layer runtime paths
  without changing business logic or schema behavior.
- Legacy runtime and DB entrypoints now exist as thin compatibility shells,
  without external caller debt outside those bridge files.

## Phase 4 Goal: Contract Hardening Above Compatibility Facades

Phase 4 keeps the current target-layer ownership while reducing compatibility-
style API surfaces that still mirror legacy HTTP/result shapes.

Phase 4 objectives:

- Replace compatibility-style result wrappers with clearer module/domain
  contracts where safe.
- Preserve route behavior while tightening app-adapter to module-contract
  boundaries.
- Keep Finance, platform, and infrastructure target layers stable while
  expanding the same migration pattern to other modules.

Phase 4 exit criteria:

- New module-facing contracts are explicit and no longer just pass-through
  wrappers around legacy shapes.
- Route adapters remain thin and continue to avoid direct DB wiring.
- Architecture report remains green and `npm.cmd run check` still passes.
- No schema, workflow, or business-rule changes are introduced.

## Phase 4 Status

Phase 4 exit criteria are now satisfied.

- Added the consolidated phase plan in `MODULAR_MIGRATION_PHASES.md`.
- Added target-layer public entrypoints for:
  - `src/modules/project`
  - `src/modules/hr`
  - `src/modules/document-intake`
- Reduced legacy business module public assembly under
  `src/lib/server/modules/project`, `employee`, `person`, and
  `document-intake` to compatibility re-exports.
- Moved the first non-route caller batch to target-layer imports:
  - `src/lib/server/agent/query-handlers.ts`
  - `src/lib/server/agent/domains/project-agent.ts`
  - `src/lib/server/agent/domains/employee-agent.ts`
  - `src/lib/server/document-intake/pipeline.ts`
- Added a Phase 4 report metric for route imports of legacy Project/HR/Document
  Intake APIs and reduced it from 22 to 0 by moving route adapters onto
  `src/modules/project`, `src/modules/hr`, and `src/modules/document-intake`.
- Added `contracts.ts` and `adapters.ts` bridge files inside Project, HR, and
  Document Intake target modules so legacy service/handler coupling is isolated
  to explicit bridge files.
- Added a Phase 4 report metric for target-layer non-bridge legacy imports and
  reduced it from 7 to 0.
- Moved explicit deprecated HR shims into `src/modules/hr/compat.ts` and
  reduced old top-level shim files to pure compatibility re-exports.
- Moved Project, HR, and Document Intake handler registration into
  `src/modules/*/handlers.ts` and reduced legacy handler files to compatibility
  re-exports.
- Added a Phase 5 report metric for target-layer legacy handler imports and
  reduced it from 4 to 0.
- Remaining old business module entrypoint imports are now concentrated in a
  few explicit compatibility wrappers rather than route adapters.
- `npm.cmd run check:architecture-report` remains green.
- `npm.cmd run check` still passes with 0 errors and the existing 12 Svelte
  warnings.

## Phase 5 Goal: Internal Ownership Migration Inside Target Modules

Phase 5 moves runtime ownership deeper into target modules without attempting a
big-bang rewrite.

Phase 5 objectives:

- Pull handler registration and small executable seams into target-layer
  modules before moving larger service/repository slices.
- Keep legacy service and repository dependencies isolated to explicit adapter
  files while target modules take ownership of composition.
- Continue horizontal progress across Project, HR, Document Intake, and Finance
  rather than deep-diving one module at a time.

Phase 5 exit criteria:

- Target modules own handler registration and executable composition seams.
- Remaining legacy dependencies are isolated to explicit bridge files.
- Architecture report remains green and `npm.cmd run check` still passes.
- No schema, workflow, or business-rule changes are introduced.

## Phase 5 Status

Phase 5 exit criteria are now satisfied.

- Project, HR, and Document Intake now register handlers from target-layer
  files under `src/modules/*/handlers.ts`.
- Legacy handler files under `src/lib/server/modules/*/handlers.ts` are thin
  compatibility re-exports.
- App startup now imports `src/platform/registry/register-all.ts` directly
  instead of bootstrapping through the legacy `src/lib/server/modules/register-all.ts`
  entrypoint.
- Architecture report is green, including the new legacy module bootstrap
  metric at 0.
- Architecture report is green, including the new Phase 5 handler-import
  metric at 0.
- `npm.cmd run check` still passes with 0 errors and the existing 12 Svelte
  warnings.

## Phase 6 Goal: Compatibility Shell Retirement and Legacy Cleanup

Phase 6 removes compatibility layers once caller pressure is low enough to do
so safely.

Phase 6 objectives:

- Quantify remaining imports of business compatibility entrypoints and
  deprecated top-level shims before deleting anything.
- Retire unused compatibility entrypoints first, then reduce high-traffic
  compatibility shells such as Finance and audit helpers.
- Keep the architecture report green while shrinking the number of production
  callers that depend on compatibility paths.

Phase 6 exit criteria:

- Compatibility shells are removable or removed.
- Legacy module entrypoints no longer serve production callers.
- Architecture report remains green and `npm.cmd run check` still passes.
- No schema, workflow, or business-rule changes are introduced.

## Phase 6 Status

Phase 6 exit criteria are now satisfied.

- Added a Phase 6 report metric for legacy business compatibility entrypoint
  imports and established a first baseline of 44.
- Reduced that compatibility-import count from 44 to 0 by moving the remaining
  Finance route/API callers to target-layer imports and then deleting the
  zero-caller compatibility entrypoints.
- Retired the zero-caller compatibility entrypoints for Project, HR, and
  Document Intake by deleting their old `api.ts`, `index.ts`, and `handlers.ts`
  re-export shells under `src/lib/server/modules/*`.
- Added a Phase 6 report metric for deprecated server shim imports and reduced
  it from 8 to 0 by replacing route-level audit shim usage and retiring the
  remaining zero-caller top-level helper shims.
- Retired the final zero-caller compatibility shells for Finance facade
  entrypoints, startup bootstrap, audit logging, and deprecated helper bridges.
- `npm.cmd run check:architecture-report` remains green.
- `npm.cmd run check` still passes with 0 errors and the existing 12 Svelte
  warnings.

## Prohibited During Phase 1

- No schema or migration changes.
- No business formula rewrites.
- No full module moves.
- No deletion of `legacy-db`.
- No hard CI failure for existing architecture debt beyond the current hard gate.

## Post-Plan Follow-Up

The six-phase migration plan is now complete.

Any further work should be treated as optional internal ownership cleanup rather
than a continuation of the boundary-migration plan.

The first follow-up target is Finance internal topology alignment:

- Land third-layer directories under `src/modules/finance`:
  `app/`, `contracts/`, `workflows/`, `capabilities/`, `services/`, `rules/`,
  `policies/`, `schemas/`, `repositories/`, `adapters/`, `events/`, and
  `config/`.
- Keep existing root-level Finance entrypoints stable as thin target-module
  re-exports during the transition.
- Use Finance as the template before applying the same internal layering
  pattern to Project, HR, and Document Intake.

Current follow-up status:

- Finance third-layer directories are now landed under `src/modules/finance`.
- Finance public runtime ownership for `billing`, `documents`, `expenses`,
  `revenue`, `taxes`, and `insights` now runs from Finance-owned services and
  repositories.
- Finance helper and compatibility entrypoints (`compat.ts`,
  `adapters/legacy.ts`, `adapters/compat.ts`) have been retired.
- Finance agent action catalogs now live in
  `src/modules/finance/capabilities/agent-actions.ts` instead of importing the
  legacy module root entrypoints.
- Project has now started the same internal-topology alignment track:
  target-layer subdirectories for `app`, `contracts`, `workflows`,
  `capabilities`, `services`, `rules`, `policies`, `schemas`, `repositories`,
  `adapters`, `events`, and `config` are now landed under
  `src/modules/project`, while legacy business implementation remains behind
  `contracts/source.ts` and `adapters/legacy.ts`.
- Project target-owned runtime ownership has now started for low-risk read
  paths: `getById`, `getWithCustomer`, `list`, `getListCounts`,
  `getProjectListPage`, `getProjectShell`, `getMembers`, and
  `getProjectFinancials`.
- The next internal-topology alignment target after Project should move to HR,
  then Document Intake.
