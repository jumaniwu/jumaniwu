import { Module, Global } from '@nestjs/common';
import { EVENT_BUS } from './event-bus.interface';
import { NestjsEventBus } from './nestjs-event-bus.service';

@Global()
@Module({
  providers: [
    NestjsEventBus,
    { provide: EVENT_BUS, useExisting: NestjsEventBus },
  ],
  exports: [EVENT_BUS, NestjsEventBus],
})
export class EventBusModule {}
