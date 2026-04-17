import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RatePlanService, CreateRatePlanDto, UpsertDailyRateDto } from '../application/rate-plan.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('CMS — Rate Plans')
@ApiBearerAuth()
@Controller({ path: 'rate-plans', version: '1' })
export class RatePlanController {
  constructor(private readonly ratePlanService: RatePlanService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new rate plan' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  create(@Body() dto: CreateRatePlanDto) { return this.ratePlanService.create(dto); }

  @Get()
  @ApiOperation({ summary: 'List rate plans (optionally filter by room type)' })
  findAll(@Query('roomTypeId') roomTypeId?: string) { return this.ratePlanService.findAll(roomTypeId); }

  @Get(':id')
  @ApiOperation({ summary: 'Get rate plan by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.ratePlanService.findById(id); }

  @Get(':id/rates')
  @ApiOperation({ summary: 'Get daily rates for a date range' })
  getRates(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) { return this.ratePlanService.getDailyRates(id, startDate, endDate); }

  @Post('rates/bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk upsert daily rates' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  upsertRates(@Body() dto: { rates: UpsertDailyRateDto[] }) { return this.ratePlanService.upsertDailyRates(dto.rates); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update rate plan settings' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateRatePlanDto>) { return this.ratePlanService.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a rate plan' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  deactivate(@Param('id', ParseUUIDPipe) id: string) { return this.ratePlanService.deactivate(id); }
}
