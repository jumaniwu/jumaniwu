import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@shared/infrastructure/database/database.module';
import { CacheModule } from '@shared/infrastructure/cache/cache.module';
import { QueueModule } from '@shared/infrastructure/queue/queue.module';
import { TenantModule } from '@shared/kernel/tenant/tenant.module';
import { AuthModule } from '@shared/kernel/auth/auth.module';
import { TenantMiddleware } from '@shared/kernel/tenant/tenant.middleware';
import { PmsModule } from '@modules/pms/pms.module';
import { CmsModule } from '@modules/cms/cms.module';
import { PosModule } from '@modules/pos/pos.module';
import { AccountingModule } from '@modules/accounting/accounting.module';
import { InventoryModule } from '@modules/inventory/inventory.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CacheModule,
    QueueModule,
    TenantModule,
    AuthModule,
    PmsModule,
    CmsModule,
    PosModule,
    AccountingModule,
    InventoryModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
