import type { ModuleContext } from '$platform/modules/types';
import { AuditService, ConfigService } from './service';

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
