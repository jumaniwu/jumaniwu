import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

export enum FolioType {
  MASTER = 'MASTER',
  DESK = 'DESK',
  CITY_LEDGER = 'CITY_LEDGER',
}

export enum FolioStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  SETTLED = 'SETTLED',
  TRANSFERRED = 'TRANSFERRED',
}

@Entity('folios')
export class Folio extends TenantEntity {
  @Column({ name: 'reservation_id', type: 'uuid', nullable: true })
  reservationId: string;

  @Column({ name: 'guest_id', type: 'uuid' })
  guestId: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string;

  @Column({ name: 'parent_folio_id', type: 'uuid', nullable: true })
  parentFolioId: string;

  @Column({ name: 'folio_number', length: 30, unique: true })
  folioNumber: string;

  @Column({ name: 'folio_type', type: 'enum', enum: FolioType, default: FolioType.MASTER })
  folioType: FolioType;

  @Column({ type: 'enum', enum: FolioStatus, default: FolioStatus.OPEN })
  status: FolioStatus;

  @Column({ name: 'total_charges', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCharges: number;

  @Column({ name: 'total_payments', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPayments: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  @Column({ name: 'credit_limit', type: 'decimal', precision: 15, scale: 2, default: 0 })
  creditLimit: number;

  @Column({ name: 'currency_code', length: 3, default: 'IDR' })
  currencyCode: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'opened_by', type: 'uuid', nullable: true })
  openedBy: string;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt: Date;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy: string;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date;
}
