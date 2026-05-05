# Platform Registry Contracts

The registry is the platform mechanism that lets modules describe what they
provide without hard-coding product composition in the app shell.

Phase 3 moves the active runtime registry into this target directory while
`src/modules/legacy/server-modules/registry.ts` remains as a compatibility re-export.

Phase 5 moved the active startup bootstrap import into
`src/platform/registry/register-all.ts`.

The former `src/modules/legacy/server-modules/register-all.ts` compatibility side-effect
shim was retired in Phase 6 after its caller count reached zero.
