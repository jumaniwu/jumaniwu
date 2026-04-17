import { Controller, Get, Post, Patch, Param, Body, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CaptainOrderService, CreateCaptainOrderDto, AddOrderItemDto } from '../application/captain-order.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('POS — Captain Orders')
@ApiBearerAuth()
@Controller({ path: 'captain-orders', version: '1' })
export class CaptainOrderController {
  constructor(private readonly captainOrderService: CaptainOrderService) {}

  @Post()
  @ApiOperation({ summary: 'Open a new captain order (table/room/takeaway)' })
  @Roles('CASHIER', 'FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  create(@Body() dto: CreateCaptainOrderDto) { return this.captainOrderService.createOrder(dto); }

  @Get('by-outlet/:outletId')
  @ApiOperation({ summary: 'List captain orders by outlet' })
  findByOutlet(@Param('outletId', ParseUUIDPipe) outletId: string, @Query('status') status?: string) {
    return this.captainOrderService.findByOutlet(outletId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get captain order with all items' })
  getWithItems(@Param('id', ParseUUIDPipe) id: string) { return this.captainOrderService.getOrderWithItems(id); }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add item to captain order' })
  @Roles('CASHIER', 'FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  addItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddOrderItemDto) {
    return this.captainOrderService.addItem(id, dto);
  }

  @Post(':id/send-to-kitchen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send pending items to kitchen' })
  @Roles('CASHIER', 'FRONT_DESK', 'MANAGER', 'HOTEL_ADMIN')
  sendToKitchen(@Param('id', ParseUUIDPipe) id: string) { return this.captainOrderService.sendToKitchen(id); }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark captain order as completed' })
  @Roles('CASHIER', 'MANAGER', 'HOTEL_ADMIN')
  complete(@Param('id', ParseUUIDPipe) id: string) { return this.captainOrderService.completeOrder(id); }

  @Patch('items/:itemId/void')
  @ApiOperation({ summary: 'Void an order item' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  voidItem(@Param('itemId', ParseUUIDPipe) itemId: string) { return this.captainOrderService.voidItem(itemId); }
}
