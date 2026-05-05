import type { RequestHandler } from './$types';

import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '../../../modules/finance';
import { fail, ok } from '$platform/http';

const DESTINATION_ALLOWANCE_RATES: Record<string, number> = {
	China: 50,
	Malaysia: 45,
	Indonesia: 45,
	Thailand: 45,
	Vietnam: 40,
	Philippines: 40,
	Singapore: 30,
	Other: 50
};

/**
 * GET /api/business-trips
 * List all business trips, optionally filtered by project or employee
 */
export const GET: RequestHandler = async (event) => {
	const { url, platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const ctx = await createModuleContext(event);
	const { expenses } = createFinanceApi(ctx);
	const trips = await expenses.listBusinessTrips({
		projectId: url.searchParams.get('projectId'),
		employeeId: url.searchParams.get('employeeId')
	});

	return ok({ trips });
};

/**
 * POST /api/business-trips
 * Create a new business trip and auto-generate allowance expense.
 */
export const POST: RequestHandler = async (event) => {
	const { request, platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const body = (await request.json()) as {
		employeeId?: string;
		projectId?: string;
		destination?: string;
		startDate?: string;
		endDate?: string;
		dailyAllowanceRate?: number;
		notes?: string;
	};

	if (!body.employeeId || !body.destination || !body.startDate || !body.endDate) {
		return fail('Missing required fields: employeeId, destination, startDate, endDate');
	}

	const startDate = new Date(body.startDate);
	const endDate = new Date(body.endDate);

	if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
		return fail('Invalid date format. Use YYYY-MM-DD');
	}

	if (endDate < startDate) {
		return fail('End date must be on or after start date');
	}

	const dailyAllowanceRate =
		body.dailyAllowanceRate ?? DESTINATION_ALLOWANCE_RATES[body.destination] ?? 50;

	const ctx = await createModuleContext(event);
	const { expenses } = createFinanceApi(ctx);
	const result = await expenses.createBusinessTripWithAllowance({
		employeeId: body.employeeId,
		projectId: body.projectId || null,
		destination: body.destination,
		startDate: body.startDate,
		endDate: body.endDate,
		dailyAllowanceRate,
		notes: body.notes || null,
		requireEmployee: true
	});

	if (!result.ok) {
		return fail(result.error, result.status ?? 400);
	}

	return ok(
		{
			tripId: result.tripId,
			expenseId: result.expenseId,
			days: result.days,
			allowanceAmount: result.allowanceAmount,
			message: 'Business trip created with allowance expense'
		},
		201
	);
};


