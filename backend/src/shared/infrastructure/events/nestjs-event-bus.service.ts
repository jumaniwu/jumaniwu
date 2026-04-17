import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IEventBus, IDomainEvent } from './event-bus.interface';

@Injectable()
export class NestjsEventBus implements IEventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  async publish(event: IDomainEvent): Promise<void> {
    const eventName = event.constructor.name;
    this.emitter.emit(eventName, event);
  }

  async publishAll(events: IDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
