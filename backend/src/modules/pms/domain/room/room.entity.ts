import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

export enum HousekeepingStatus {
  CLEAN = 'CLEAN',
  DIRTY = 'DIRTY',
  INSPECTED = 'INSPECTED',
  OOO = 'OOO',
  OOS = 'OOS',
}

export enum OccupancyStatus {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
}

@Entity('rooms')
export class Room extends TenantEntity {
  @Column({ name: 'room_type_id', type: 'uuid' })
  roomTypeId: string;

  @Column({ name: 'room_number', length: 10 })
  roomNumber: string;

  @Column({ type: 'int', nullable: true })
  floor: number;

  @Column({ length: 50, nullable: true })
  building: string;

  @Column({ name: 'pos_x', type: 'decimal', precision: 8, scale: 2, nullable: true })
  posX: number;

  @Column({ name: 'pos_y', type: 'decimal', precision: 8, scale: 2, nullable: true })
  posY: number;

  @Column({
    name: 'hk_status',
    type: 'enum',
    enum: HousekeepingStatus,
    default: HousekeepingStatus.CLEAN,
  })
  hkStatus: HousekeepingStatus;

  @Column({
    name: 'occupancy_status',
    type: 'enum',
    enum: OccupancyStatus,
    default: OccupancyStatus.VACANT,
  })
  occupancyStatus: OccupancyStatus;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_cleaned_at', type: 'timestamptz', nullable: true })
  lastCleanedAt: Date;
}
