# Infrastructure DB

This directory owns the active target-layer DB assembly during Phase 3.

Owns:
- `getDb(env)` runtime construction
- `DBClient` type export
- Target-layer schema barrel assembly

Compatibility boundary:
- `src/infrastructure/db/index.ts` re-exports this layer for legacy callers
- `src/infrastructure/db/schema.ts` re-exports the schema barrel for legacy callers

Does not own:
- Business repository logic
- Route-level ORM access
- Module-specific business rules
