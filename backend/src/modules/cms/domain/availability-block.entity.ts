import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('availability_blocks')
@Index(['hotelId', 'roomTypeId', 'date'], { unique: true })
export class AvailabilityBlock extends TenantEntity {
  @Column({ name: 'room_type_id', type: 'uuid' })
  roomTypeId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ name: 'total_rooms', type: 'int', default: 0 })
  totalRooms: number;

  @Column({ name: 'available_rooms', type: 'int', default: 0 })
  availableRooms: number;

  @Column({ name: 'booked_rooms', type: 'int', default: 0 })
  bookedRooms: number;

  @Column({ name: 'ooo_rooms', type: 'int', default: 0 })
  oooRooms: number;

  @Column({ name: 'stop_sell', default: false })
  stopSell: boolean;

  @Column({ name: 'closed_to_arrival', default: false })
  closedToArrival: boolean;

  @Column({ name: 'closed_to_departure', default: false })
  closedToDeparture: boolean;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date;
}
