import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('captain_orders')
export class CaptainOrder extends TenantEntity {
  @Column({ name: 'pos_outlet_id', type: 'uuid' })
  posOutletId: string;

  @Column({ name: 'pos_table_id', type: 'uuid', nullable: true })
  posTableId: string;

  @Column({ name: 'guest_id', type: 'uuid', nullable: true })
  guestId: string;

  @Column({ name: 'order_number', length: 30, unique: true })
  orderNumber: string;

  @Column({ length: 30, default: 'OPEN' })
  status: string;

  @Column({ name: 'order_type', length: 20, default: 'DINE_IN' })
  orderType: string;

  @Column({ name: 'room_number', length: 10, nullable: true })
  roomNumber: string;

  @Column({ type: 'int', default: 1 })
  covers: number;

  @Column({ name: 'served_by', type: 'uuid', nullable: true })
  servedBy: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ name: 'ordered_at', type: 'timestamptz' })
  orderedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;
}
