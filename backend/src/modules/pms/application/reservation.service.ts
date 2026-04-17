import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Reservation, ReservationStatus, PaymentStatus } from '../domain/reservation/reservation.entity';
import { ReservationRoom } from '../domain/reservation/reservation-room.entity';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/events/event-bus.interface';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';
import { ReservationConfirmedEvent, ReservationCancelledEvent } from '../domain/pms.events';

export interface CreateReservationRoomDto {
  roomTypeId: string;
  roomId?: string;
  ratePlanId?: string;
  ratePerNight: number;
  mealPlan?: string;
  breakfastIncluded?: boolean;
  adults: number;
  children?: number;
  checkInDate: string;
  checkOutDate: string;
}

export interface CreateReservationDto {
  guestId: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children?: number;
  source?: string;
  specialRequests?: string;
  channelId?: string;
  companyId?: string;
  otaBookingRef?: string;
  rooms: CreateReservationRoomDto[];
}

export interface CancelReservationDto {
  cancelReason: string;
}

@Injectable()
export class ReservationService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(ReservationRoom)
    private readonly reservationRoomRepo: Repository<ReservationRoom>,
    private readonly dataSource: DataSource,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateReservationDto): Promise<Reservation> {
    const hotelId = this.tenantContext.hotelId;

    if (new Date(dto.departureDate) <= new Date(dto.arrivalDate)) {
      throw new BadRequestException('Departure date must be after arrival date');
    }

    const confirmationNo = await this.generateConfirmationNo(hotelId);

    const totalAmount = dto.rooms.reduce((sum, r) => {
      const nights = this.calcNights(r.checkInDate, r.checkOutDate);
      return sum + r.ratePerNight * nights;
    }, 0);

    const reservation = await this.dataSource.transaction(async (manager) => {
      const res = manager.create(Reservation, {
        hotelId,
        guestId: dto.guestId,
        arrivalDate: new Date(dto.arrivalDate),
        departureDate: new Date(dto.departureDate),
        adults: dto.adults,
        children: dto.children ?? 0,
        source: dto.source ?? 'DIRECT',
        specialRequests: dto.specialRequests,
        channelId: dto.channelId,
        companyId: dto.companyId,
        otaBookingRef: dto.otaBookingRef,
        confirmationNo,
        status: ReservationStatus.TENTATIVE,
        paymentStatus: PaymentStatus.PENDING,
        totalAmount,
        createdBy: this.tenantContext.userId,
      });
      const saved = await manager.save(res);

      const roomEntities = dto.rooms.map((r) =>
        manager.create(ReservationRoom, {
          hotelId,
          reservationId: saved.id,
          roomTypeId: r.roomTypeId,
          roomId: r.roomId,
          ratePlanId: r.ratePlanId,
          ratePerNight: r.ratePerNight,
          mealPlan: r.mealPlan ?? 'RO',
          breakfastIncluded: r.breakfastIncluded ?? false,
          adults: r.adults,
          children: r.children ?? 0,
          checkInDate: new Date(r.checkInDate),
          checkOutDate: new Date(r.checkOutDate),
          status: 'RESERVED',
        }),
      );
      await manager.save(roomEntities);

      return saved;
    });

    return reservation;
  }

  async confirm(reservationId: string): Promise<Reservation> {
    const { hotelId } = this.tenantContext;
    const reservation = await this.findOneOrFail(reservationId, hotelId);

    if (reservation.status !== ReservationStatus.TENTATIVE) {
      throw new BadRequestException(`Cannot confirm reservation with status ${reservation.status}`);
    }

    await this.reservationRepo.update(reservationId, { status: ReservationStatus.CONFIRMED });
    reservation.status = ReservationStatus.CONFIRMED;

    await this.eventBus.publish(
      new ReservationConfirmedEvent(
        hotelId,
        reservation.id,
        reservation.guestId,
        reservation.confirmationNo,
        Number(reservation.totalAmount),
      ),
    );

    return reservation;
  }

  async cancel(reservationId: string, dto: CancelReservationDto): Promise<Reservation> {
    const { hotelId } = this.tenantContext;
    const reservation = await this.findOneOrFail(reservationId, hotelId);

    const cancellableStatuses: ReservationStatus[] = [
      ReservationStatus.TENTATIVE,
      ReservationStatus.CONFIRMED,
      ReservationStatus.WAITLIST,
    ];
    if (!cancellableStatuses.includes(reservation.status)) {
      throw new BadRequestException(`Cannot cancel reservation with status ${reservation.status}`);
    }

    await this.reservationRepo.update(reservationId, {
      status: ReservationStatus.CANCELLED,
      cancelReason: dto.cancelReason,
      cancelledAt: new Date(),
    });
    reservation.status = ReservationStatus.CANCELLED;

    await this.eventBus.publish(
      new ReservationCancelledEvent(hotelId, reservation.id, reservation.guestId, dto.cancelReason),
    );

    return reservation;
  }

  async findById(reservationId: string): Promise<Reservation> {
    const { hotelId } = this.tenantContext;
    return this.findOneOrFail(reservationId, hotelId);
  }

  async findAll(filters?: {
    status?: ReservationStatus;
    arrivalDate?: string;
    guestId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Reservation[]; total: number }> {
    const { hotelId } = this.tenantContext;
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 20, 100);

    const qb = this.reservationRepo
      .createQueryBuilder('r')
      .where('r.hotel_id = :hotelId', { hotelId })
      .orderBy('r.arrival_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters?.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters?.arrivalDate) qb.andWhere('r.arrival_date = :date', { date: filters.arrivalDate });
    if (filters?.guestId) qb.andWhere('r.guest_id = :guestId', { guestId: filters.guestId });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getReservationRooms(reservationId: string): Promise<ReservationRoom[]> {
    const { hotelId } = this.tenantContext;
    await this.findOneOrFail(reservationId, hotelId);
    return this.reservationRoomRepo.find({ where: { reservationId, hotelId } });
  }

  async findByConfirmationNo(confirmationNo: string): Promise<Reservation> {
    const { hotelId } = this.tenantContext;
    const res = await this.reservationRepo.findOne({ where: { confirmationNo, hotelId } });
    if (!res) throw new NotFoundException(`Reservation ${confirmationNo} not found`);
    return res;
  }

  private async findOneOrFail(id: string, hotelId: string): Promise<Reservation> {
    const res = await this.reservationRepo.findOne({ where: { id, hotelId } });
    if (!res) throw new NotFoundException(`Reservation ${id} not found`);
    return res;
  }

  private calcNights(checkIn: string, checkOut: string): number {
    return Math.max(
      1,
      Math.ceil(
        (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000,
      ),
    );
  }

  private async generateConfirmationNo(hotelId: string): Promise<string> {
    const today = new Date();
    const prefix = `RES${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.hotel_id = :hotelId', { hotelId })
      .andWhere("r.confirmation_no LIKE :prefix", { prefix: `${prefix}%` })
      .getCount();
    const seq = String(count + 1).padStart(5, '0');
    const confirmationNo = `${prefix}${seq}`;
    const exists = await this.reservationRepo.findOne({ where: { confirmationNo } });
    if (exists) {
      return `${prefix}${String(count + 2).padStart(5, '0')}`;
    }
    return confirmationNo;
  }
}
