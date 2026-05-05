# HR Module Boundary

HR is a target-layer business boundary introduced during Phase 4.

Target ownership:
- Employee directory and profile flows
- Compensation, allocation, and settlement orchestration
- Person and role-facing identity access used by HR workflows
- Project staffing-facing HR entrypoints

Current legacy implementation slices:
- `src/modules/legacy/server-modules/employee`
- `src/modules/legacy/server-modules/person`

Phase 4 bridge status:
- Target-layer public entrypoints now live under `src/modules/hr`.
- Employee/person handler registration now lives under `src/modules/hr/handlers.ts`.
- The former compatibility entrypoints under
  `src/modules/legacy/server-modules/{employee,person}/{api,index,handlers}.ts` have been
  retired after their caller count reached zero.
- Internal ownership still remains in the legacy slices; Phase 4 only moves the
  public assembly boundary and defines the HR umbrella.
- Legacy coupling inside this target module is intentionally isolated to
  `contracts.ts`, `adapters.ts`, and `compat.ts`.
