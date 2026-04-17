import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JournalRuleEngineService } from '../application/journal-rule-engine.service';
import {
  POSChargePostedToRoomEvent,
  POSTransactionClosedEvent,
} from '@modules/pos/domain/pos.events';

@Injectable()
export class PosAccountingEventHandler {
  private readonly logger = new Logger(PosAccountingEventHandler.name);

  constructor(private readonly ruleEngine: JournalRuleEngineService) {}

  /**
   * POS charge routed to room → DR AR/Folio  CR F&B Revenue
   */
  @OnEvent(POSChargePostedToRoomEvent.EVENT_NAME, { async: true })
  async onPosChargePostedToRoom(event: POSChargePostedToRoomEvent): Promise<void> {
    this.logger.debug(
      `Handling ${POSChargePostedToRoomEvent.EVENT_NAME} ` +
      `txId=${event.posTransactionId} room=${event.roomNumber}`,
    );
    await this.ruleEngine.applyRulesForEvent({
      hotelId: event.hotelId,
      accountingPeriodId: null,
      eventName: POSChargePostedToRoomEvent.EVENT_NAME,
      sourceEntityId: event.posTransactionId,
      amount: event.amount,
      description: event.description,
    });
  }

  /**
   * POS transaction closed with direct payment → DR Cash/Bank  CR F&B Revenue
   */
  @OnEvent(POSTransactionClosedEvent.EVENT_NAME, { async: true })
  async onPosTransactionClosed(event: POSTransactionClosedEvent): Promise<void> {
    this.logger.debug(
      `Handling ${POSTransactionClosedEvent.EVENT_NAME} txId=${event.posTransactionId}`,
    );
    await this.ruleEngine.applyRulesForEvent({
      hotelId: event.hotelId,
      accountingPeriodId: null,
      eventName: POSTransactionClosedEvent.EVENT_NAME,
      sourceEntityId: event.posTransactionId,
      amount: event.totalAmount,
      taxAmount: event.taxAmount,
      description: `POS Transaction closed`,
    });
  }
}
