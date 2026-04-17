import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  HOTEL_ADMIN = 'HOTEL_ADMIN',
  FRONT_DESK = 'FRONT_DESK',
  CASHIER = 'CASHIER',
  HOUSEKEEPING = 'HOUSEKEEPING',
  NIGHT_AUDIT = 'NIGHT_AUDIT',
  ACCOUNTING = 'ACCOUNTING',
  INVENTORY = 'INVENTORY',
  MANAGER = 'MANAGER',
  AUDITOR = 'AUDITOR',
  READONLY = 'READONLY',
}

@Entity('users')
export class User extends TenantEntity {
  @Column({ length: 200 })
  email: string;

  @Column({ name: 'password_hash', length: 200, select: false })
  passwordHash: string;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ length: 30, default: UserRole.FRONT_DESK })
  role: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date;
}
