# Finance Module Boundary

Finance is the first product-grade module boundary. It must become usable in
standalone mode and suite mode.

Target ownership:
- Expense and reimbursement flows
- Revenue and customer invoice flows
- Supplier invoice, receipt, purchase order, and finance document flows
- GST, tax, and profit reporting rules
- Finance task workflows
- Finance AI capabilities
- Finance workspace entry metadata

Current legacy subdomains:
- `src/modules/legacy/server-modules/ar`
- `src/modules/legacy/server-modules/expense`
- `src/modules/legacy/server-modules/tax`
- `src/modules/legacy/server-modules/reporting`

Integration rule:
- Project and HR context must be consumed through lookup adapters or public
  contracts, not by importing their repositories or schemas directly.
- `project_id` is an external enhancement by default. A specific workflow or
  tenant policy may make it required later.

Phase 1 keeps all legacy code in place and only establishes this umbrella
boundary for incremental migration.

Current bridge status:
- Executable Finance facade assembly now lives under this target directory.
- The former compatibility entrypoints under
  `src/modules/legacy/server-modules/finance/{index,api,compat}.ts` were retired after
  their caller count reached zero.
- Internal convergence has now started inside this module by splitting the
  target layer into:
  - `app/`: Finance-owned workspace and surface metadata
  - `contracts/`: inbound, outbound, event, and failure contract types
  - `workflows/`: Finance workflow definitions and step-level grouping
  - `capabilities/`: Finance AI and agent capability grouping
  - `services/`: executable Finance service composition
  - `rules/`: validation and duplicate-detection rules
  - `policies/`: policy resolution and project-link semantics
  - `schemas/`: input, record, extraction, and payload schemas
  - `repositories/`: target-owned repository bridge seams
  - `adapters/`: lookup and cross-module bridges
  - `events/`: Finance event definitions
  - `config/`: manifest and module configuration
- Former root-level compatibility files such as `api.ts`, `billing.ts`,
  `expenses.ts`, `revenue.ts`, `contracts.ts`, and `adapters.ts` have now been
  retired after reaching zero callers.
- The remaining root-level entrypoint is `index.ts` as the canonical public
  module entry.
- Finance-owned executable service ownership has started for low-risk paths:
  `expenses.getProjectExpenseSums`,
  `expenses.getProjectExpenseDetail`,
  `expenses.getStandaloneExpenseDetail`,
  `expenses.getProjectExpensePage`,
  `expenses.getExpenseListPage`,
  `expenses.getReimbursementsPage`,
  `expenses.getExpenseUploadPage`,
  `expenses.createStandaloneExpense`,
  `expenses.updateStandaloneExpense`,
  `expenses.softDeleteStandaloneExpense`,
  `expenses.create`,
  `expenses.updateProjectExpense`,
  `expenses.softDeleteProjectExpense`,
  `expenses.createBusinessTripWithAllowance`,
  `expenses.listBusinessTrips`, and
  `expenses.uploadExpense`,
  `revenue.getProjectRevenuePage/createRevenue/getProjectRevenueDocumentDetail`,
  `documents.saveProjectDocument`,
  `documents.getContractDocHubPage/getQuotationDocHubPage/getPurchaseOrderDocHubPage/getSupplierInvoiceDocHubPage`,
  `documents.getContractDocumentDetail/updateContractDocument/deleteContractDocument`,
  `documents.getQuotationDocumentDetail/updateQuotationDocument/deleteQuotationDocument`,
  `documents.getPurchaseOrderDocumentDetail/updatePurchaseOrderDocument/deletePurchaseOrderDocument`,
  `billing.createCustomerInvoice/updateCustomerInvoiceDraft`,
  `billing.getCustomerInvoiceDocHubPage/getCustomerInvoiceGeneratePage/getCustomerInvoicePreview`,
  `billing.issueCustomerInvoicePdf/importContractLinesToCustomerInvoice`,
  `billing.getCustomerInvoicesByProject/getSupplierInvoicesByProject/getProjectRevenue/getProjectPurchaseCost`,
  `taxes.getGstManualBoxValues/saveGstManualBoxValues/getGstReturnEstimate/getGstBoxDetail/getCorporateTaxEstimate/getEmployeeTaxSummary`,
  `insights.getCompanyFinancialOverview/getDashboardCharts/getProjectsProfitRanking/getProjectsProfitCsv/getProjectFinancialDetail/getProjectDocumentsSummary`
  now run from `services/` and `repositories/` under this module.

Phase 2 focus:
- Consolidate external Finance entrypoints so routes, agent domains, and query
  handlers all consume Finance instead of legacy finance submodules.
- Keep `ar`, `expense`, `tax`, and `reporting` as internal implementation slices
  until their internals can be lifted safely.
- The temporary helper bridge `src/modules/finance/compat.ts` has now been
  retired after its final external caller moved to `src/modules/finance/rules`.
- The former runtime bridge file `src/modules/finance/adapters/legacy.ts` has
  now been retired. Remaining legacy coupling is implementation debt inside the
  old module slices, not an active Finance public-entry dependency.
- The former helper bridge file `src/modules/finance/adapters/compat.ts` has
  also been retired after Finance moved its compatibility exports to
  `repositories/` and `rules/`.
- Finance capability action catalogs are now owned in
  `src/modules/finance/capabilities/agent-actions.ts` instead of importing the
  legacy module root entrypoints.
- Use this Finance directory shape as the template for future internal
  convergence in Project, HR, and Document Intake.
