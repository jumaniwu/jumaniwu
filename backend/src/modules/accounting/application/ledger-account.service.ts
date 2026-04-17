import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerAccount, AccountType } from '../domain/ledger-account.entity';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

export interface CreateLedgerAccountDto {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  parentId?: string;
  level?: number;
  isPostingAccount?: boolean;
  normalBalance?: string;
  sortOrder?: number;
  subDepartmentId?: string;
}

export interface CoaTreeNode extends LedgerAccount {
  children: CoaTreeNode[];
}

@Injectable()
export class LedgerAccountService {
  constructor(
    @InjectRepository(LedgerAccount)
    private readonly accountRepo: Repository<LedgerAccount>,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateLedgerAccountDto): Promise<LedgerAccount> {
    const { hotelId } = this.tenantContext;
    const account = this.accountRepo.create({ hotelId, ...dto });
    return this.accountRepo.save(account);
  }

  async findAll(accountType?: AccountType): Promise<LedgerAccount[]> {
    const { hotelId } = this.tenantContext;
    const qb = this.accountRepo
      .createQueryBuilder('la')
      .where('la.hotel_id = :hotelId', { hotelId })
      .andWhere('la.is_active = true')
      .orderBy('la.sort_order', 'ASC')
      .addOrderBy('la.account_code', 'ASC');
    if (accountType) qb.andWhere('la.account_type = :accountType', { accountType });
    return qb.getMany();
  }

  async getCoaTree(): Promise<CoaTreeNode[]> {
    const { hotelId } = this.tenantContext;
    const all = await this.accountRepo.find({
      where: { hotelId, isActive: true },
      order: { sortOrder: 'ASC', accountCode: 'ASC' },
    });
    return this.buildTree(all, null);
  }

  async findById(id: string): Promise<LedgerAccount> {
    const { hotelId } = this.tenantContext;
    const acc = await this.accountRepo.findOne({ where: { id, hotelId } });
    if (!acc) throw new NotFoundException(`LedgerAccount ${id} not found`);
    return acc;
  }

  async findByCode(code: string): Promise<LedgerAccount> {
    const { hotelId } = this.tenantContext;
    const acc = await this.accountRepo.findOne({ where: { accountCode: code, hotelId } });
    if (!acc) throw new NotFoundException(`Account with code ${code} not found`);
    return acc;
  }

  async update(id: string, dto: Partial<CreateLedgerAccountDto>): Promise<LedgerAccount> {
    const { hotelId } = this.tenantContext;
    await this.accountRepo.update({ id, hotelId }, dto);
    return this.findById(id);
  }

  async deactivate(id: string): Promise<void> {
    const { hotelId } = this.tenantContext;
    await this.accountRepo.update({ id, hotelId }, { isActive: false });
  }

  private buildTree(accounts: LedgerAccount[], parentId: string | null): CoaTreeNode[] {
    return accounts
      .filter((a) => a.parentId === parentId)
      .map((a) => ({
        ...a,
        children: this.buildTree(accounts, a.id),
      }));
  }
}
