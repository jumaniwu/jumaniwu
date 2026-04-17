import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JournalEntryService, JournalLineInput } from './journal-entry.service';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

/**
 * Journal rule record from the `journal_rules` DB table.
 * Each rule maps a domain event to one or more debit/credit account pairs.
 */
interface JournalRule {
  id: string;
  eventName: string;
  debitAccountCode: string;
  creditAccountCode: string;
  description: string;
  subDepartmentRequired: boolean;
}

interface LedgerAccountRef {
  id: string;
  code: string;
}

export interface AutoJournalInput {
  hotelId: string;
  accountingPeriodId?: string | null;
  eventName: string;
  sourceEntityId: string;
  amount: number;
  taxAmount?: number;
  description: string;
  subDepartmentId?: string;
  currencyCode?: string;
}

@Injectable()
export class JournalRuleEngineService {
  private readonly logger = new Logger(JournalRuleEngineService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly journalEntryService: JournalEntryService,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * Load rules from DB and auto-create double-entry journal for a domain event.
   * Rules are stored in `journal_rules` table — no hardcoded account mappings here.
   */
  async applyRulesForEvent(input: AutoJournalInput): Promise<void> {
    const rules = await this.loadRules(input.hotelId, input.eventName);
    if (rules.length === 0) {
      this.logger.warn(
        `No journal rules found for event=${input.eventName} hotel=${input.hotelId}`,
      );
      return;
    }

    const periodId = input.accountingPeriodId ?? (await this.getOpenPeriodId(input.hotelId));
    if (!periodId) {
      this.logger.error(`No open accounting period for hotel=${input.hotelId}`);
      return;
    }

    for (const rule of rules) {
      try {
        const debitAccount = await this.resolveAccount(input.hotelId, rule.debitAccountCode);
        const creditAccount = await this.resolveAccount(input.hotelId, rule.creditAccountCode);

        if (!debitAccount || !creditAccount) {
          this.logger.warn(
            `Skipping rule ${rule.id}: account not found ` +
            `(DR=${rule.debitAccountCode}, CR=${rule.creditAccountCode})`,
          );
          continue;
        }

        const lines: JournalLineInput[] = [
          {
            ledgerAccountId: debitAccount.id,
            entryType: 'DEBIT',
            amount: input.amount,
            description: input.description,
            subDepartmentId: input.subDepartmentId,
            currencyCode: input.currencyCode ?? 'IDR',
          },
          {
            ledgerAccountId: creditAccount.id,
            entryType: 'CREDIT',
            amount: input.amount,
            description: input.description,
            subDepartmentId: input.subDepartmentId,
            currencyCode: input.currencyCode ?? 'IDR',
          },
        ];

        // If there's tax, add separate tax lines using convention: append TAX_ prefix to credit account code
        if (input.taxAmount && input.taxAmount > 0) {
          const taxCreditAccount = await this.resolveAccount(
            input.hotelId,
            `TAX_${rule.creditAccountCode}`,
          );
          if (taxCreditAccount) {
            lines.push(
              {
                ledgerAccountId: debitAccount.id,
                entryType: 'DEBIT',
                amount: input.taxAmount,
                description: `${input.description} — Tax`,
                subDepartmentId: input.subDepartmentId,
                currencyCode: input.currencyCode ?? 'IDR',
              },
              {
                ledgerAccountId: taxCreditAccount.id,
                entryType: 'CREDIT',
                amount: input.taxAmount,
                description: `${input.description} — Tax`,
                currencyCode: input.currencyCode ?? 'IDR',
              },
            );
          }
        }

        await this.journalEntryService.createAndPost({
          accountingPeriodId: periodId,
          entryDate: new Date(),
          description: `${rule.description}: ${input.description}`,
          sourceModule: input.eventName.split('.')[0].toUpperCase(),
          sourceEvent: input.eventName,
          sourceEntityId: input.sourceEntityId,
          currencyCode: input.currencyCode ?? 'IDR',
          lines,
        });

        this.logger.debug(
          `Auto-journaled event=${input.eventName} amount=${input.amount} ` +
          `DR=${rule.debitAccountCode} CR=${rule.creditAccountCode}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to apply journal rule ${rule.id} for event=${input.eventName}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async loadRules(hotelId: string, eventName: string): Promise<JournalRule[]> {
    const rows = await this.dataSource.query<JournalRule[]>(
      `SELECT id, event_name AS "eventName",
              debit_account_code AS "debitAccountCode",
              credit_account_code AS "creditAccountCode",
              description,
              sub_department_required AS "subDepartmentRequired"
       FROM journal_rules
       WHERE hotel_id = $1
         AND event_name = $2
         AND is_active = true
       ORDER BY priority ASC`,
      [hotelId, eventName],
    );
    return rows;
  }

  private async resolveAccount(
    hotelId: string,
    code: string,
  ): Promise<LedgerAccountRef | null> {
    const rows = await this.dataSource.query<LedgerAccountRef[]>(
      `SELECT id, account_code AS code
       FROM ledger_accounts
       WHERE hotel_id = $1 AND account_code = $2 AND is_active = true
       LIMIT 1`,
      [hotelId, code],
    );
    return rows[0] ?? null;
  }

  private async getOpenPeriodId(hotelId: string): Promise<string | null> {
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM accounting_periods
       WHERE hotel_id = $1 AND status = 'OPEN'
       ORDER BY year DESC, month DESC
       LIMIT 1`,
      [hotelId],
    );
    return rows[0]?.id ?? null;
  }
}
