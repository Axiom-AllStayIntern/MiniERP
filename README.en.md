# SmartFin

[简体中文](./README.md) | [English](./README.en.md)

SmartFin is a financial operations platform for Singapore SMEs: AR documents and invoicing, project-centric profitability and cost, people, and tax summaries. The codebase has completed a **server-side modular refactor**: domains are split into modules, route handlers orchestrate via module APIs, and an optional module toggle applies at runtime.

---

## 1. Core capabilities

- **AR**: Document upload (including ZIP batch), OCR/LLM classification and extraction, customer/supplier documents and project archival
- **Customer invoices**: Draft save and re-edit, A4 preview, text-based PDF generation and optional storage (R2)
- **Projects**: Project detail; contracts, quotations, purchase orders, inbound/outbound invoices, members, expenses; project profit views
- **Employees**: List and detail (aligned with person / project membership); individual tax UI and APIs
- **Tax**: GST quarterly views; Corporate / Individual Tax summary APIs and pages
- **Reporting & dashboard**: Dashboard KPIs, project profit reports and export
- **AI Agent (v2)**:
  - Global chat entry (floating dialog at bottom-right)
  - **Two-layer Agent architecture**: Router Agent (intent classification) → Domain Agent (action selection)
  - Supports `query` / `action` / `chat` intent types
  - **Query type returns data directly**: e.g. project profit, project list, displayed as structured cards
  - Actions filtered by user role
  - Page navigation with form prefill (supports date parsing, dropdown matching)
  - **Follow-up mode**: maintains context for continuous conversation
  - Project pages auto-inject `project_id` / `project_name` context
- **OCR enhancements**:
  - **Workers AI Vision**: Llama 3.2 Vision model for image/scanned PDF OCR
  - **PaddleOCR**: Optional local HTTP service (recommended for development)
  - Image document OCR path: PaddleOCR first → Workers AI Vision fallback

> **Product boundary**: `Generate & send` does not yet connect real email delivery; the OCR consumer can be deployed separately while the main Worker acts as a queue producer (see `wrangler.jsonc` and `workers/`).

---

## 2. Tech stack

| Layer | Choice |
|--------|--------|
| Frontend / full stack | SvelteKit (Svelte 5) |
| Runtime | Cloudflare Workers (`adapter-cloudflare`) |
| Database | Cloudflare D1 + Drizzle ORM |
| Files | Cloudflare R2 |
| Config | Cloudflare KV (e.g. company settings, module toggle) |
| Async | Cloudflare Queues (OCR, etc.) |
| Auth | better-auth |
| Validation | zod |

Key business-related dependencies: `pdfjs-dist`, `fflate`, `pdf-lib`; `html2canvas` / `jspdf` remain in dependencies while the main invoice flow uses `pdf-lib`.

---

## 3. Modular server architecture

### 3.1 Design

- **`ModuleRegistry`** (`src/lib/server/modules/registry.ts`): Registers domain modules, resolves dependencies, validates enabled subsets, and computes initialization order.
- **`ModuleDefinition`**: Each module exposes a `manifest` (`id`, `layer`, `dependencies`) and optional `registerHandlers` (domain events).
- **`ModuleContext`**: Per-request context (`env`, `db`, `user`, `eventBus`), created with `createModuleContext(event)`; **routes and `+server` handlers should use each module’s `api.ts`, not import `$lib/server/db` directly**.
- **Event bus** (`event-bus.ts`): Cross-module collaboration via agreed event names (each module’s `events.ts`).
- **Startup registration**: `src/lib/server/modules/register-all.ts` calls `registry.register(...)`; `hooks.server.ts` imports it so registration runs in-process.

### 3.2 Modules and dependencies

| Module ID | Name | Layer | Dependencies |
|-----------|------|-------|--------------|
| `core` | Core | core | — |
| `person` | Person | base | core |
| `business-partner` | Business Partner | base | core, person |
| `project` | Project | base | core, person, business-partner |
| `ar` | Accounts Receivable | base | core, business-partner, project |
| `employee` | Employee | base | core, person, project |
| `expense` | Expense | base | core, project |
| `tax` | Tax | feature | core, person, ar, employee |
| `reporting` | Reporting | feature | core, project, ar, employee, expense |

### 3.3 Runtime module toggle

- The enabled list is stored under **`company_settings`**, key **`modules.enabled`** (JSON array of module IDs).
- If the value is missing, invalid, or **dependencies are not satisfied**, the app **falls back to all registered modules**.
- Path-prefix to module mapping lives in `src/lib/server/modules/enabled.ts` (used to decide whether a URL is allowed for the current enabled set).
- **APIs not mapped to any business-module prefix** (e.g. `/api/upload/*`, `/api/ocr/*`, `/api/invoices/*`) remain **available after authentication**, so shared infrastructure can serve AR and project flows.

Management endpoints:

- `GET /api/settings/modules` — current enabled list and dependency validation  
- `PUT /api/settings/modules` — update enabled list (subject to app permissions)

### 3.4 Route-layer boundary

- `src/routes/**/+server.ts` and `+page.server.ts` **must not** `import '$lib/server/db'` directly (`npm run check:modular-boundary` enforces this; exceptions in `scripts/modular-boundary-allowlist.txt`).
- See **`src/lib/server/modules/MODULARIZATION_GUIDE.md`** for full rules.

---

## 4. Domain model and reference design

Implementation aligns with **`ref_files/SmartFin_模块设计_Project_Employee_Expense.md`** for future evolution:

- **Project-centric**: Customers/suppliers (business partners), members, documents, and expenses are organized around projects.
- **Person vs employee**: Identity and employment layers; employee module depends on `person` and `project`.
- **Expense**: **COGS / OpEx** and **attribution** (`direct` / `allocated` / `company`) mirror “project direct cost vs company operating cost”; details follow table definitions in `src/lib/server/modules/expense/schema.ts`.

Process history and milestone notes: **`ref_files/process/README.md`**.

---

## 5. Directory layout (after refactor)

```text
src/
  routes/
    (app)/                    # Authenticated shell (top nav respects module toggle)
    (auth)/                   # Login, etc.
    api/                      # HTTP API (thin orchestration → module APIs)
  lib/
    server/
      modules/                # Domains: core, person, business-partner, project, ar, employee, expense, tax, reporting
        registry.ts           # Module registry
        register-all.ts       # Single registration entry
        enabled.ts            # Path ↔ module, enabled list loading
        event-bus.ts
        **/api.ts             # Public module API (routes call these)
        **/schema.ts          # Drizzle tables per domain
        **/handlers.ts        # Event registration
      db.ts                   # D1 entry (module / infra layer only)
      ocr/                    # OCR/LLM pipeline (used by APIs)
      auth/                   # Session and permissions
workers/
  ocr-consumer.ts             # OCR queue consumer (separate wrangler config)
scripts/
  check-modular-boundary.mjs  # Routes must not import db directly
drizzle/
  migrations/
  seeds/
wrangler.jsonc                # Main Worker: D1 / R2 / KV / Queue / AI
```

---

## 6. Page map (shell: `src/routes/(app)/+layout.svelte`)

| Area | Paths |
|------|--------|
| Dashboard | `/dashboard` |
| AR and sub-nav | `/ar`, `/ar/contracts`, `/ar/quotations`, `/ar/purchase-orders`, `/ar/customer-invoices`, `/ar/customer-invoices/generate`, `/ar/supplier-invoices`, `/ar/document-upload` (including `project` / `record`) |
| Projects | `/projects`, `/projects/new`, `/projects/[id]` (sub-routes: contracts, quotations, purchase-orders, invoices, expenses, employees, …) |
| Employees | `/employees`, `/employees/new`, `/employees/[id]` |
| Tax | `/tax`, `/tax/corporate`, `/tax/gst/[year]/[quarter]/box/[n]`, `/tax/settings` |
| Reports | `/reports` |
| Settings | `/settings` (module toggle, etc.) |

---

## 7. API map (core)

Common endpoints below; see `src/routes/api` for the full set.

**Upload & files**

- `POST /api/upload/presign`, `PUT|POST /api/upload/direct`, `POST /api/upload/confirm`
- `GET /api/files?key=...`

**OCR / LLM**

- `POST /api/ocr/workers-vision`: Image OCR (Workers AI Vision / PaddleOCR)
- `POST /api/ocr/llm-classify`, `POST /api/ocr/llm-extract`, `POST /api/ocr/llm-email-intent`, `POST /api/ocr/llm-attachment-rank`
- `GET /api/ocr/status/[id]`, `POST /api/ocr/[id]/confirm`

**AI Agent**

- `POST /api/agent/intent`: Receives natural language, page context, and conversation history; returns:
  - `reply`: Response text
  - `matched_action_id`: Matched action ID
  - `prefill`: Form prefill data
  - `data`: Structured data for query-type intents (profit, lists, etc.)
  - `action`: Navigation target (with `entry` path)
  - `missing_context`: Required context fields that are missing
- Supports `history` parameter for multi-turn conversation
- Provider strategy: Workers AI (`platform.env.AI`) first, fallback to external LLM (OpenAI-compatible), then degraded response

**Customer invoices**

- `POST /api/invoices/out`, `PUT /api/invoices/out/[id]`
- `GET /api/invoices/out/[id]/preview`, `POST /api/invoices/out/[id]/pdf`, `POST /api/invoices/out/[id]/import-lines`

**Projects / dashboard / reports**

- `GET|POST /api/projects`, `GET|PATCH /api/projects/[id]`, `GET /api/projects/[id]/profit`
- `GET /api/dashboard/overview`, `GET /api/dashboard/projects-profit`, `GET /api/dashboard/charts`
- `GET /api/reports/projects-profit/export`

**Tax**

- `GET /api/tax/gst/[year]/[quarter]`, `GET /api/tax/gst/[year]/[quarter]/box/[n]`
- `GET /api/tax/corporate/[year]`, `GET /api/tax/individual/[employeeId]/[year]`

**Settings & modules**

- `GET|PUT /api/settings/modules`

**Other**

- `GET|POST /api/customers` (customer list, etc.)
- `POST /api/ar/save-project-document` (project document archival)

---

## 8. Common commands

```bash
npm install
npm run gen                    # wrangler types
npm run db:migrate:local
npm run db:seed:local
npm run dev:cf                 # build then run Worker locally with Wrangler (recommended)
```

Development and checks:

```bash
npm run check                  # modular boundary + svelte-check
npm run check:modular-boundary
npm run build
```

Optional data:

```bash
npm run db:seed:mock:local
npm run db:test:mock:local
```

Database:

```bash
npm run db:generate
npm run db:migrate:local
npm run db:migrate:remote
```

---

## 9. Deployment

**Main app**

```bash
npm run build
wrangler deploy
```

Config: **`wrangler.jsonc`** (D1, R2, KV, queues, AI bindings).

**OCR consumer (separate Worker)**

```bash
npm run deploy:ocr-consumer
```

Config: **`workers/wrangler.ocr-consumer.jsonc`**.

---

## 10. Environment variables

**Three local modes:** ① **`npm run dev`** / **`npm run dev:vite`** — Vite only, no Cloudflare bindings (UI-focused); ② **`npm run dev:cf`** — build + Wrangler local Worker (**recommended** for full stack); ③ **`npm run preview`** — build then Wrangler on port 4173. For ① use root **`.env`** (template **`.env.example`**); for ②③ use **`wrangler.jsonc`** + **`.dev.vars`** (template **`.dev.vars.example`**). Wrangler **does not load `.env`**; duplicate secret keys in both files if you switch between ① and ②/③.

Set **`BETTER_AUTH_SECRET`** at minimum; **`BETTER_AUTH_URL`** must match the deployed origin in production (no trailing slash). For **`npm run dev:cf`**, create **`.dev.vars`** with at least `BETTER_AUTH_SECRET=`. Values in `.env` alone are **not** injected into the Worker, which leads to **`/api/auth/*` 404**. On localhost the app aligns the auth base URL with the request origin, so you usually do not need `BETTER_AUTH_URL` in `.dev.vars`.

Cloudflare deploys typically need **`CLOUDFLARE_ACCOUNT_ID`**, **`CLOUDFLARE_API_TOKEN`**, **`CLOUDFLARE_D1_DATABASE_ID`**, etc. You **must** set **`wrangler secret put BETTER_AUTH_SECRET`** for the deployed Worker; do not commit secrets. **Without this secret, `/api/auth/*` (including `sign-up/email`) returns 404**, often as HTML like a generic asset 404.

If sign-up 404s after deploy: (1) confirm the secret exists on **that** Worker; (2) if **`BETTER_AUTH_URL` in `wrangler.jsonc`** does not match the hostname users open, the app prefers the **request origin** when hostnames differ; still set `vars.BETTER_AUTH_URL` to your canonical public URL (no trailing slash).

**Email (verification & password reset):** In production set **`RESEND_API_KEY`** (e.g. `wrangler secret put RESEND_API_KEY`) and **`EMAIL_FROM`** (e.g. `SmartFin <noreply@yourdomain.com>`, must match a verified domain in Resend). If unset, URLs are only logged and no email is sent. **Until you verify a domain**, Resend’s testing mode usually **only allows delivery to your account email**; to reach arbitrary recipients, verify a domain at [resend.com/domains](https://resend.com/domains) and use a `from` address on that domain.

Optional (external OCR/LLM): `OCR_API_URL`, `OCR_API_KEY`, `LLM_API_URL`, `LLM_API_KEY`, `LLM_PROVIDER`, `OCR_PROVIDER`, etc.

**AI and OCR specific variables**:

| Variable | Description |
|----------|-------------|
| `WORKERS_AI_MODEL` | Text LLM model (default `@cf/meta/llama-3.1-8b-instruct`) |
| `WORKERS_AI_VISION_MODEL` | Vision OCR model (default `@cf/meta/llama-3.2-11b-vision-instruct`) |
| `PADDLE_OCR_URL` | Local PaddleOCR HTTP service URL (e.g. `http://127.0.0.1:8765`) |
| `OCR_PADDLE_ONLY` | If `true`, use PaddleOCR only without Workers AI fallback |

AI Agent reuses the same LLM config: if Workers AI is unavailable locally, it automatically tries `LLM_API_URL` + `LLM_API_KEY` (e.g. OpenAI).

---

## 11. Known limitations and risks

- Email delivery is not integrated (SMTP/third party); invoicing is generate + local download + optional storage.
- OCR/LLM depends on provider quality and quotas; operations should plan degradation and retries.
- Text PDF vs on-screen preview may differ slightly under extreme content; browser print headers/footers must be disabled in the print dialog.

---

## 12. Roadmap (suggested)

- [ ] Email delivery (templates, attachments, status writeback)
- [ ] Configurable invoice PDF templates and versioning
- [ ] OCR queue observability, DLQ, and alerting
- [ ] E2E: ZIP upload, extraction, invoice generation, storage, tax summary
- [ ] Shared financial field dictionary (GST, currency, status enums) to reduce frontend/backend drift
- [ ] Retire `legacy-db` bridge; routes exclusively via module APIs (see `MODULARIZATION_GUIDE.md`)

---

## 13. Maintenance

- On major milestones, update progress and boundaries in **`ref_files/process/README.md`** (optionally sync sections 1, 11, and 12 here).
- For breaking API or module-dependency changes, add a short **CHANGELOG** section at the top of this file.
