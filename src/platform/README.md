# Platform Layer

Cross-module runtime capabilities live here.

Owns:
- Auth and identity abstraction
- Permission and RBAC abstraction
- Module registry
- Workflow runtime
- Task runtime
- AI runtime abstraction
- File abstraction
- Event bus
- Audit abstraction
- Platform config and policies
- Lookup/read-model abstraction
- Notification abstraction

Does not own:
- Finance rules
- Project rules
- HR rules
- Document Intake classification semantics

Phase 3 starts moving active runtime implementations here behind compatibility
re-exports from `src/modules/legacy/server-modules`.
