import { BaseDomainEvent } from '@shared/infrastructure/events/event-bus.interface';

export class POSChargePostedToRoomEvent extends BaseDomainEvent {
  static readonly EVENT_NAME = 'pos.charge.posted_to_room';
  constructor(
    hotelId: string,
    public readonly posTransactionId: string,
    public readonly folioId: string,
    public readonly roomNumber: string,
    public readonly amount: number,
    public readonly description: string,
    public readonly outletId: string,
  ) {
    super(hotelId);
  }
}

export class POSTransactionClosedEvent extends BaseDomainEvent {
  static readonly EVENT_NAME = 'pos.transaction.closed';
  constructor(
    hotelId: string,
    public readonly posTransactionId: string,
    public readonly outletId: string,
    public readonly totalAmount: number,
    public readonly taxAmount: number,
  ) {
    super(hotelId);
  }
}

export class CaptainOrderSentToKitchenEvent extends BaseDomainEvent {
  static readonly EVENT_NAME = 'pos.captain_order.sent_to_kitchen';
  constructor(
    hotelId: string,
    public readonly captainOrderId: string,
    public readonly outletId: string,
    public readonly itemCount: number,
  ) {
    super(hotelId);
  }
}
