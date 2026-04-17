import { BaseDomainEvent } from '@shared/infrastructure/events/event-bus.interface';

export class ReservationConfirmedEvent extends BaseDomainEvent {
  static readonly EVENT_NAME = 'pms.reservation.confirmed';
  constructor(
    hotelId: string,
    public readonly reservationId: string,
    public readonly guestId: string,
    public readonly confirmationNo: string,
    public readonly totalAmount: number,
  ) {
    super(hotelId);
  }
}

export class ReservationCancelledEvent extends BaseDomainEvent {
  static readonly EVENT_NAME = 'pms.reservation.cancelled';
  constructor(
    hotelId: string,
    public readonly reservationId: string,
    public readonly guestId: string,
    public readonly cancelReason: string,
  ) {
    super(hotelId);
  }
}

export class RoomCheckedInEvent extends BaseDomainEvent {
  static readonly EVENT_NAME = 'pms.room.checked_in';
  constructor(
    hotelId: string,
    public readonly reservationId: string,
    public readonly folioId: string,
    public readonly guestId: string,
  ) {
    super(hotelId);
  }
}

export class RoomCheckedOutEvent extends BaseDomainEvent {
  static readonly EVENT_NAME = 'pms.room.checked_out';
  constructor(
    hotelId: string,
    public readonly reservationId: string,
    public readonly folioId: string,
    public readonly guestId: string,
    public readonly totalCharges: number,
    public readonly totalPayments: number,
  ) {
    super(hotelId);
  }
}

export class FolioChargePostedEvent extends BaseDomainEvent {
  static readonly EVENT_NAME = 'pms.folio.charge_posted';
  constructor(
    hotelId: string,
    public readonly folioId: string,
    public readonly folioItemId: string,
    public readonly itemType: string,
    public readonly amount: number,
    public readonly subDepartmentId: string | null,
  ) {
    super(hotelId);
  }
}

export class NightAuditRoomChargeEvent extends BaseDomainEvent {
  static readonly EVENT_NAME = 'pms.night_audit.room_charge';
  constructor(
    hotelId: string,
    public readonly auditDate: Date,
    public readonly folioId: string,
    public readonly reservationRoomId: string,
    public readonly amount: number,
    public readonly taxAmount: number,
    public readonly description: string,
  ) {
    super(hotelId);
  }
}

export class NightAuditCompletedEvent extends BaseDomainEvent {
  static readonly EVENT_NAME = 'pms.night_audit.completed';
  constructor(
    hotelId: string,
    public readonly auditRunId: string,
    public readonly auditDate: Date,
    public readonly totalRoomRevenue: number,
    public readonly totalFnbRevenue: number,
    public readonly totalTax: number,
  ) {
    super(hotelId);
  }
}
