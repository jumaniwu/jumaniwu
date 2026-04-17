import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('rate_plans')
export class RatePlan extends TenantEntity {
  @Column({ name: 'room_type_id', type: 'uuid' })
  roomTypeId: string;

  @Column({ length: 20 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'meal_plan', length: 5, default: 'RO' })
  mealPlan: string;

  @Column({ name: 'cancel_policy', length: 20, default: 'FLEXIBLE' })
  cancelPolicy: string;

  @Column({ name: 'min_stay', type: 'int', default: 1 })
  minStay: number;

  @Column({ name: 'max_stay', type: 'int', nullable: true })
  maxStay: number;

  @Column({ name: 'advance_book_min', type: 'int', default: 0 })
  advanceBookMin: number;

  @Column({ name: 'advance_book_max', type: 'int', nullable: true })
  advanceBookMax: number;

  @Column({ name: 'is_refundable', default: true })
  isRefundable: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
