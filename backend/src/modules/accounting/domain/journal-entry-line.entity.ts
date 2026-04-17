import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('journal_entry_lines')
export class JournalEntryLine extends TenantEntity {
  @Column({ name: 'journal_entry_id', type: 'uuid' })
  journalEntryId: string;

  @Column({ name: 'ledger_account_id', type: 'uuid' })
  ledgerAccountId: string;

  @Column({ name: 'sub_department_id', type: 'uuid', nullable: true })
  subDepartmentId: string;

  @Column({ name: 'entry_type', length: 10 })
  entryType: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ name: 'currency_code', length: 3, default: 'IDR' })
  currencyCode: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 15, scale: 6, default: 1 })
  exchangeRate: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'line_number', type: 'int' })
  lineNumber: number;
}
