import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Folio, FolioType, FolioStatus } from '../domain/folio/folio.entity';
import { FolioItem, FolioItemType } from '../domain/folio/folio-item.entity';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/events/event-bus.interface';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';
import { FolioChargePostedEvent } from '../domain/pms.events';

export interface PostChargeDto {
  folioId: string;
  itemType: FolioItemType;
  description: string;
  chargeDate: string;
  unitPrice: number;
  quantity?: number;
  taxAmount?: number;
  taxCode?: string;
  subDepartmentId?: string;
  reservationRoomId?: string;
  posTransactionId?: string;
  currencyCode?: string;
  exchangeRate?: number;
}

export interface PostPaymentDto {
  folioId: string;
  amount: number;
  description: string;
  chargeDate: string;
  currencyCode?: string;
  exchangeRate?: number;
}

export interface TransferItemsDto {
  fromFolioId: string;
  toFolioId: string;
  folioItemIds: string[];
}

export interface VoidItemDto {
  voidReason: string;
}

export interface OpenDeskFolioDto {
  reservationId: string;
  guestId: string;
  parentFolioId: string;
  notes?: string;
}

@Injectable()
export class FolioService {
  constructor(
    @InjectRepository(Folio)
    private readonly folioRepo: Repository<Folio>,
    @InjectRepository(FolioItem)
    private readonly folioItemRepo: Repository<FolioItem>,
    private readonly dataSource: DataSource,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly tenantContext: TenantContext,
  ) {}

  async getFolioWithItems(folioId: string): Promise<{ folio: Folio; items: FolioItem[] }> {
    const { hotelId } = this.tenantContext;
    const folio = await this.findFolioOrFail(folioId, hotelId);
    const items = await this.folioItemRepo.find({
      where: { folioId, hotelId },
      order: { createdAt: 'ASC' },
    });
    return { folio, items };
  }

  async getFoliosByReservation(reservationId: string): Promise<Folio[]> {
    const { hotelId } = this.tenantContext;
    return this.folioRepo.find({ where: { reservationId, hotelId } });
  }

  async postCharge(dto: PostChargeDto): Promise<FolioItem> {
    const { hotelId, userId } = this.tenantContext;
    const folio = await this.findFolioOrFail(dto.folioId, hotelId);

    if (folio.status !== FolioStatus.OPEN) {
      throw new BadRequestException(`Folio ${folio.folioNumber} is not open`);
    }

    const qty = dto.quantity ?? 1;
    const amount = dto.unitPrice * qty;
    const taxAmount = dto.taxAmount ?? 0;

    const item = await this.dataSource.transaction(async (manager) => {
      const newItem = manager.create(FolioItem, {
        hotelId,
        folioId: dto.folioId,
        itemType: dto.itemType,
        description: dto.description,
        chargeDate: new Date(dto.chargeDate),
        unitPrice: dto.unitPrice,
        quantity: qty,
        amount,
        taxAmount,
        taxCode: dto.taxCode,
        subDepartmentId: dto.subDepartmentId,
        reservationRoomId: dto.reservationRoomId,
        posTransactionId: dto.posTransactionId,
        currencyCode: dto.currencyCode ?? 'IDR',
        exchangeRate: dto.exchangeRate ?? 1,
        createdBy: userId,
      });
      const saved = await manager.save(newItem);
      await this.recalculateFolioBalance(manager, dto.folioId, hotelId);
      return saved;
    });

    await this.eventBus.publish(
      new FolioChargePostedEvent(
        hotelId,
        dto.folioId,
        item.id,
        dto.itemType,
        amount + taxAmount,
        dto.subDepartmentId ?? null,
      ),
    );

    return item;
  }

  async postPayment(dto: PostPaymentDto): Promise<FolioItem> {
    const { hotelId, userId } = this.tenantContext;
    const folio = await this.findFolioOrFail(dto.folioId, hotelId);

    if (folio.status !== FolioStatus.OPEN) {
      throw new BadRequestException(`Folio ${folio.folioNumber} is not open`);
    }

    return this.dataSource.transaction(async (manager) => {
      const paymentItem = manager.create(FolioItem, {
        hotelId,
        folioId: dto.folioId,
        itemType: FolioItemType.PAYMENT,
        description: dto.description,
        chargeDate: new Date(dto.chargeDate),
        unitPrice: -dto.amount,
        quantity: 1,
        amount: -dto.amount,
        taxAmount: 0,
        currencyCode: dto.currencyCode ?? 'IDR',
        exchangeRate: dto.exchangeRate ?? 1,
        createdBy: userId,
      });
      const saved = await manager.save(paymentItem);
      await this.recalculateFolioBalance(manager, dto.folioId, hotelId);
      return saved;
    });
  }

  async voidItem(folioItemId: string, dto: VoidItemDto): Promise<FolioItem> {
    const { hotelId, userId } = this.tenantContext;
    const item = await this.folioItemRepo.findOne({ where: { id: folioItemId, hotelId } });
    if (!item) throw new NotFoundException(`FolioItem ${folioItemId} not found`);
    if (item.isVoid) throw new ConflictException('Item is already voided');

    const folio = await this.findFolioOrFail(item.folioId, hotelId);
    if (folio.status !== FolioStatus.OPEN) {
      throw new BadRequestException('Cannot void item on a closed folio');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(FolioItem, folioItemId, {
        isVoid: true,
        voidedBy: userId,
        voidedAt: new Date(),
        voidReason: dto.voidReason,
      });
      await this.recalculateFolioBalance(manager, item.folioId, hotelId);
    });

    item.isVoid = true;
    item.voidedBy = userId;
    item.voidedAt = new Date();
    item.voidReason = dto.voidReason;
    return item;
  }

  async transferItems(dto: TransferItemsDto): Promise<void> {
    const { hotelId } = this.tenantContext;
    const fromFolio = await this.findFolioOrFail(dto.fromFolioId, hotelId);
    const toFolio = await this.findFolioOrFail(dto.toFolioId, hotelId);

    if (fromFolio.status !== FolioStatus.OPEN || toFolio.status !== FolioStatus.OPEN) {
      throw new BadRequestException('Both folios must be open for transfer');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        FolioItem,
        dto.folioItemIds.map((id) => ({ id, hotelId })),
        { folioId: dto.toFolioId, itemType: FolioItemType.TRANSFER },
      );
      await this.recalculateFolioBalance(manager, dto.fromFolioId, hotelId);
      await this.recalculateFolioBalance(manager, dto.toFolioId, hotelId);
    });
  }

  async openDeskFolio(dto: OpenDeskFolioDto): Promise<Folio> {
    const { hotelId, userId } = this.tenantContext;
    const folioNumber = await this.generateFolioNumber(hotelId);

    const folio = this.folioRepo.create({
      hotelId,
      reservationId: dto.reservationId,
      guestId: dto.guestId,
      parentFolioId: dto.parentFolioId,
      folioNumber,
      folioType: FolioType.DESK,
      status: FolioStatus.OPEN,
      notes: dto.notes,
      openedBy: userId,
      openedAt: new Date(),
    });
    return this.folioRepo.save(folio);
  }

  async closeFolio(folioId: string): Promise<Folio> {
    const { hotelId, userId } = this.tenantContext;
    const folio = await this.findFolioOrFail(folioId, hotelId);

    if (folio.status !== FolioStatus.OPEN) {
      throw new BadRequestException(`Folio ${folio.folioNumber} is already ${folio.status}`);
    }

    await this.recalculateFolioBalanceByRepo(folioId, hotelId);
    const updated = await this.findFolioOrFail(folioId, hotelId);

    const newStatus = Number(updated.balance) === 0 ? FolioStatus.SETTLED : FolioStatus.CLOSED;
    await this.folioRepo.update(folioId, {
      status: newStatus,
      closedBy: userId,
      closedAt: new Date(),
    });
    updated.status = newStatus;
    return updated;
  }

  async getFolioBalance(folioId: string): Promise<number> {
    const { hotelId } = this.tenantContext;
    const folio = await this.findFolioOrFail(folioId, hotelId);
    return Number(folio.balance);
  }

  // Used internally by CheckIn/CheckOut
  async createMasterFolio(
    hotelId: string,
    reservationId: string,
    guestId: string,
    companyId?: string,
    openedBy?: string,
  ): Promise<Folio> {
    const folioNumber = await this.generateFolioNumber(hotelId);
    const folio = this.folioRepo.create({
      hotelId,
      reservationId,
      guestId,
      companyId,
      folioNumber,
      folioType: FolioType.MASTER,
      status: FolioStatus.OPEN,
      openedBy,
      openedAt: new Date(),
    });
    return this.folioRepo.save(folio);
  }

  async settleAndCloseFolio(folioId: string, closedBy: string): Promise<Folio> {
    const { hotelId } = this.tenantContext;
    await this.recalculateFolioBalanceByRepo(folioId, hotelId);
    await this.folioRepo.update(folioId, {
      status: FolioStatus.SETTLED,
      closedBy,
      closedAt: new Date(),
    });
    return this.findFolioOrFail(folioId, hotelId);
  }

  private async recalculateFolioBalance(
    manager: import('typeorm').EntityManager,
    folioId: string,
    hotelId: string,
  ): Promise<void> {
    const result = await manager
      .createQueryBuilder(FolioItem, 'fi')
      .select('SUM(CASE WHEN fi.is_void = false AND fi.item_type NOT IN (:...payments) THEN fi.amount + fi.tax_amount ELSE 0 END)', 'totalCharges')
      .addSelect('SUM(CASE WHEN fi.is_void = false AND fi.item_type IN (:...payments) THEN ABS(fi.amount) ELSE 0 END)', 'totalPayments')
      .where('fi.folio_id = :folioId', { folioId })
      .andWhere('fi.hotel_id = :hotelId', { hotelId })
      .setParameter('payments', [FolioItemType.PAYMENT, FolioItemType.DEPOSIT])
      .getRawOne<{ totalCharges: string; totalPayments: string }>();

    const totalCharges = parseFloat(result?.totalCharges ?? '0');
    const totalPayments = parseFloat(result?.totalPayments ?? '0');
    const balance = totalCharges - totalPayments;

    await manager.update(Folio, folioId, { totalCharges, totalPayments, balance });
  }

  private async recalculateFolioBalanceByRepo(folioId: string, hotelId: string): Promise<void> {
    const result = await this.folioItemRepo
      .createQueryBuilder('fi')
      .select('SUM(CASE WHEN fi.is_void = false AND fi.item_type NOT IN (:...payments) THEN fi.amount + fi.tax_amount ELSE 0 END)', 'totalCharges')
      .addSelect('SUM(CASE WHEN fi.is_void = false AND fi.item_type IN (:...payments) THEN ABS(fi.amount) ELSE 0 END)', 'totalPayments')
      .where('fi.folio_id = :folioId', { folioId })
      .andWhere('fi.hotel_id = :hotelId', { hotelId })
      .setParameter('payments', [FolioItemType.PAYMENT, FolioItemType.DEPOSIT])
      .getRawOne<{ totalCharges: string; totalPayments: string }>();

    const totalCharges = parseFloat(result?.totalCharges ?? '0');
    const totalPayments = parseFloat(result?.totalPayments ?? '0');
    const balance = totalCharges - totalPayments;

    await this.folioRepo.update(folioId, { totalCharges, totalPayments, balance });
  }

  private async findFolioOrFail(folioId: string, hotelId: string): Promise<Folio> {
    const folio = await this.folioRepo.findOne({ where: { id: folioId, hotelId } });
    if (!folio) throw new NotFoundException(`Folio ${folioId} not found`);
    return folio;
  }

  private async generateFolioNumber(hotelId: string): Promise<string> {
    const today = new Date();
    const prefix = `F${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.folioRepo
      .createQueryBuilder('f')
      .where('f.hotel_id = :hotelId', { hotelId })
      .andWhere('f.folio_number LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();
    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }
}
