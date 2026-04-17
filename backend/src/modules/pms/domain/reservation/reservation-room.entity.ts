import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('reservation_rooms')
export class ReservationRoom extends TenantEntity {
  @Column({ name: 'reservation_id', type: 'uuid' })
  reservationId: string;

  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string;

  @Column({ name: 'room_type_id', type: 'uuid' })
  roomTypeId: string;

  @Column({ name: 'rate_plan_id', type: 'uuid', nullable: true })
  ratePlanId: string;

  @Column({ name: 'package_id', type: 'uuid', nullable: true })
  packageId: string;

  @Column({ name: 'check_in_date', type: 'date' })
  checkInDate: Date;

  @Column({ name: 'check_out_date', type: 'date' })
  checkOutDate: Date;

  @Column({ type: 'int', default: 1 })
  adults: number;

  @Column({ type: 'int', default: 0 })
  children: number;

  @Column({ name: 'rate_per_night', type: 'decimal', precision: 15, scale: 2 })
  ratePerNight: number;

  @Column({ name: 'meal_plan', length: 5, default: 'RO' })
  mealPlan: string;

  @Column({ name: 'breakfast_included', default: false })
  breakfastIncluded: boolean;

  @Column({ length: 20, default: 'RESERVED' })
  status: string;

  @Column({ name: 'actual_check_in_at', type: 'timestamptz', nullable: true })
  actualCheckInAt: Date;

  @Column({ name: 'actual_check_out_at', type: 'timestamptz', nullable: true })
  actualCheckOutAt: Date;

  @Column({ name: 'checked_in_by', type: 'uuid', nullable: true })
  checkedInBy: string;

  @Column({ name: 'checked_out_by', type: 'uuid', nullable: true })
  checkedOutBy: string;
}
