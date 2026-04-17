import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

export const QUEUE_CMS_PUSH = 'cms-push';
export const QUEUE_CMS_PULL = 'cms-pull';
export const QUEUE_NIGHT_AUDIT = 'night-audit';
export const QUEUE_REPORT_GEN = 'report-gen';
export const QUEUE_EMAIL = 'email-notify';
export const QUEUE_INVENTORY_COST = 'inventory-cost';
export const QUEUE_DEPRECIATION = 'depreciation';

function createQueueProvider(name: string) {
  return {
    provide: `QUEUE_${name.toUpperCase().replace(/-/g, '_')}`,
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
      new Queue(name, {
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
  };
}

const queueProviders = [
  QUEUE_CMS_PUSH, QUEUE_CMS_PULL, QUEUE_NIGHT_AUDIT,
  QUEUE_REPORT_GEN, QUEUE_EMAIL, QUEUE_INVENTORY_COST, QUEUE_DEPRECIATION,
].map(createQueueProvider);

@Global()
@Module({
  imports: [ConfigModule],
  providers: queueProviders,
  exports: queueProviders.map((p) => p.provide),
})
export class QueueModule {}
