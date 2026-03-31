INSERT OR IGNORE INTO customers (id, name, address, contact, gst_reg_no, metadata, created_at, updated_at, deleted_at)
VALUES
	(
		'cust-demo-001',
		'Demo Trading Pte Ltd',
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
		'80 Robinson Road, Singapore',
		'ops@lioncity-imports.sg',
		'GST-REG-DEMO-002',
		'{"source":"local-seed"}',
		CURRENT_TIMESTAMP,
		CURRENT_TIMESTAMP,
		NULL
	);
