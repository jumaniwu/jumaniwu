import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('channels')
export class Channel extends TenantEntity {
  @Column({ length: 30 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'channel_type', length: 20, default: 'OTA' })
  channelType: string;

  @Column({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionRate: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'api_credentials', type: 'jsonb', nullable: true, select: false })
  apiCredentials: Record<string, string>;

  @Column({ name: 'last_push_at', type: 'timestamptz', nullable: true })
  lastPushAt: Date;

  @Column({ name: 'last_pull_at', type: 'timestamptz', nullable: true })
  lastPullAt: Date;

  @Column({ name: 'sync_status', length: 20, default: 'DISCONNECTED' })
  syncStatus: string;
}
