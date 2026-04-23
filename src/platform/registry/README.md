# Platform Registry Contracts

The registry is the platform mechanism that lets modules describe what they
provide without hard-coding product composition in the app shell.

Phase 1 introduces contract types only. The existing runtime registry at
`src/lib/server/modules/registry.ts` remains the active implementation.
