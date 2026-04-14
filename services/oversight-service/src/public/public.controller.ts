import { Controller, Get } from '@nestjs/common';
import { SystemSettingService } from '../admin/services/system-setting.service';

/**
 * Public (unauthenticated) endpoints exposed by the oversight-service.
 * Used by api-gateway and other internal services that cannot pass admin JWT.
 */
@Controller('public')
export class PublicController {
	constructor(private readonly systemSettingService: SystemSettingService) {}

	/**
	 * Returns the current maintenance mode status.
	 * Called by the api-gateway middleware with a 60-second TTL cache.
	 * No authentication required.
	 */
	@Get('maintenance-status')
	async getMaintenanceStatus() {
		const [modeResult, msgResult] = await Promise.allSettled([
			this.systemSettingService.getSettingByKey('maintenance_mode'),
			this.systemSettingService.getSettingByKey('maintenance_message'),
		]);

		const maintenanceMode =
			modeResult.status === 'fulfilled' && modeResult.value?.value === 'true';
		const maintenanceMessage =
			msgResult.status === 'fulfilled'
				? (msgResult.value?.value ?? '')
				: '';

		return { maintenance_mode: maintenanceMode, maintenance_message: maintenanceMessage };
	}
}
