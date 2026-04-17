import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JournalEntry, JournalEntryStatus } from '../domain/journal-entry.entity';
import { JournalEntryLine } from '../domain/journal-entry-line.entity';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

export interface JournalLineInput {
  ledgerAccountId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  description?: string;
  subDepartmentId?: string;
  currencyCode?: string;
  exchangeRate?: number;
}

export interface CreateJournalEntryDto {
  accountingPeriodId: string;
  entryDate: Date;
  description: string;
  sourceModule: string;
  sourceEvent?: string;
  sourceEntityId?: string;
  currencyCode?: string;
  lines: JournalLineInput[];
}

@Injectable()
export class JournalEntryService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalRepo: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private readonly lineRepo: Repository<JournalEntryLine>,
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContext,
  ) {}

  async createAndPost(dto: CreateJournalEntryDto): Promise<JournalEntry> {
    const { hotelId, userId } = this.tenantContext;
    this.validateBalance(dto.lines);

    const entryNumber = await this.generateEntryNumber(hotelId);
    const totalDebit = dto.lines
      .filter((l) => l.entryType === 'DEBIT')
      .reduce((s, l) => s + l.amount, 0);
    const totalCredit = dto.lines
      .filter((l) => l.entryType === 'CREDIT')
      .reduce((s, l) => s + l.amount, 0);

    return this.dataSource.transaction(async (manager) => {
      const entry = manager.create(JournalEntry, {
        hotelId,
        accountingPeriodId: dto.accountingPeriodId,
        entryNumber,
        entryDate: dto.entryDate,
        description: dto.description,
        sourceModule: dto.sourceModule,
        sourceEvent: dto.sourceEvent,
        sourceEntityId: dto.sourceEntityId,
        status: JournalEntryStatus.POSTED,
        totalDebit,
        totalCredit,
        currencyCode: dto.currencyCode ?? 'IDR',
        createdBy: userId,
        postedAt: new Date(),
      });
      const savedEntry = await manager.save(entry);

      const lines = dto.lines.map((l, idx) =>
        manager.create(JournalEntryLine, {
          hotelId,
          journalEntryId: savedEntry.id,
          ledgerAccountId: l.ledgerAccountId,
          entryType: l.entryType,
          amount: l.amount,
          description: l.description,
          subDepartmentId: l.subDepartmentId,
          currencyCode: l.currencyCode ?? dto.currencyCode ?? 'IDR',
          exchangeRate: l.exchangeRate ?? 1,
          lineNumber: idx + 1,
        }),
      );
      await manager.save(lines);

      return savedEntry;
    });
  }

  async reverseEntry(journalEntryId: string, reason: string): Promise<JournalEntry> {
    const { hotelId, userId } = this.tenantContext;
    const original = await this.journalRepo.findOne({ where: { id: journalEntryId, hotelId } });
    if (!original) throw new NotFoundException(`Journal entry ${journalEntryId} not found`);
    if (original.status !== JournalEntryStatus.POSTED) {
      throw new BadRequestException('Only POSTED entries can be reversed');
    }

    const originalLines = await this.lineRepo.find({ where: { journalEntryId, hotelId } });
    const entryNumber = await this.generateEntryNumber(hotelId);

    return this.dataSource.transaction(async (manager) => {
      const reversal = manager.create(JournalEntry, {
        hotelId,
        accountingPeriodId: original.accountingPeriodId,
        entryNumber,
        entryDate: new Date(),
        description: `REVERSAL: ${original.description} — ${reason}`,
        sourceModule: original.sourceModule,
        sourceEvent: `REVERSAL_OF_${original.id}`,
        status: JournalEntryStatus.POSTED,
        totalDebit: original.totalCredit,
        totalCredit: original.totalDebit,
        currencyCode: original.currencyCode,
        createdBy: userId,
        postedAt: new Date(),
      });
      const savedReversal = await manager.save(reversal);

      const reversalLines = originalLines.map((l, idx) =>
        manager.create(JournalEntryLine, {
          hotelId,
          journalEntryId: savedReversal.id,
          ledgerAccountId: l.ledgerAccountId,
          entryType: l.entryType === 'DEBIT' ? 'CREDIT' : 'DEBIT',
          amount: l.amount,
          description: l.description,
          subDepartmentId: l.subDepartmentId,
          currencyCode: l.currencyCode,
          exchangeRate: l.exchangeRate,
          lineNumber: idx + 1,
        }),
      );
      await manager.save(reversalLines);

      // Mark original as reversed
      await manager.update(JournalEntry, journalEntryId, {
        status: JournalEntryStatus.REVERSED,
        reversedById: savedReversal.id,
      });

      return savedReversal;
    });
  }

  async findBySourceEntity(sourceEntityId: string): Promise<JournalEntry[]> {
    const { hotelId } = this.tenantContext;
    return this.journalRepo.find({ where: { sourceEntityId, hotelId } });
  }

  private validateBalance(lines: JournalLineInput[]): void {
    const totalDebit = lines.filter((l) => l.entryType === 'DEBIT').reduce((s, l) => s + l.amount, 0);
    const totalCredit = lines.filter((l) => l.entryType === 'CREDIT').reduce((s, l) => s + l.amount, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        `Journal entry is not balanced: Debit=${totalDebit} Credit=${totalCredit}`,
      );
    }
  }

  private async generateEntryNumber(hotelId: string): Promise<string> {
    const today = new Date();
    const prefix = `JE${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.journalRepo
      .createQueryBuilder('j')
      .where('j.hotel_id = :hotelId', { hotelId })
      .andWhere('j.entry_number LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();
    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }
}
