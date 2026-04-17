import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RouteToRoomService, RouteChargeDto } from '../application/route-to-room.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('POS — Transactions')
@ApiBearerAuth()
@Controller({ path: 'pos-transactions', version: '1' })
export class PosTransactionController {
  constructor(private readonly routeToRoomService: RouteToRoomService) {}

  @Post('route-to-room')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Route a POS charge to a guest room folio',
    description:
      'Performs a synchronous Redis lookup to confirm the guest is in the room, ' +
      'then publishes an async event to post the charge to the folio.',
  })
  @Roles('CASHIER', 'FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  routeToRoom(@Body() dto: RouteChargeDto) {
    return this.routeToRoomService.routeCharge(dto);
  }

  @Post('check-room-occupancy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if a room has an active guest (for pre-order validation)' })
  @Roles('CASHIER', 'FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  checkOccupancy(@Body() body: { roomNumber: string }) {
    return this.routeToRoomService.checkRoomOccupancy(body.roomNumber);
  }
}
