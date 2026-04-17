import { Controller, Get, Post, Patch, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryItemService, CreateInventoryItemDto } from '../application/inventory-item.service';
import { StockMovementService, AdjustStockDto } from '../application/stock-movement.service';
import { Roles } from '@shared/kernel/auth/roles.decorator';

@ApiTags('Inventory — Items')
@ApiBearerAuth()
@Controller({ path: 'inventory-items', version: '1' })
export class InventoryItemController {
  constructor(
    private readonly inventoryItemService: InventoryItemService,
    private readonly stockMovementService: StockMovementService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create inventory item' })
  @Roles('INVENTORY', 'MANAGER', 'HOTEL_ADMIN')
  create(@Body() dto: CreateInventoryItemDto) { return this.inventoryItemService.create(dto); }

  @Get()
  @ApiOperation({ summary: 'List inventory items' })
  findAll(@Query('group') group?: string) { return this.inventoryItemService.findAll(group); }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get items at or below reorder level' })
  getLowStock() { return this.inventoryItemService.getLowStockAlerts(); }

  @Get('stock-levels')
  @ApiOperation({ summary: 'Get current stock levels by store' })
  getStockLevels(@Query('storeId') storeId?: string) {
    return this.inventoryItemService.getStockLevels(storeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.inventoryItemService.findById(id); }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Get stock movement history for an item' })
  getMovements(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId?: string) {
    return this.stockMovementService.getMovementHistory(id, storeId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update inventory item' })
  @Roles('INVENTORY', 'MANAGER', 'HOTEL_ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateInventoryItemDto>) {
    return this.inventoryItemService.update(id, dto);
  }

  @Post('adjust')
  @ApiOperation({ summary: 'Adjust stock level for an item in a store' })
  @Roles('INVENTORY', 'MANAGER', 'HOTEL_ADMIN')
  adjustStock(@Body() dto: AdjustStockDto) { return this.stockMovementService.adjustStock(dto); }
}
