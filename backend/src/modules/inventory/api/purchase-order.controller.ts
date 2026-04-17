import { Controller, Get, Post, Patch, Param, Body, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseOrderService, CreatePurchaseOrderDto, ReceiveLineDto } from '../application/purchase-order.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('Inventory — Purchase Orders')
@ApiBearerAuth()
@Controller({ path: 'purchase-orders', version: '1' })
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a purchase order' })
  @Roles('INVENTORY', 'MANAGER', 'HOTEL_ADMIN')
  create(@Body() dto: CreatePurchaseOrderDto) { return this.poService.create(dto); }

  @Get()
  @ApiOperation({ summary: 'List purchase orders' })
  findAll(@Query('status') status?: string) { return this.poService.findAll(status); }

  @Get(':id')
  @ApiOperation({ summary: 'Get PO with all line items' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.poService.findById(id); }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a draft PO' })
  @Roles('MANAGER', 'HOTEL_ADMIN')
  approve(@Param('id', ParseUUIDPipe) id: string) { return this.poService.approve(id); }

  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive goods against a PO — updates stock levels (AVCO)' })
  @Roles('INVENTORY', 'MANAGER', 'HOTEL_ADMIN')
  receive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: { lines: ReceiveLineDto[] }) {
    return this.poService.receive(id, dto.lines);
  }
}
