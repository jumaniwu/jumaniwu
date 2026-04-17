export interface IDomainEvent {
  eventId: string;
  occurredAt: Date;
  hotelId: string;
}

export abstract class BaseDomainEvent implements IDomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly hotelId: string;

  constructor(hotelId: string) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
    this.hotelId = hotelId;
  }
}

export interface IEventBus {
  publish(event: IDomainEvent): Promise<void>;
  publishAll(events: IDomainEvent[]): Promise<void>;
}

export const EVENT_BUS = 'EVENT_BUS';
