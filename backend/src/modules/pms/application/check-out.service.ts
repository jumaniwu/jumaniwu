import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Reservation, ReservationStatus } from '../domain/reservation/reservation.entity';
import { ReservationRoom } from '../domain/reservation/reservation-room.entity';
import { Room, OccupancyStatus, HousekeepingStatus } from '../domain/room/room.entity';
import { Folio, FolioStatus } from '../domain/folio/folio.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/events/event-bus.interface';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';
import { RoomCheckedOutEvent } from '../domain/pms.events';

export interface CheckOutDto {
  reservationId: string;
  settleBalance?: boolean;
}

@Injectable()
export class CheckOutService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(ReservationRoom)
    private readonly reservationRoomRepo: Repository<ReservationRoom>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(Folio)
    private readonly folioRepo: Repository<Folio>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly tenantContext: TenantContext,
  ) {}

  async checkOut(dto: CheckOutDto): Promise<{ reservationId: string; balance: number }> {
    const { hotelId, userId } = this.tenantContext;

    const reservation = await this.reservationRepo.findOne({
      where: { id: dto.reservationId, hotelId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException(
        `Cannot check out reservation with status ${reservation.status}`,
      );
    }

    const reservationRooms = await this.reservationRoomRepo.find({
      where: { reservationId: dto.reservationId, hotelId },
    });

    const folios = await this.folioRepo.find({
      where: { reservationId: dto.reservationId, hotelId, status: FolioStatus.OPEN },
    });

    if (folios.length === 0) {
      throw new BadRequestException('No open folio found for this reservation');
    }

    const primaryFolio = folios[0];

    if (!dto.settleBalance && Number(primaryFolio.balance) > 0) {
      throw new BadRequestException(
        `Folio has outstanding balance of ${primaryFolio.balance}. Settle before check-out or use settleBalance: true`,
      );
    }

    const roomNumbers: string[] = [];

    await this.dataSource.transaction(async (manager) => {
      const now = new Date();

      for (const rr of reservationRooms) {
        if (rr.roomId) {
          await manager.update(ReservationRoom, rr.id, {
            actualCheckOutAt: now,
            checkedOutBy: userId,
            status: 'CHECKED_OUT',
          });

          const room = await manager.findOne(Room, { where: { id: rr.roomId } });
          if (room) {
            roomNumbers.push(room.roomNumber);
            await manager.update(Room, rr.roomId, {
              occupancyStatus: OccupancyStatus.VACANT,
              hkStatus: HousekeepingStatus.DIRTY,
            });
          }
        }
      }

      for (const folio of folios) {
        const status = Number(folio.balance) <= 0 ? FolioStatus.SETTLED : FolioStatus.CLOSED;
        await manager.update(Folio, folio.id, {
          status,
          closedBy: userId,
          closedAt: now,
        });
      }

      await manager.update(Reservation, dto.reservationId, {
        status: ReservationStatus.CHECKED_OUT,
      });
    });

    for (const roomNumber of roomNumbers) {
      await this.cacheService.delActiveFolio(hotelId, roomNumber);
    }

    const closedFolio = await this.folioRepo.findOne({ where: { id: primaryFolio.id } });

    await this.eventBus.publish(
      new RoomCheckedOutEvent(
        hotelId,
        dto.reservationId,
        primaryFolio.id,
        reservation.guestId,
        Number(closedFolio?.totalCharges ?? 0),
        Number(closedFolio?.totalPayments ?? 0),
      ),
    );

    return {
      reservationId: dto.reservationId,
      balance: Number(closedFolio?.balance ?? 0),
    };
  }
}
