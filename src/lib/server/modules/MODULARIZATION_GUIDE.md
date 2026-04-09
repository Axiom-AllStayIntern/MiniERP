# SmartFin Modularization Guide

This guide defines the final boundary rules after modular refactor.

## Route Layer Rules

- `src/routes/**/+server.ts` and `src/routes/**/+page.server.ts` must not import `$lib/server/db`.
- Route handlers should only do:
  - request parsing
  - auth/permission checks
  - orchestration via module APIs
- Route handlers should create context with `createModuleContext(event)`.

## Module Layer Rules

- Module internals stay inside `src/lib/server/modules/<module>/`.
- Cross-module usage must go through `api.ts` and events.
- Event names must be declared in each module `events.ts`.

## Runtime Module Toggle

- Enabled modules are stored at `company_settings.modules.enabled`.
- Invalid dependency configuration falls back to full module set.
- Manage configuration via `GET/PUT /api/settings/modules`.

## Temporary Compatibility

- `src/lib/server/modules/legacy-db.ts` is a temporary bridge.
- Migration target is to remove all route imports of `legacy-db`.
- Deprecated wrappers under `src/lib/server/*.ts` should be removed after route migration.
