import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

@Entity('ledger_accounts')
export class LedgerAccount extends TenantEntity {
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string;

  @Column({ name: 'sub_department_id', type: 'uuid', nullable: true })
  subDepartmentId: string;

  @Column({ name: 'account_code', length: 20 })
  accountCode: string;

  @Column({ name: 'account_name', length: 200 })
  accountName: string;

  @Column({ name: 'account_type', type: 'enum', enum: AccountType })
  accountType: AccountType;

  @Column({ name: 'account_subtype', length: 50, nullable: true })
  accountSubtype: string;

  @Column({ name: 'normal_balance', length: 10, default: 'DEBIT' })
  normalBalance: string;

  @Column({ name: 'is_posting_account', default: true })
  isPostingAccount: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
