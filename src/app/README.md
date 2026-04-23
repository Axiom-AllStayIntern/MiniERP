# App Layer

Product composition and user experience layer.

Owns:
- Workspace entry shells
- Task mode presentation
- AI panel presentation
- Dashboard presentation
- Navigation composition
- Role-based entry routing

Does not own:
- Business rules
- Workflow runtime
- Direct database access
- Module internals

Current SvelteKit routes remain in `src/routes` during Phase 1. This directory
is the target home for app-layer code once routes are thinned and extracted.
