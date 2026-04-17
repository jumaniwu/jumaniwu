import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoomService } from '../application/room.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

export interface UpdateHkStatusDto {
  hkStatus: string;
}

@ApiTags('PMS — Rooms')
@ApiBearerAuth()
@Controller({ path: 'rooms', version: '1' })
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  @ApiOperation({ summary: 'List all rooms with optional filters' })
  findAll(
    @Query('floor') floor?: string,
    @Query('hkStatus') hkStatus?: string,
    @Query('occupancyStatus') occupancyStatus?: string,
  ) {
    return this.roomService.findAll({ floor, hkStatus, occupancyStatus });
  }

  @Get('floor-plan')
  @ApiOperation({ summary: 'Get floor plan data (room positions)' })
  getFloorPlan() {
    return this.roomService.getFloorPlan();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomService.findById(id);
  }

  @Patch(':id/hk-status')
  @ApiOperation({ summary: 'Update housekeeping status of a room' })
  @Roles('HOUSEKEEPING', 'MANAGER', 'HOTEL_ADMIN')
  updateHkStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHkStatusDto,
  ) {
    return this.roomService.updateHkStatus(id, dto.hkStatus);
  }
}
