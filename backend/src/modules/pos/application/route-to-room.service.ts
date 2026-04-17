import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/events/event-bus.interface';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';
import { POSChargePostedToRoomEvent } from '../domain/pos.events';

export interface ActiveFolioCache {
  folioId: string;
  guestId: string;
  reservationId: string;
}

export interface RouteChargeDto {
  roomNumber: string;
  posTransactionId: string;
  amount: number;
  description: string;
  outletId: string;
}

export interface RouteChargeResult {
  folioId: string;
  guestId: string;
  reservationId: string;
  roomNumber: string;
  amount: number;
}

@Injectable()
export class RouteToRoomService {
  constructor(
    private readonly cacheService: CacheService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * Synchronous Redis lookup to find active folio for a room.
   * Returns folio info immediately — cashier gets instant confirmation.
   * The actual folio posting is done asynchronously via event.
   */
  async routeCharge(dto: RouteChargeDto): Promise<RouteChargeResult> {
    const { hotelId } = this.tenantContext;

    if (dto.amount <= 0) {
      throw new BadRequestException('Route-to-room charge amount must be positive');
    }

    // Sync Redis lookup (< 1ms)
    const activeFolio = await this.cacheService.getActiveFolio<ActiveFolioCache>(
      hotelId,
      dto.roomNumber,
    );

    if (!activeFolio) {
      throw new NotFoundException(
        `No active guest found in room ${dto.roomNumber}. ` +
        `The room may be vacant or the guest has already checked out.`,
      );
    }

    // Publish async event — PMS FolioService subscribes and posts the charge
    await this.eventBus.publish(
      new POSChargePostedToRoomEvent(
        hotelId,
        dto.posTransactionId,
        activeFolio.folioId,
        dto.roomNumber,
        dto.amount,
        dto.description,
        dto.outletId,
      ),
    );

    return {
      folioId: activeFolio.folioId,
      guestId: activeFolio.guestId,
      reservationId: activeFolio.reservationId,
      roomNumber: dto.roomNumber,
      amount: dto.amount,
    };
  }

  /**
   * Check if a room has an active guest (for validation before order placement).
   */
  async checkRoomOccupancy(roomNumber: string): Promise<{ occupied: boolean; guestId?: string }> {
    const { hotelId } = this.tenantContext;
    const activeFolio = await this.cacheService.getActiveFolio<ActiveFolioCache>(
      hotelId,
      roomNumber,
    );
    if (!activeFolio) return { occupied: false };
    return { occupied: true, guestId: activeFolio.guestId };
  }
}
