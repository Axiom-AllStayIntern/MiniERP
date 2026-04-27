# Finance Legacy Boundary Map

This map is intentionally descriptive. It does not move code in Phase 1.

## Legacy Subdomain Mapping

| Legacy module | Finance target responsibility |
| --- | --- |
| `ar` | Customer invoices, supplier invoices, payments, quotations, contracts, purchase orders |
| `expense` | Operating expenses, sales cost, reimbursements, business trip costs, revenue records currently stored with expense data |
| `tax` | GST, corporate tax, individual tax inputs, tax-related reporting |
| `reporting` | Finance/reporting aggregation and dashboard read models |

## Outbound Adapters To Add Later

| Adapter | Provider | Dependency type | Failure policy |
| --- | --- | --- | --- |
| `project-lookup` | Project module | Weak for suggestions, strong for project-scoped posting when policy requires it | Degrade for suggestions; block or fail for posting |
| `employee-lookup` | HR module | Weak for enrichment, strong for payroll/staff-cost workflows | Degrade for enrichment; block or fail for payroll |
| `file-source` | Platform files / Document Intake | Strong for document workflows | Retry or block |

## Current Internal Adapter Step

- `src/modules/finance/contracts/` defines the explicit Finance-facing
  contracts consumed by grouped Finance APIs.
- The former runtime legacy adapter file
  `src/modules/finance/adapters/legacy.ts` has been retired.
- The former helper compatibility adapter file
  `src/modules/finance/adapters/compat.ts` has also been retired in favor of
  Finance-owned repository and rule exports.
- The former root compatibility entrypoint `src/modules/finance/compat.ts` has
  also been retired after its final external caller moved to `rules/`.
- Expense, revenue, documents, billing, taxes, and insights public APIs now
  execute from Finance-owned services and repositories instead of going through
  a root-level legacy adapter facade.

## Phase 1 Constraints

- Do not rewrite business formulas.
- Do not migrate database schema.
- Do not remove `legacy-db`.
- Do not make Finance strongly depend on Project or HR by default.
