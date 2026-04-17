import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Folio, FolioStatus } from '../domain/folio/folio.entity';
import { FolioItem, FolioItemType } from '../domain/folio/folio-item.entity';
import { FolioService } from '../application/folio.service';
import { POSChargePostedToRoomEvent } from '@modules/pos/domain/pos.events';

@Injectable()
export class PosChargeEventHandler {
  private readonly logger = new Logger(PosChargeEventHandler.name);

  constructor(
    @InjectRepository(Folio)
    private readonly folioRepo: Repository<Folio>,
    private readonly folioService: FolioService,
  ) {}

  /**
   * POS fires POSChargePostedToRoomEvent → PMS posts the charge to the folio.
   * This is the async half of the Route-to-Room flow.
   * The folio ID was already resolved synchronously via Redis in RouteToRoomService.
   */
  @OnEvent(POSChargePostedToRoomEvent.EVENT_NAME, { async: true })
  async onPosChargePostedToRoom(event: POSChargePostedToRoomEvent): Promise<void> {
    this.logger.debug(
      `Posting RTR charge to folio=${event.folioId} amount=${event.amount}`,
    );

    const folio = await this.folioRepo.findOne({
      where: { id: event.folioId, hotelId: event.hotelId },
    });

    if (!folio || folio.status !== FolioStatus.OPEN) {
      this.logger.warn(
        `RTR: folio ${event.folioId} not found or not open — charge not posted`,
      );
      return;
    }

    try {
      // Post directly using repository to avoid TenantContext dependency in event handler
      const item = this.folioRepo.manager.create(FolioItem, {
        hotelId: event.hotelId,
        folioId: event.folioId,
        posTransactionId: event.posTransactionId,
        itemType: FolioItemType.POS_CHARGE,
        description: event.description,
        chargeDate: new Date(),
        unitPrice: event.amount,
        quantity: 1,
        amount: event.amount,
        taxAmount: 0,
        currencyCode: folio.currencyCode,
        exchangeRate: 1,
      });
      await this.folioRepo.manager.save(item);

      // Update folio totals
      const newCharges = Number(folio.totalCharges) + event.amount;
      const newBalance = newCharges - Number(folio.totalPayments);
      await this.folioRepo.update(event.folioId, {
        totalCharges: newCharges,
        balance: newBalance,
      });

      this.logger.log(
        `RTR: posted ${event.amount} to folio=${event.folioId} room=${event.roomNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `RTR: failed to post charge to folio=${event.folioId}: ${(error as Error).message}`,
      );
    }
  }
}
