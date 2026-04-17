import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('room_types')
export class RoomType extends TenantEntity {
  @Column({ length: 20 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'max_occupancy', type: 'int', default: 2 })
  maxOccupancy: number;

  @Column({ name: 'base_adults', type: 'int', default: 2 })
  baseAdults: number;

  @Column({ name: 'bed_type', length: 20, default: 'DOUBLE' })
  bedType: string;

  @Column({ name: 'base_rate', type: 'decimal', precision: 15, scale: 2, default: 0 })
  baseRate: number;

  @Column({ type: 'jsonb', nullable: true })
  amenities: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
