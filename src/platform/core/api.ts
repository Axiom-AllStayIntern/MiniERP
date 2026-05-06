import type { ModuleContext } from '$platform/modules/types';
import { AuditService } from '$platform/audit/audit-service';
import { ConfigService } from '$platform/config/config-service';

/**
 * Thin facade combining audit + config helpers exposed to route handlers.
 * Created during the Wave 1.2 split from legacy/core; new code should prefer
 * importing the underlying services directly from $platform/{audit,config}.
 */
export type CoreApi = ReturnType<typeof createCoreApi>;

export function createCoreApi(ctx: ModuleContext) {
	const audit = new AuditService(ctx);
	const config = new ConfigService(ctx);

	return {
		writeAuditLog: audit.writeLog.bind(audit),
		getProjectActivity: audit.getProjectActivity.bind(audit),
		getSetting: config.get.bind(config),
		setSetting: config.set.bind(config),
		getEnabledModules: config.getEnabledModules.bind(config),
		setEnabledModules: config.setEnabledModules.bind(config)
	};
}
