import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryItem } from '../domain/inventory-item.entity';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

export interface CreateInventoryItemDto {
  itemCode: string;
  name: string;
  uomBase: string;
  itemGroup?: string;
  itemCategory?: string;
  reorderLevel?: number;
  reorderQty?: number;
}

export interface StockLevelResult {
  itemId: string;
  itemCode: string;
  name: string;
  storeId: string;
  storeName: string;
  quantity: number;
  uomBase: string;
  averagePrice: number;
  belowReorder: boolean;
}

@Injectable()
export class InventoryItemService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateInventoryItemDto): Promise<InventoryItem> {
    const { hotelId } = this.tenantContext;
    const item = this.itemRepo.create({ hotelId, ...dto });
    return this.itemRepo.save(item);
  }

  async findAll(group?: string): Promise<InventoryItem[]> {
    const { hotelId } = this.tenantContext;
    const qb = this.itemRepo.createQueryBuilder('i')
      .where('i.hotel_id = :hotelId', { hotelId })
      .andWhere('i.is_active = true')
      .orderBy('i.name', 'ASC');
    if (group) qb.andWhere('i.item_group = :group', { group });
    return qb.getMany();
  }

  async findById(id: string): Promise<InventoryItem> {
    const { hotelId } = this.tenantContext;
    const item = await this.itemRepo.findOne({ where: { id, hotelId } });
    if (!item) throw new NotFoundException(`InventoryItem ${id} not found`);
    return item;
  }

  async getStockLevels(storeId?: string): Promise<StockLevelResult[]> {
    const { hotelId } = this.tenantContext;
    return this.dataSource.query(
      `SELECT
         ii.id AS "itemId", ii.item_code AS "itemCode", ii.name,
         s.id AS "storeId", s.name AS "storeName",
         COALESCE(SUM(sm.quantity), 0) AS quantity,
         ii.uom_base AS "uomBase",
         ii.average_price AS "averagePrice",
         (COALESCE(SUM(sm.quantity), 0) < ii.reorder_level) AS "belowReorder"
       FROM inventory_items ii
       CROSS JOIN stores s
       LEFT JOIN stock_movements sm ON sm.inventory_item_id = ii.id AND sm.store_id = s.id
       WHERE ii.hotel_id = $1 AND s.hotel_id = $1 AND ii.is_active = true
       ${storeId ? 'AND s.id = $2' : ''}
       GROUP BY ii.id, ii.item_code, ii.name, s.id, s.name, ii.uom_base, ii.average_price, ii.reorder_level
       ORDER BY s.name, ii.name`,
      storeId ? [hotelId, storeId] : [hotelId],
    );
  }

  async getLowStockAlerts(): Promise<InventoryItem[]> {
    const { hotelId } = this.tenantContext;
    return this.dataSource.query(
      `SELECT ii.*
       FROM inventory_items ii
       WHERE ii.hotel_id = $1 AND ii.is_active = true
         AND (
           SELECT COALESCE(SUM(sm.quantity), 0)
           FROM stock_movements sm WHERE sm.inventory_item_id = ii.id
         ) <= ii.reorder_level
       ORDER BY ii.name`,
      [hotelId],
    );
  }

  async update(id: string, dto: Partial<CreateInventoryItemDto>): Promise<InventoryItem> {
    const { hotelId } = this.tenantContext;
    await this.itemRepo.update({ id, hotelId }, dto);
    return this.findById(id);
  }
}
