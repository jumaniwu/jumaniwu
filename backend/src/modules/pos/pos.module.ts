import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosOutlet } from './domain/pos-outlet.entity';
import { CaptainOrder } from './domain/captain-order.entity';
import { PosTransaction } from './domain/pos-transaction.entity';
import { PosOutletController } from './api/pos-outlet.controller';
import { CaptainOrderController } from './api/captain-order.controller';
import { PosTransactionController } from './api/pos-transaction.controller';
import { PosOutletService } from './application/pos-outlet.service';
import { CaptainOrderService } from './application/captain-order.service';
import { PosTransactionService } from './application/pos-transaction.service';
import { RouteToRoomService } from './application/route-to-room.service';

@Module({
  imports: [TypeOrmModule.forFeature([PosOutlet, CaptainOrder, PosTransaction])],
  controllers: [PosOutletController, CaptainOrderController, PosTransactionController],
  providers: [PosOutletService, CaptainOrderService, PosTransactionService, RouteToRoomService],
  exports: [PosTransactionService, RouteToRoomService],
})
export class PosModule {}
