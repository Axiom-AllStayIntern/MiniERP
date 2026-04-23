# Domain Modules

Business domain layer. Modules are the source of business truth and should be
independently understandable.

Target modules:
- `finance`
- `project`
- `hr`
- `document-intake`

Each module should eventually own:
- Contracts
- Workflows
- Services
- Rules
- Policies
- Schemas
- Repositories
- Adapters
- Capabilities
- Events
- Module config and manifest

Phase 1 does not move existing runtime code out of `src/lib/server/modules`.
This directory records the target boundaries and compatibility path.
