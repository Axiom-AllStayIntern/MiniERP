# Infrastructure Layer

Concrete technical adapters and external resource integrations live here.

Owns:
- Database client and ORM implementation
- Object storage implementation
- LLM provider implementation
- OCR provider implementation
- Email connector implementation
- Queue implementation
- Logging implementation
- Monitoring implementation

Does not own:
- Business rules
- Module contracts
- Product navigation
- Workflow semantics

Phase 3 starts moving concrete runtime implementations here behind compatibility
re-exports from legacy `src/lib/server` entrypoints.

Current Phase 3 scope includes the active DB client assembly and the schema
barrel under `src/infrastructure/db`, while legacy `src/lib/server/db`
entrypoints remain compatibility shells.
