import {
  Injectable,
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NightAuditRun } from '../domain/night-audit/night-audit-run.entity';
import { Reservation, ReservationStatus } from '../domain/reservation/reservation.entity';
import { ReservationRoom } from '../domain/reservation/reservation-room.entity';
import { Folio, FolioStatus } from '../domain/folio/folio.entity';
import { FolioItem, FolioItemType } from '../domain/folio/folio-item.entity';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/events/event-bus.interface';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';
import { NightAuditRoomChargeEvent, NightAuditCompletedEvent } from '../domain/pms.events';

interface RoomChargeResult {
  folioId: string;
  reservationRoomId: string;
  amount: number;
  taxAmount: number;
}

@Injectable()
export class NightAuditService {
  private readonly logger = new Logger(NightAuditService.name);

  constructor(
    @InjectRepository(NightAuditRun)
    private readonly auditRunRepo: Repository<NightAuditRun>,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(ReservationRoom)
    private readonly reservationRoomRepo: Repository<ReservationRoom>,
    @InjectRepository(Folio)
    private readonly folioRepo: Repository<Folio>,
    @InjectRepository(FolioItem)
    private readonly folioItemRepo: Repository<FolioItem>,
    private readonly dataSource: DataSource,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly tenantContext: TenantContext,
  ) {}

  async runNightAudit(hotelId: string, auditDate: Date, runByUserId: string): Promise<NightAuditRun> {
    // Check for duplicate run
    const existing = await this.auditRunRepo.findOne({
      where: { hotelId, auditDate: auditDate as unknown as Date },
    });
    if (existing && existing.status === 'COMPLETED') {
      throw new ConflictException(`Night audit for ${auditDate.toISOString().split('T')[0]} already completed`);
    }

    // Create or reuse audit run record
    let auditRun = existing ?? this.auditRunRepo.create({
      hotelId,
      auditDate,
      status: 'RUNNING',
      startedAt: new Date(),
      runBy: runByUserId,
    });

    if (existing) {
      await this.auditRunRepo.update(existing.id, { status: 'RUNNING', startedAt: new Date() });
    } else {
      auditRun = await this.auditRunRepo.save(auditRun);
    }

    try {
      const result = await this.executeAuditSteps(hotelId, auditDate, auditRun.id, runByUserId);

      await this.auditRunRepo.update(auditRun.id, {
        status: 'COMPLETED',
        completedAt: new Date(),
        roomsProcessed: result.roomsProcessed,
        foliosPosted: result.foliosPosted,
        totalRoomRevenue: result.totalRoomRevenue,
        totalFnbRevenue: 0,
        totalTax: result.totalTax,
      });

      await this.eventBus.publish(
        new NightAuditCompletedEvent(
          hotelId,
          auditRun.id,
          auditDate,
          result.totalRoomRevenue,
          0,
          result.totalTax,
        ),
      );

      const finalRun = await this.auditRunRepo.findOne({ where: { id: auditRun.id } });
      this.logger.log(
        `Night audit completed for hotel=${hotelId} date=${auditDate.toISOString().split('T')[0]} ` +
        `rooms=${result.roomsProcessed} revenue=${result.totalRoomRevenue}`,
      );
      return finalRun!;
    } catch (error) {
      await this.auditRunRepo.update(auditRun.id, {
        status: 'FAILED',
        notes: (error as Error).message,
      });
      throw error;
    }
  }

  private async executeAuditSteps(
    hotelId: string,
    auditDate: Date,
    auditRunId: string,
    runByUserId: string,
  ): Promise<{
    roomsProcessed: number;
    foliosPosted: number;
    totalRoomRevenue: number;
    totalTax: number;
  }> {
    // Step 1: Pre-check — verify no blocking conditions
    await this.preCheck(hotelId, auditDate);

    // Step 2: Global Post — post room rates to all open folios
    const chargeResults = await this.globalPostRoomRates(hotelId, auditDate, runByUserId);

    // Step 3: Auto Post — mark no-shows
    await this.autoPostNoShows(hotelId, auditDate);

    const totalRoomRevenue = chargeResults.reduce((s, r) => s + r.amount, 0);
    const totalTax = chargeResults.reduce((s, r) => s + r.taxAmount, 0);

    // Step 4: Publish events for each room charge (Accounting subscribes to auto-journal)
    for (const charge of chargeResults) {
      await this.eventBus.publish(
        new NightAuditRoomChargeEvent(
          hotelId,
          auditDate,
          charge.folioId,
          charge.reservationRoomId,
          charge.amount,
          charge.taxAmount,
          `Room Rate — ${auditDate.toISOString().split('T')[0]}`,
        ),
      );
    }

    // Unique folio IDs that received postings
    const uniqueFolioIds = [...new Set(chargeResults.map((r) => r.folioId))];

    return {
      roomsProcessed: chargeResults.length,
      foliosPosted: uniqueFolioIds.length,
      totalRoomRevenue,
      totalTax,
    };
  }

  private async preCheck(hotelId: string, auditDate: Date): Promise<void> {
    // Ensure no pending transactions that would block audit
    // This is a simple check — can be extended with more validations
    const pendingAudit = await this.auditRunRepo.findOne({
      where: { hotelId, status: 'RUNNING' },
    });
    if (pendingAudit) {
      throw new BadRequestException('Another night audit run is currently in progress');
    }
  }

  private async globalPostRoomRates(
    hotelId: string,
    auditDate: Date,
    postedBy: string,
  ): Promise<RoomChargeResult[]> {
    const results: RoomChargeResult[] = [];
    const auditDateStr = auditDate.toISOString().split('T')[0];

    // Find all checked-in reservations
    const reservations = await this.reservationRepo.find({
      where: { hotelId, status: ReservationStatus.CHECKED_IN },
    });

    for (const reservation of reservations) {
      const reservationRooms = await this.reservationRoomRepo.find({
        where: { reservationId: reservation.id, hotelId, status: 'CHECKED_IN' },
      });

      const folio = await this.folioRepo.findOne({
        where: {
          reservationId: reservation.id,
          hotelId,
          status: FolioStatus.OPEN,
        },
      });

      if (!folio) continue;

      for (const rr of reservationRooms) {
        // Skip if already posted for this date
        const alreadyPosted = await this.folioItemRepo.findOne({
          where: {
            folioId: folio.id,
            reservationRoomId: rr.id,
            itemType: FolioItemType.ROOM_RATE,
            chargeDate: auditDate as unknown as Date,
          },
        });
        if (alreadyPosted) continue;

        const rate = Number(rr.ratePerNight);
        const taxRate = 0.11; // 11% VAT — in production use hotel tax config
        const taxAmount = Math.round(rate * taxRate * 100) / 100;

        await this.dataSource.transaction(async (manager) => {
          const chargeItem = manager.create(FolioItem, {
            hotelId,
            folioId: folio.id,
            reservationRoomId: rr.id,
            itemType: FolioItemType.ROOM_RATE,
            description: `Room Rate — ${auditDateStr}`,
            chargeDate: auditDate,
            unitPrice: rate,
            quantity: 1,
            amount: rate,
            taxAmount,
            taxCode: 'VAT11',
            currencyCode: folio.currencyCode,
            exchangeRate: 1,
            createdBy: postedBy,
          });
          await manager.save(chargeItem);

          // Recalculate folio balance
          const currentFolio = await manager.findOne(Folio, { where: { id: folio.id } });
          if (currentFolio) {
            const newCharges = Number(currentFolio.totalCharges) + rate + taxAmount;
            const newBalance = newCharges - Number(currentFolio.totalPayments);
            await manager.update(Folio, folio.id, {
              totalCharges: newCharges,
              balance: newBalance,
            });
          }
        });

        results.push({
          folioId: folio.id,
          reservationRoomId: rr.id,
          amount: rate,
          taxAmount,
        });
      }
    }

    return results;
  }

  private async autoPostNoShows(hotelId: string, auditDate: Date): Promise<void> {
    // Find confirmed reservations with arrival date = auditDate that never checked in
    const noShows = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.hotel_id = :hotelId', { hotelId })
      .andWhere('r.status = :status', { status: ReservationStatus.CONFIRMED })
      .andWhere('r.arrival_date = :date', { date: auditDate.toISOString().split('T')[0] })
      .getMany();

    for (const reservation of noShows) {
      await this.reservationRepo.update(reservation.id, {
        status: ReservationStatus.NO_SHOW,
      });
      this.logger.warn(`No-show: reservation=${reservation.confirmationNo}`);
    }
  }

  async getAuditHistory(
    hotelId: string,
    page = 1,
    limit = 30,
  ): Promise<{ data: NightAuditRun[]; total: number }> {
    const [data, total] = await this.auditRunRepo.findAndCount({
      where: { hotelId },
      order: { auditDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}
