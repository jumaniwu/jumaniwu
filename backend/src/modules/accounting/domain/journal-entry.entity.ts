import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

@Entity('journal_entries')
export class JournalEntry extends TenantEntity {
  @Column({ name: 'accounting_period_id', type: 'uuid' })
  accountingPeriodId: string;

  @Column({ name: 'entry_number', length: 30, unique: true })
  entryNumber: string;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: Date;

  @Column({ length: 500 })
  description: string;

  @Column({ name: 'source_module', length: 20 })
  sourceModule: string;

  @Column({ name: 'source_event', length: 100, nullable: true })
  sourceEvent: string;

  @Column({ name: 'source_entity_id', type: 'uuid', nullable: true })
  sourceEntityId: string;

  @Column({ type: 'enum', enum: JournalEntryStatus, default: JournalEntryStatus.DRAFT })
  status: JournalEntryStatus;

  @Column({ name: 'reversed_by_id', type: 'uuid', nullable: true })
  reversedById: string;

  @Column({ name: 'total_debit', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDebit: number;

  @Column({ name: 'total_credit', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCredit: number;

  @Column({ name: 'currency_code', length: 3, default: 'IDR' })
  currencyCode: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt: Date;
}
