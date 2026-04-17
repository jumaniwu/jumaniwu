import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from './domain/channel.entity';
import { RatePlan } from './domain/rate-plan.entity';
import { AvailabilityBlock } from './domain/availability-block.entity';
import { ChannelController } from './api/channel.controller';
import { RatePlanController } from './api/rate-plan.controller';
import { AvailabilityController } from './api/availability.controller';
import { ChannelService } from './application/channel.service';
import { RatePlanService } from './application/rate-plan.service';
import { AvailabilityService } from './application/availability.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel, RatePlan, AvailabilityBlock]),
  ],
  controllers: [ChannelController, RatePlanController, AvailabilityController],
  providers: [ChannelService, RatePlanService, AvailabilityService],
  exports: [AvailabilityService],
})
export class CmsModule {}
