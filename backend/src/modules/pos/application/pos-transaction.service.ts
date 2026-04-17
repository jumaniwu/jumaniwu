import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PosTransaction } from '../domain/pos-transaction.entity';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/events/event-bus.interface';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';
import { POSTransactionClosedEvent } from '../domain/pos.events';
import { RouteToRoomService } from './route-to-room.service';

export interface OpenTransactionDto {
  posOutletId: string;
  captainOrderId?: string;
  guestId?: string;
  companyId?: string;
}

export interface AddTransactionItemDto {
  posItemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  taxRate?: number;
  discountAmount?: number;
}

export interface PaymentLineDto {
  paymentMethod: string;
  amount: number;
  referenceNumber?: string;
  cardLastFour?: string;
  cardBrand?: string;
}

export interface CloseTransactionDto {
  payments: PaymentLineDto[];
  discountAmount?: number;
}

export interface CloseWithRTRDto {
  roomNumber: string;
}

@Injectable()
export class PosTransactionService {
  constructor(
    @InjectRepository(PosTransaction)
    private readonly txRepo: Repository<PosTransaction>,
    private readonly dataSource: DataSource,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly routeToRoomService: RouteToRoomService,
    private readonly tenantContext: TenantContext,
  ) {}

  async openTransaction(dto: OpenTransactionDto): Promise<PosTransaction> {
    const { hotelId, userId } = this.tenantContext;
    const transactionNo = await this.generateTransactionNo(hotelId);

    // If from captain order, copy items
    let subtotal = 0;
    if (dto.captainOrderId) {
      const items = await this.dataSource.query<Array<{ line_total: string }>>(
        `SELECT line_total FROM captain_order_items WHERE captain_order_id = $1 AND is_void = false`,
        [dto.captainOrderId],
      );
      subtotal = items.reduce((s, i) => s + parseFloat(i.line_total), 0);
    }

    const tx = this.txRepo.create({
      hotelId,
      posOutletId: dto.posOutletId,
      captainOrderId: dto.captainOrderId,
      guestId: dto.guestId,
      companyId: dto.companyId,
      transactionNo,
      status: 'OPEN',
      subtotal,
      taxAmount: subtotal * 0.11,
      serviceCharge: subtotal * 0.10,
      totalAmount: subtotal * 1.21,
      cashierId: userId,
      openedAt: new Date(),
    });
    return this.txRepo.save(tx);
  }

  async addItem(transactionId: string, dto: AddTransactionItemDto): Promise<void> {
    const { hotelId } = this.tenantContext;
    const tx = await this.findTxOrFail(transactionId, hotelId);
    if (tx.status !== 'OPEN') throw new BadRequestException('Transaction is not open');

    const taxAmount = dto.unitPrice * dto.quantity * (dto.taxRate ?? 0.11);
    const lineTotal = dto.unitPrice * dto.quantity - (dto.discountAmount ?? 0) + taxAmount;

    await this.dataSource.query(
      `INSERT INTO pos_transaction_items
         (pos_transaction_id, pos_item_id, item_name, unit_price, quantity,
          discount_amount, tax_rate, tax_amount, line_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [transactionId, dto.posItemId, dto.itemName, dto.unitPrice, dto.quantity,
       dto.discountAmount ?? 0, dto.taxRate ?? 0.11, taxAmount, lineTotal],
    );
    await this.recalculateTotals(transactionId, hotelId);
  }

  async closeWithPayment(transactionId: string, dto: CloseTransactionDto): Promise<PosTransaction> {
    const { hotelId, userId } = this.tenantContext;
    const tx = await this.findTxOrFail(transactionId, hotelId);
    if (tx.status !== 'OPEN') throw new BadRequestException('Transaction already closed');

    const totalPaid = dto.payments.reduce((s, p) => s + p.amount, 0);
    if (totalPaid < Number(tx.totalAmount) - 0.01) {
      throw new BadRequestException(
        `Payment of ${totalPaid} is less than total ${tx.totalAmount}`,
      );
    }

    await this.dataSource.transaction(async (mgr) => {
      if (dto.discountAmount) {
        await mgr.update(PosTransaction, transactionId, { discountAmount: dto.discountAmount });
        await this.recalculateTotals(transactionId, hotelId);
      }

      for (const payment of dto.payments) {
        await mgr.query(
          `INSERT INTO pos_payments
             (hotel_id, pos_transaction_id, payment_method, amount, reference_number,
              card_last_four, card_brand, status, processed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'APPROVED',NOW())`,
          [hotelId, transactionId, payment.paymentMethod, payment.amount,
           payment.referenceNumber ?? null, payment.cardLastFour ?? null, payment.cardBrand ?? null],
        );
      }

      await mgr.update(PosTransaction, transactionId, {
        status: 'CLOSED',
        closedAt: new Date(),
        cashierId: userId,
      });
    });

    const closed = await this.findTxOrFail(transactionId, hotelId);
    await this.eventBus.publish(
      new POSTransactionClosedEvent(
        hotelId, transactionId, closed.posOutletId,
        Number(closed.totalAmount), Number(closed.taxAmount),
      ),
    );
    return closed;
  }

  async closeWithRouteToRoom(transactionId: string, dto: CloseWithRTRDto): Promise<PosTransaction> {
    const { hotelId } = this.tenantContext;
    const tx = await this.findTxOrFail(transactionId, hotelId);
    if (tx.status !== 'OPEN') throw new BadRequestException('Transaction already closed');

    await this.routeToRoomService.routeCharge({
      roomNumber: dto.roomNumber,
      posTransactionId: transactionId,
      amount: Number(tx.totalAmount),
      description: `POS charge from outlet — ${tx.transactionNo}`,
      outletId: tx.posOutletId,
    });

    await this.txRepo.update(transactionId, { status: 'CLOSED', closedAt: new Date() });
    tx.status = 'CLOSED';
    return tx;
  }

  async findById(id: string): Promise<PosTransaction> {
    const { hotelId } = this.tenantContext;
    return this.findTxOrFail(id, hotelId);
  }

  private async recalculateTotals(transactionId: string, hotelId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE pos_transactions SET
         subtotal = COALESCE((
           SELECT SUM(unit_price * quantity - discount_amount)
           FROM pos_transaction_items WHERE pos_transaction_id = $1 AND is_void = false
         ), 0),
         tax_amount = COALESCE((
           SELECT SUM(tax_amount)
           FROM pos_transaction_items WHERE pos_transaction_id = $1 AND is_void = false
         ), 0),
         total_amount = COALESCE((
           SELECT SUM(line_total)
           FROM pos_transaction_items WHERE pos_transaction_id = $1 AND is_void = false
         ), 0)
       WHERE id = $1`,
      [transactionId],
    );
  }

  private async findTxOrFail(id: string, hotelId: string): Promise<PosTransaction> {
    const tx = await this.txRepo.findOne({ where: { id, hotelId } });
    if (!tx) throw new NotFoundException(`PosTransaction ${id} not found`);
    return tx;
  }

  private async generateTransactionNo(hotelId: string): Promise<string> {
    const today = new Date();
    const prefix = `TX${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await this.txRepo
      .createQueryBuilder('t')
      .where('t.hotel_id = :hotelId', { hotelId })
      .andWhere('t.transaction_no LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}
