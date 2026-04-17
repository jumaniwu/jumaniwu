import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('purchase_orders')
export class PurchaseOrder extends TenantEntity {
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'po_number', length: 30, unique: true })
  poNumber: string;

  @Column({ name: 'po_date', type: 'date' })
  poDate: Date;

  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate: Date;

  @Column({ length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'currency_code', length: 3, default: 'IDR' })
  currencyCode: string;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;
}
