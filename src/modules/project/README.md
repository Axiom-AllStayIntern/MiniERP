# Project Module Boundary

Project is a target-layer business module boundary introduced during Phase 4.

Target ownership:
- Project list and detail composition
- Project membership and staffing-facing orchestration
- Project summary and profitability-facing read models
- Project agent metadata and route-facing entrypoints

Current legacy implementation slices:
- `src/lib/server/modules/project`

Phase 4 bridge status:
- Public API assembly now lives under `src/modules/project`.
- Event handler registration now lives under `src/modules/project/handlers.ts`.
- The former compatibility entrypoints under
  `src/lib/server/modules/project/{api,index,handlers}.ts` have been retired
  after their caller count reached zero.
- Business logic and repository ownership still remain in the legacy slice for
  now; Phase 4 only moves the public assembly boundary.
- Legacy coupling inside this target module is intentionally isolated to
  `contracts.ts` and `adapters.ts`.
