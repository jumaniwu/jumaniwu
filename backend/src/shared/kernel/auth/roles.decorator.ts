import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.guard';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

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
