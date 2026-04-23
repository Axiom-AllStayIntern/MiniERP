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

Phase 1 keeps existing infrastructure code in place and documents the target
extraction boundary.
