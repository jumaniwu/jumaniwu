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
import { Room, OccupancyStatus } from '../domain/room/room.entity';
import { FolioService } from './folio.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/events/event-bus.interface';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';
import { RoomCheckedInEvent } from '../domain/pms.events';

export interface RoomAssignmentDto {
  reservationRoomId: string;
  roomId: string;
}

export interface CheckInDto {
  reservationId: string;
  roomAssignments: RoomAssignmentDto[];
}

export interface ActiveFolioCache {
  folioId: string;
  guestId: string;
  reservationId: string;
}

@Injectable()
export class CheckInService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(ReservationRoom)
    private readonly reservationRoomRepo: Repository<ReservationRoom>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    private readonly folioService: FolioService,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly tenantContext: TenantContext,
  ) {}

  async checkIn(dto: CheckInDto): Promise<{ reservationId: string; folioId: string }> {
    const { hotelId, userId } = this.tenantContext;

    const reservation = await this.reservationRepo.findOne({
      where: { id: dto.reservationId, hotelId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    const checkInableStatuses = [ReservationStatus.CONFIRMED, ReservationStatus.TENTATIVE];
    if (!checkInableStatuses.includes(reservation.status)) {
      throw new BadRequestException(
        `Cannot check in reservation with status ${reservation.status}`,
      );
    }

    // Validate all room assignments before starting transaction
    for (const assignment of dto.roomAssignments) {
      const room = await this.roomRepo.findOne({ where: { id: assignment.roomId, hotelId } });
      if (!room) throw new NotFoundException(`Room ${assignment.roomId} not found`);
      if (room.occupancyStatus === OccupancyStatus.OCCUPIED) {
        throw new BadRequestException(`Room ${room.roomNumber} is already occupied`);
      }
    }

    const folio = await this.folioService.createMasterFolio(
      hotelId,
      dto.reservationId,
      reservation.guestId,
      reservation.companyId,
      userId,
    );

    await this.dataSource.transaction(async (manager) => {
      // Assign rooms
      for (const assignment of dto.roomAssignments) {
        await manager.update(ReservationRoom, assignment.reservationRoomId, {
          roomId: assignment.roomId,
          actualCheckInAt: new Date(),
          checkedInBy: userId,
          status: 'CHECKED_IN',
        });
        await manager.update(Room, assignment.roomId, {
          occupancyStatus: OccupancyStatus.OCCUPIED,
        });
      }

      // Mark reservation as checked in
      await manager.update(Reservation, dto.reservationId, {
        status: ReservationStatus.CHECKED_IN,
      });
    });

    // Cache active folio for each room (for Route-to-Room lookups)
    const folioCache: ActiveFolioCache = {
      folioId: folio.id,
      guestId: reservation.guestId,
      reservationId: dto.reservationId,
    };
    const ttl = this.calcFolioTtl(reservation.arrivalDate, reservation.departureDate);

    for (const assignment of dto.roomAssignments) {
      const room = await this.roomRepo.findOne({ where: { id: assignment.roomId } });
      if (room) {
        await this.cacheService.setActiveFolio(hotelId, room.roomNumber, folioCache, ttl);
      }
    }

    await this.eventBus.publish(
      new RoomCheckedInEvent(hotelId, dto.reservationId, folio.id, reservation.guestId),
    );

    return { reservationId: dto.reservationId, folioId: folio.id };
  }

  private calcFolioTtl(arrival: Date, departure: Date): number {
    const nights = Math.max(
      1,
      Math.ceil((new Date(departure).getTime() - new Date(arrival).getTime()) / 86400000),
    );
    // Nights * 1 day + 2 days buffer (check-out day + 12h grace)
    return (nights + 2) * 86400;
  }
}
