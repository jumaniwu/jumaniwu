import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NightAuditService } from '../application/night-audit.service';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';
import { Roles } from '@shared/kernel/auth/roles.decorator';

export interface RunNightAuditDto {
  auditDate: string;
}

@ApiTags('PMS — Hotel Operations')
@ApiBearerAuth()
@Controller({ path: 'hotel-ops', version: '1' })
export class HotelController {
  constructor(
    private readonly nightAuditService: NightAuditService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Post('night-audit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run Night Audit',
    description:
      'Executes the full end-of-day sequence: global post room rates → auto no-show → ' +
      'publish accounting events → generate summary.',
  })
  @Roles('NIGHT_AUDIT', 'MANAGER', 'HOTEL_ADMIN')
  runNightAudit(@Body() dto: RunNightAuditDto) {
    const { hotelId, userId } = this.tenantContext;
    return this.nightAuditService.runNightAudit(
      hotelId,
      new Date(dto.auditDate),
      userId,
    );
  }

  @Get('night-audit/history')
  @ApiOperation({ summary: 'Get night audit run history' })
  @Roles('NIGHT_AUDIT', 'MANAGER', 'HOTEL_ADMIN', 'ACCOUNTING', 'AUDITOR')
  getAuditHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { hotelId } = this.tenantContext;
    return this.nightAuditService.getAuditHistory(
      hotelId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 30,
    );
  }
}
