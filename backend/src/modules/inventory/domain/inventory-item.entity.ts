import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('inventory_items')
export class InventoryItem extends TenantEntity {
  @Column({ name: 'item_code', length: 30 })
  itemCode: string;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'item_group', length: 50, nullable: true })
  itemGroup: string;

  @Column({ name: 'item_category', length: 50, nullable: true })
  itemCategory: string;

  @Column({ name: 'uom_base', length: 20 })
  uomBase: string;

  @Column({ name: 'reorder_level', type: 'decimal', precision: 12, scale: 3, default: 0 })
  reorderLevel: number;

  @Column({ name: 'reorder_qty', type: 'decimal', precision: 12, scale: 3, default: 0 })
  reorderQty: number;

  @Column({ name: 'last_price', type: 'decimal', precision: 15, scale: 2, default: 0 })
  lastPrice: number;

  @Column({ name: 'average_price', type: 'decimal', precision: 15, scale: 2, default: 0 })
  averagePrice: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
