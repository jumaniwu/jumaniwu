import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JournalRuleEngineService } from '../application/journal-rule-engine.service';
import {
  NightAuditRoomChargeEvent,
  FolioChargePostedEvent,
  RoomCheckedOutEvent,
} from '@modules/pms/domain/pms.events';

@Injectable()
export class PmsAccountingEventHandler {
  private readonly logger = new Logger(PmsAccountingEventHandler.name);

  constructor(private readonly ruleEngine: JournalRuleEngineService) {}

  /**
   * Night audit posts room rate → DR AR/Folio  CR Room Revenue
   */
  @OnEvent(NightAuditRoomChargeEvent.EVENT_NAME, { async: true })
  async onNightAuditRoomCharge(event: NightAuditRoomChargeEvent): Promise<void> {
    this.logger.debug(
      `Handling ${NightAuditRoomChargeEvent.EVENT_NAME} folioId=${event.folioId}`,
    );
    await this.ruleEngine.applyRulesForEvent({
      hotelId: event.hotelId,
      accountingPeriodId: null,
      eventName: NightAuditRoomChargeEvent.EVENT_NAME,
      sourceEntityId: event.folioId,
      amount: event.amount,
      taxAmount: event.taxAmount,
      description: event.description,
    });
  }

  /**
   * Any folio charge posted (POS route-to-room, F&B, etc.) → auto-journal
   */
  @OnEvent(FolioChargePostedEvent.EVENT_NAME, { async: true })
  async onFolioChargePosted(event: FolioChargePostedEvent): Promise<void> {
    this.logger.debug(
      `Handling ${FolioChargePostedEvent.EVENT_NAME} folioId=${event.folioId} type=${event.itemType}`,
    );
    await this.ruleEngine.applyRulesForEvent({
      hotelId: event.hotelId,
      accountingPeriodId: null,
      eventName: FolioChargePostedEvent.EVENT_NAME,
      sourceEntityId: event.folioItemId,
      amount: event.amount,
      description: `Folio charge: ${event.itemType}`,
      subDepartmentId: event.subDepartmentId ?? undefined,
    });
  }

  /**
   * Guest checks out → reconcile folio totals in AR subledger
   */
  @OnEvent(RoomCheckedOutEvent.EVENT_NAME, { async: true })
  async onRoomCheckedOut(event: RoomCheckedOutEvent): Promise<void> {
    this.logger.log(
      `Guest checked out: reservation=${event.reservationId} ` +
      `charges=${event.totalCharges} payments=${event.totalPayments}`,
    );
    // Reconciliation event — could trigger AR aging or city ledger update
    // No double-entry needed here; charge events already generated individual journal lines
  }
}
