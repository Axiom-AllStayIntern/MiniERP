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

## Phase 1 Constraints

- Do not rewrite business formulas.
- Do not migrate database schema.
- Do not remove `legacy-db`.
- Do not make Finance strongly depend on Project or HR by default.
