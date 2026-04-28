# SmartFin Modular Migration Phases

This document is the single phase plan for the SmartFin modular migration.

It keeps the migration aligned to:
- `代码架构设计.pdf` as the target architecture
- `SmartFin_Modular_Design_Principles.pdf` as the design constraint set

Non-negotiable rules:
- Keep the app runnable after every step
- Do not change schema or migrations during architecture phases
- Do not rewrite business formulas during boundary phases
- Prefer target-layer ownership and compatibility shells over big-bang moves
- Prioritize horizontal module coverage before deeper local optimization

## Finish Definition

The migration is complete only when all of the following are true:

1. Product-facing code enters the system through target layers:
   - `src/app`
   - `src/modules`
   - `src/platform`
   - `src/infrastructure`
2. Legacy runtime and business entrypoints under `src/lib/server` are either:
   - thin compatibility re-exports, or
   - removable without breaking callers
3. Routes, agents, and general server-side callers no longer depend on legacy
   subdomain internals or old runtime entrypoints.
4. Architecture report metrics remain green.
5. Legacy module implementations can be retired module by module.

## Stage Map

| Phase | Goal | Status |
| --- | --- | --- |
| Phase 1 | Boundary cleanup for routes and layouts | Completed |
| Phase 2 | Finance umbrella boundary and compatibility convergence | Completed |
| Phase 3 | Platform / infrastructure extraction into target layers | Completed |
| Phase 4 | Horizontal target-layer coverage for remaining business modules | Completed |
| Phase 5 | Internal ownership migration inside each target module | Completed |
| Phase 6 | Compatibility shell retirement and legacy cleanup | Completed |

## Phase 1

Goal:
- Stop route/layout layers from directly owning DB wiring or module internals

Completed outcomes:
- Route DB bridge debt reduced to 0
- Route internal module import debt reduced to 0
- Finance route entrypoints consolidated behind public APIs

Exit criteria:
- `check:architecture-report` green for route/layout metrics
- `npm.cmd run check` passes without new errors

## Phase 2

Goal:
- Build Finance as the first target-layer business boundary

Completed outcomes:
- Finance facade assembly moved into `src/modules/finance`
- Non-Finance callers no longer enter `ar / expense / tax / reporting`
  directly
- Finance compatibility shell reduced to a thin root-level entrypoint

Exit criteria:
- External Finance callers enter through Finance-owned APIs
- Finance legacy subdomains are internal-only from the outside

## Phase 3

Goal:
- Move shared runtime and DB assembly into `src/platform` and
  `src/infrastructure`

Completed outcomes:
- Active registry, context, events, config, DB client, and schema barrel live
  in target layers
- Legacy runtime and DB entrypoints reduced to compatibility shells
- Runtime and DB compatibility metrics are both at 0

Exit criteria:
- Target-layer runtime implementations are active
- Old runtime entrypoints remain thin and non-owning

## Phase 4

Goal:
- Achieve horizontal target-layer coverage for the remaining business module
  boundaries:
  - `src/modules/project`
  - `src/modules/hr`
  - `src/modules/document-intake`

Why this phase exists:
- Avoid over-investing in Finance before other module boundaries exist
- Ensure the migration progresses across the whole system, not only inside one
  module

Phase 4A scope:
- Create target-layer public entrypoints for Project, HR, and Document Intake
- Keep legacy `src/lib/server/modules/*` business entrypoints as compatibility
  re-exports
- Preserve current route and agent behavior

Phase 4B scope:
- Define clearer module-owned contract groupings where a legacy API currently
  exposes mixed concerns
- Keep HTTP/result-shape concerns in app adapters instead of pushing them into
  target modules

Current Phase 4 progress:
- Target-layer public entrypoints exist for Project, HR, and Document Intake
- First non-route callers have moved to target-layer imports
- Route adapters no longer import legacy Project/HR/Document Intake API
  entrypoints directly
- Legacy implementation coupling inside those target modules is now isolated to
  explicit `contracts.ts` / `adapters.ts` bridge files
- Remaining legacy business entrypoint debt is now concentrated in explicit
  deprecated shims

Phase 4 status:
- Phase 4 exit criteria are now satisfied.

Exit criteria:
- Project, HR, and Document Intake each have target-layer entrypoints
- Legacy business module entrypoints for those areas are compatibility-oriented
- Architecture report remains green and `npm.cmd run check` still passes

## Phase 5

Goal:
- Move real implementation ownership into each target module

Scope:
- Lift module composition and internal adapters out of legacy slices
- Gradually move legacy implementation ownership behind target-layer contracts
- Reduce remaining bridge-only files to small, explicit seams

Exit criteria:
- Each target module owns its own executable composition
- Legacy slices are implementation details only, or are ready for retirement

Current Phase 5 progress:
- Project, HR, and Document Intake now register module handlers from
  `src/modules/*/handlers.ts` instead of importing legacy handler files.
- Legacy handler files under `src/lib/server/modules/*/handlers.ts` have been
  reduced to compatibility re-exports.
- App startup now imports `src/platform/registry/register-all.ts` directly,
  while `src/lib/server/modules/register-all.ts` has been reduced to a
  compatibility side-effect shim.
- Architecture report now tracks `Phase 5 target legacy handler imports`; the
  current count is 0.

Phase 5 status:
- Phase 5 exit criteria are now satisfied.

## Phase 6

Goal:
- Retire compatibility shells and complete the migration

Scope:
- Remove temporary re-export layers
- Delete obsolete bridge files once callers are gone
- Finalize the target directory structure as the only supported architecture

Exit criteria:
- Compatibility shells are removable or removed
- Legacy module entrypoints no longer serve production callers
- The target architecture is the active architecture, not just the preferred
  one

Current Phase 6 progress:
- Added a report-only metric for legacy business compatibility entrypoint
  imports and fully reduced the count from 44 to 0.
- Added a report-only metric for deprecated server shim imports and fully
  reduced the count from 8 to 0.
- Retired the zero-caller compatibility entrypoints for Project, HR, and
  Document Intake by deleting the old `api.ts`, `index.ts`, and `handlers.ts`
  re-export shells under `src/lib/server/modules/*`.
- Moved the remaining route/API Finance callers to `src/modules/finance`
  imports, removing production pressure from `$lib/server/modules/finance`.
- Retired the remaining zero-caller Finance, registry bootstrap, audit, and
  deprecated helper shims once the architecture report reached all-zero
  compatibility metrics.

Phase 6 status:
- Phase 6 exit criteria are now satisfied.

## Current Execution Rule

From this point onward:
- Prefer retiring compatibility shells with the lowest caller counts first
- Do not keep deepening Finance internals unless it blocks compatibility
  retirement across the system
- Use report-only metrics to expose remaining debt before turning anything into
  a hard gate

## Post-Plan Alignment Track

The six-phase plan completed the boundary migration, but it did not guarantee
full internal topology alignment with `代码架构设计.pdf`.

Current internal-alignment rule:
- Treat `src/modules/finance` as the template module for third-layer
  convergence.
- Add internal subdirectories before moving ownership deeper:
  `app/`, `contracts/`, `workflows/`, `capabilities/`, `services/`, `rules/`,
  `policies/`, `schemas/`, `repositories/`, `adapters/`, `events/`, and
  `config/`.
- Keep root-level module entrypoints stable while introducing deeper target
  paths.
- Do not rewrite business logic while landing the directory skeleton.
- After Finance is stable, apply the same internal layering pattern to
  `src/modules/project`, `src/modules/hr`, and
  `src/modules/document-intake`.

Current status:
- `src/modules/finance` now uses the target third-layer directory shape.
- Finance public groups (`billing`, `documents`, `expenses`, `revenue`,
  `taxes`, `insights`) now execute from Finance-owned services/repositories.
- Finance root compatibility files have been retired; the module root now keeps
  `index.ts` plus documentation only.
- `src/modules/project` has now entered the same internal-alignment track:
  third-layer directories, manifest assembly, service assembly, action
  catalog, and handler registration now live under target-layer subdirectories
  while business implementation still remains in the legacy slice.
- Project target-owned read/runtime ownership has now started for low-risk
  paths: `getById`, `getWithCustomer`, `list`, `getListCounts`,
  `getProjectListPage`, `getProjectShell`, `getMembers`, and
  `getProjectFinancials`.
- The next module-internal alignment target after Project should move to
  `src/modules/hr`, then `src/modules/document-intake`.
