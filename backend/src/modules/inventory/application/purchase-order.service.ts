import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseOrder } from '../domain/purchase-order.entity';
import { StockMovementService } from './stock-movement.service';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

export interface CreatePOLineDto {
  inventoryItemId: string;
  quantity: number;
  unitPrice: number;
  uom?: string;
}

export interface CreatePurchaseOrderDto {
  companyId: string;
  poDate: string;
  expectedDate?: string;
  currencyCode?: string;
  lines: CreatePOLineDto[];
}

export interface ReceiveLineDto {
  poLineId: string;
  receivedQty: number;
  storeId: string;
}

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    private readonly dataSource: DataSource,
    private readonly stockMovementService: StockMovementService,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    const { hotelId, userId } = this.tenantContext;
    const poNumber = await this.generatePoNumber(hotelId);
    const totalAmount = dto.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

    return this.dataSource.transaction(async (mgr) => {
      const po = mgr.create(PurchaseOrder, {
        hotelId,
        companyId: dto.companyId,
        poNumber,
        poDate: new Date(dto.poDate),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        status: 'DRAFT',
        totalAmount,
        currencyCode: dto.currencyCode ?? 'IDR',
        requestedBy: userId,
      });
      const saved = await mgr.save(po);

      for (const line of dto.lines) {
        await mgr.query(
          `INSERT INTO purchase_order_items
             (hotel_id, purchase_order_id, inventory_item_id, quantity, unit_price,
              total_price, uom, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING')`,
          [hotelId, saved.id, line.inventoryItemId, line.quantity,
           line.unitPrice, line.quantity * line.unitPrice, line.uom ?? 'PCS'],
        );
      }
      return saved;
    });
  }

  async approve(poId: string): Promise<PurchaseOrder> {
    const { hotelId, userId } = this.tenantContext;
    const po = await this.findOrFail(poId, hotelId);
    if (po.status !== 'DRAFT') throw new BadRequestException('Only DRAFT POs can be approved');
    await this.poRepo.update(poId, { status: 'APPROVED', approvedBy: userId });
    po.status = 'APPROVED';
    return po;
  }

  async receive(poId: string, lines: ReceiveLineDto[]): Promise<PurchaseOrder> {
    const { hotelId } = this.tenantContext;
    const po = await this.findOrFail(poId, hotelId);
    if (!['APPROVED', 'PARTIAL'].includes(po.status)) {
      throw new BadRequestException('Only APPROVED or PARTIAL POs can be received');
    }

    for (const line of lines) {
      const [poLine] = await this.dataSource.query<Array<{ inventory_item_id: string; unit_price: string }>>(
        `SELECT inventory_item_id, unit_price FROM purchase_order_items WHERE id = $1`,
        [line.poLineId],
      );
      if (!poLine) throw new NotFoundException(`PO line ${line.poLineId} not found`);

      await this.stockMovementService.receiveStock(
        line.storeId,
        [{ inventoryItemId: poLine.inventory_item_id, quantity: line.receivedQty, unitCost: parseFloat(poLine.unit_price) }],
        po.poNumber,
      );

      await this.dataSource.query(
        `UPDATE purchase_order_items
         SET received_qty = COALESCE(received_qty, 0) + $1,
             status = CASE WHEN COALESCE(received_qty, 0) + $1 >= quantity THEN 'RECEIVED' ELSE 'PARTIAL' END
         WHERE id = $2`,
        [line.receivedQty, line.poLineId],
      );
    }

    // Check if fully received
    const [pending] = await this.dataSource.query<Array<{ cnt: string }>>(
      `SELECT COUNT(*) AS cnt FROM purchase_order_items WHERE purchase_order_id = $1 AND status != 'RECEIVED'`,
      [poId],
    );
    const newStatus = parseInt(pending.cnt, 10) === 0 ? 'RECEIVED' : 'PARTIAL';
    await this.poRepo.update(poId, { status: newStatus });
    po.status = newStatus;
    return po;
  }

  async findAll(status?: string): Promise<PurchaseOrder[]> {
    const { hotelId } = this.tenantContext;
    const qb = this.poRepo.createQueryBuilder('po')
      .where('po.hotel_id = :hotelId', { hotelId })
      .orderBy('po.po_date', 'DESC');
    if (status) qb.andWhere('po.status = :status', { status });
    return qb.getMany();
  }

  async findById(id: string): Promise<PurchaseOrder & { lines: unknown[] }> {
    const { hotelId } = this.tenantContext;
    const po = await this.findOrFail(id, hotelId);
    const lines = await this.dataSource.query(
      `SELECT poi.*, ii.name AS item_name, ii.item_code
       FROM purchase_order_items poi
       JOIN inventory_items ii ON ii.id = poi.inventory_item_id
       WHERE poi.purchase_order_id = $1 ORDER BY poi.created_at ASC`,
      [id],
    );
    return { ...po, lines };
  }

  private async findOrFail(id: string, hotelId: string): Promise<PurchaseOrder> {
    const po = await this.poRepo.findOne({ where: { id, hotelId } });
    if (!po) throw new NotFoundException(`PurchaseOrder ${id} not found`);
    return po;
  }

  private async generatePoNumber(hotelId: string): Promise<string> {
    const today = new Date();
    const prefix = `PO${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.poRepo
      .createQueryBuilder('po')
      .where('po.hotel_id = :hotelId', { hotelId })
      .andWhere('po.po_number LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }
}
