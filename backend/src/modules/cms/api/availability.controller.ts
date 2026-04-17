import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AvailabilityService, BulkUpdateAvailabilityDto } from '../application/availability.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('CMS — Availability')
@ApiBearerAuth()
@Controller({ path: 'availability', version: '1' })
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('check')
  @ApiOperation({ summary: 'Check room type availability for a date range' })
  check(
    @Query('roomTypeId') roomTypeId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
  ) {
    return this.availabilityService.checkAvailability(roomTypeId, checkIn, checkOut);
  }

  @Get('grid')
  @ApiOperation({ summary: 'Get availability grid for calendar view' })
  grid(
    @Query('roomTypeId') roomTypeId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.availabilityService.getAvailabilityGrid(roomTypeId, startDate, endDate);
  }

  @Post('bulk-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk update availability blocks (stop sell, CTA, CTD)' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  bulkUpdate(@Body() dto: { updates: BulkUpdateAvailabilityDto[] }) {
    return this.availabilityService.bulkUpdate(dto.updates);
  }
}
