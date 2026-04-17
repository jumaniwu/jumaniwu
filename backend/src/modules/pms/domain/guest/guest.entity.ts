import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('guests')
export class Guest extends TenantEntity {
  @Column({ length: 10, nullable: true })
  title: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ length: 200, nullable: true, unique: false })
  email: string;

  @Column({ length: 30, nullable: true })
  phone: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ length: 50, nullable: true })
  nationality: string;

  @Column({ name: 'id_type', length: 20, nullable: true })
  idType: string;

  @Column({ name: 'id_number', length: 50, nullable: true })
  idNumber: string;

  @Column({ name: 'guest_type', length: 20, default: 'FIT' })
  guestType: string;

  @Column({ name: 'loyalty_tier', length: 20, default: 'NONE' })
  loyaltyTier: string;

  @Column({ name: 'loyalty_points', type: 'int', default: 0 })
  loyaltyPoints: number;

  @Column({ name: 'visit_count', type: 'int', default: 0 })
  visitCount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  preferences: Record<string, unknown>;
}
