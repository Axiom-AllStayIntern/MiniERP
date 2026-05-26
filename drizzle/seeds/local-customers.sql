-- Customers are stored as business partners after Wave 2.2.
INSERT OR IGNORE INTO business_partners (id, name, type, address, contact, gst_reg_no, metadata, created_at, updated_at, deleted_at)
VALUES
	(
		'cust-demo-001',
		'Demo Trading Pte Ltd',
		'customer',
		'1 Raffles Place, Singapore',
		'finance@demotrading.sg',
		'GST-REG-DEMO-001',
		'{"source":"local-seed"}',
		CURRENT_TIMESTAMP,
		CURRENT_TIMESTAMP,
		NULL
	),
	(
		'cust-demo-002',
		'Lion City Imports',
		'customer',
		'80 Robinson Road, Singapore',
		'ops@lioncity-imports.sg',
		'GST-REG-DEMO-002',
		'{"source":"local-seed"}',
		CURRENT_TIMESTAMP,
		CURRENT_TIMESTAMP,
		NULL
	);
