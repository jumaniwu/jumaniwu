import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

export enum FolioItemType {
  ROOM_RATE = 'ROOM_RATE',
  POS_CHARGE = 'POS_CHARGE',
  BREAKFAST = 'BREAKFAST',
  TAX = 'TAX',
  SERVICE_CHARGE = 'SERVICE_CHARGE',
  FEE = 'FEE',
  DISCOUNT = 'DISCOUNT',
  PAYMENT = 'PAYMENT',
  DEPOSIT = 'DEPOSIT',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
}

@Entity('folio_items')
export class FolioItem extends TenantEntity {
  @Column({ name: 'folio_id', type: 'uuid' })
  folioId: string;

  @Column({ name: 'pos_transaction_id', type: 'uuid', nullable: true })
  posTransactionId: string;

  @Column({ name: 'reservation_room_id', type: 'uuid', nullable: true })
  reservationRoomId: string;

  @Column({ name: 'captain_order_id', type: 'uuid', nullable: true })
  captainOrderId: string;

  @Column({ name: 'sub_department_id', type: 'uuid', nullable: true })
  subDepartmentId: string;

  @Column({ name: 'item_type', type: 'enum', enum: FolioItemType })
  itemType: FolioItemType;

  @Column({ length: 300 })
  description: string;

  @Column({ name: 'charge_date', type: 'date' })
  chargeDate: Date;

  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'tax_code', length: 20, nullable: true })
  taxCode: string;

  @Column({ name: 'currency_code', length: 3, default: 'IDR' })
  currencyCode: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 15, scale: 6, default: 1 })
  exchangeRate: number;

  @Column({ name: 'is_void', default: false })
  isVoid: boolean;

  @Column({ name: 'voided_by', type: 'uuid', nullable: true })
  voidedBy: string;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;
}
