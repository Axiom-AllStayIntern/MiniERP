# Document Intake Module Boundary

Document Intake is a target-layer feature module boundary introduced during
Phase 4.

Target ownership:
- Upload and intake orchestration
- OCR confirmation and document status flows
- Doc Hub save / confirm workflows

Current legacy implementation slices:
- `src/lib/server/modules/document-intake`
- `src/lib/server/document-intake`

Phase 4 bridge status:
- Public API assembly now lives under `src/modules/document-intake`.
- Event handler registration now lives under `src/modules/document-intake/handlers.ts`.
- The former compatibility entrypoints under
  `src/lib/server/modules/document-intake/{api,index,handlers}.ts` have been
  retired after their caller count reached zero.
- OCR and extractor implementations remain in their legacy locations until a
  later internal-ownership phase.
- Legacy coupling inside this target module is intentionally isolated to
  `contracts.ts` and `adapters.ts`.
