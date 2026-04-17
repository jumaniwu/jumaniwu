import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('pos_transactions')
export class PosTransaction extends TenantEntity {
  @Column({ name: 'pos_outlet_id', type: 'uuid' })
  posOutletId: string;

  @Column({ name: 'captain_order_id', type: 'uuid', nullable: true })
  captainOrderId: string;

  @Column({ name: 'guest_id', type: 'uuid', nullable: true })
  guestId: string;

  @Column({ name: 'folio_id', type: 'uuid', nullable: true })
  folioId: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string;

  @Column({ name: 'transaction_no', length: 30, unique: true })
  transactionNo: string;

  @Column({ length: 20, default: 'OPEN' })
  status: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'service_charge', type: 'decimal', precision: 15, scale: 2, default: 0 })
  serviceCharge: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'currency_code', length: 3, default: 'IDR' })
  currencyCode: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 15, scale: 6, default: 1 })
  exchangeRate: number;

  @Column({ name: 'cashier_id', type: 'uuid', nullable: true })
  cashierId: string;

  @Column({ name: 'opened_at', type: 'timestamptz' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date;
}
