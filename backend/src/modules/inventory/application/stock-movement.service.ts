import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryItem } from '../domain/inventory-item.entity';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

export interface StockMovementLine {
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
}

export interface AdjustStockDto {
  inventoryItemId: string;
  storeId: string;
  newQuantity: number;
  reason: string;
}

@Injectable()
export class StockMovementService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContext,
  ) {}

  async receiveStock(
    storeId: string,
    lines: StockMovementLine[],
    sourceRef: string,
  ): Promise<void> {
    const { hotelId, userId } = this.tenantContext;
    await this.dataSource.transaction(async (mgr) => {
      for (const line of lines) {
        await mgr.query(
          `INSERT INTO stock_movements
             (hotel_id, inventory_item_id, store_id, movement_type, quantity,
              unit_cost, reference_number, created_by)
           VALUES ($1,$2,$3,'RECEIVE',$4,$5,$6,$7)`,
          [hotelId, line.inventoryItemId, storeId, line.quantity, line.unitCost, sourceRef, userId],
        );
        await this.updateAveragePrice(mgr, hotelId, line.inventoryItemId, line.quantity, line.unitCost);
      }
    });
  }

  async consumeStock(storeId: string, lines: StockMovementLine[], sourceRef: string): Promise<void> {
    const { hotelId, userId } = this.tenantContext;
    for (const line of lines) {
      await this.dataSource.query(
        `INSERT INTO stock_movements
           (hotel_id, inventory_item_id, store_id, movement_type, quantity,
            unit_cost, reference_number, created_by)
         VALUES ($1,$2,$3,'CONSUME',$4,$5,$6,$7)`,
        [hotelId, line.inventoryItemId, storeId, -Math.abs(line.quantity),
         line.unitCost, sourceRef, userId],
      );
    }
  }

  async adjustStock(dto: AdjustStockDto): Promise<void> {
    const { hotelId, userId } = this.tenantContext;
    const currentQty = await this.dataSource.query<Array<{ qty: string }>>(
      `SELECT COALESCE(SUM(quantity), 0) AS qty
       FROM stock_movements
       WHERE hotel_id = $1 AND inventory_item_id = $2 AND store_id = $3`,
      [hotelId, dto.inventoryItemId, dto.storeId],
    );
    const current = parseFloat(currentQty[0]?.qty ?? '0');
    const diff = dto.newQuantity - current;

    await this.dataSource.query(
      `INSERT INTO stock_movements
         (hotel_id, inventory_item_id, store_id, movement_type, quantity,
          unit_cost, reference_number, notes, created_by)
       VALUES ($1,$2,$3,'ADJUST',$4,0,$5,$6,$7)`,
      [hotelId, dto.inventoryItemId, dto.storeId, diff,
       `ADJ-${Date.now()}`, dto.reason, userId],
    );
  }

  async getMovementHistory(inventoryItemId: string, storeId?: string) {
    const { hotelId } = this.tenantContext;
    return this.dataSource.query(
      `SELECT sm.*, ii.name AS item_name, ii.item_code, s.name AS store_name
       FROM stock_movements sm
       JOIN inventory_items ii ON ii.id = sm.inventory_item_id
       JOIN stores s ON s.id = sm.store_id
       WHERE sm.hotel_id = $1 AND sm.inventory_item_id = $2
       ${storeId ? 'AND sm.store_id = $3' : ''}
       ORDER BY sm.created_at DESC
       LIMIT 100`,
      storeId ? [hotelId, inventoryItemId, storeId] : [hotelId, inventoryItemId],
    );
  }

  private async updateAveragePrice(
    mgr: any,
    hotelId: string,
    itemId: string,
    newQty: number,
    newCost: number,
  ): Promise<void> {
    // AVCO (Weighted Average Cost) calculation
    const result = await mgr.query(
      `SELECT
         COALESCE(SUM(CASE WHEN movement_type = 'RECEIVE' THEN quantity ELSE 0 END), 0) AS total_qty,
         COALESCE(SUM(CASE WHEN movement_type = 'RECEIVE' THEN quantity * unit_cost ELSE 0 END), 0) AS total_value
       FROM stock_movements WHERE hotel_id = $1 AND inventory_item_id = $2`,
      [hotelId, itemId],
    );
    const totalQty = parseFloat(result[0]?.total_qty ?? '0') + newQty;
    const totalValue = parseFloat(result[0]?.total_value ?? '0') + newQty * newCost;
    const averagePrice = totalQty > 0 ? totalValue / totalQty : newCost;

    await mgr.query(
      `UPDATE inventory_items SET average_price = $1, last_price = $2 WHERE id = $3`,
      [averagePrice, newCost, itemId],
    );
  }
}
