import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerAccount } from './domain/ledger-account.entity';
import { JournalEntry } from './domain/journal-entry.entity';
import { JournalEntryLine } from './domain/journal-entry-line.entity';
import { LedgerAccountController } from './api/ledger-account.controller';
import { JournalEntryController } from './api/journal-entry.controller';
import { LedgerAccountService } from './application/ledger-account.service';
import { JournalEntryService } from './application/journal-entry.service';
import { JournalRuleEngineService } from './application/journal-rule-engine.service';
import { PmsAccountingEventHandler } from './infrastructure/pms-accounting.event-handler';
import { PosAccountingEventHandler } from './infrastructure/pos-accounting.event-handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerAccount, JournalEntry, JournalEntryLine]),
  ],
  controllers: [LedgerAccountController, JournalEntryController],
  providers: [
    LedgerAccountService,
    JournalEntryService,
    JournalRuleEngineService,
    PmsAccountingEventHandler,
    PosAccountingEventHandler,
  ],
  exports: [JournalEntryService, JournalRuleEngineService],
})
export class AccountingModule {}
