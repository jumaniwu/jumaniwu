import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hotel } from './domain/hotel/hotel.entity';
import { RoomType } from './domain/room/room-type.entity';
import { Room } from './domain/room/room.entity';
import { Guest } from './domain/guest/guest.entity';
import { Reservation } from './domain/reservation/reservation.entity';
import { ReservationRoom } from './domain/reservation/reservation-room.entity';
import { Folio } from './domain/folio/folio.entity';
import { FolioItem } from './domain/folio/folio-item.entity';
import { NightAuditRun } from './domain/night-audit/night-audit-run.entity';
import { HotelController } from './api/hotel.controller';
import { RoomController } from './api/room.controller';
import { GuestController } from './api/guest.controller';
import { ReservationController } from './api/reservation.controller';
import { FolioController } from './api/folio.controller';
import { HotelService } from './application/hotel.service';
import { RoomService } from './application/room.service';
import { GuestService } from './application/guest.service';
import { ReservationService } from './application/reservation.service';
import { FolioService } from './application/folio.service';
import { NightAuditService } from './application/night-audit.service';
import { CheckInService } from './application/check-in.service';
import { CheckOutService } from './application/check-out.service';
import { PosChargeEventHandler } from './infrastructure/pos-charge.event-handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hotel, RoomType, Room, Guest,
      Reservation, ReservationRoom,
      Folio, FolioItem, NightAuditRun,
    ]),
  ],
  controllers: [
    HotelController, RoomController, GuestController,
    ReservationController, FolioController,
  ],
  providers: [
    HotelService, RoomService, GuestService,
    ReservationService, FolioService,
    NightAuditService, CheckInService, CheckOutService,
    PosChargeEventHandler,
  ],
  exports: [FolioService, ReservationService],
})
export class PmsModule {}
