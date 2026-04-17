import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from './domain/inventory-item.entity';
import { PurchaseOrder } from './domain/purchase-order.entity';
import { InventoryItemController } from './api/inventory-item.controller';
import { PurchaseOrderController } from './api/purchase-order.controller';
import { InventoryItemService } from './application/inventory-item.service';
import { PurchaseOrderService } from './application/purchase-order.service';
import { StockMovementService } from './application/stock-movement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryItem, PurchaseOrder]),
  ],
  controllers: [InventoryItemController, PurchaseOrderController],
  providers: [InventoryItemService, PurchaseOrderService, StockMovementService],
  exports: [StockMovementService],
})
export class InventoryModule {}
