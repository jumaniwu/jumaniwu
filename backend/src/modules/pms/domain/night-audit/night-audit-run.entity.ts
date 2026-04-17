import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('night_audit_runs')
export class NightAuditRun extends TenantEntity {
  @Column({ name: 'audit_date', type: 'date' })
  auditDate: Date;

  @Column({ length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'rooms_processed', type: 'int', default: 0 })
  roomsProcessed: number;

  @Column({ name: 'folios_posted', type: 'int', default: 0 })
  foliosPosted: number;

  @Column({ name: 'total_room_revenue', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalRoomRevenue: number;

  @Column({ name: 'total_fnb_revenue', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalFnbRevenue: number;

  @Column({ name: 'total_tax', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalTax: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'run_by', type: 'uuid', nullable: true })
  runBy: string;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;
}
