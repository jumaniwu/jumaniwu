import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TenantContext } from './tenant.context';
import { TenantMiddleware } from './tenant.middleware';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
  ],
  providers: [TenantContext, TenantMiddleware],
  exports: [TenantContext, TenantMiddleware, JwtModule],
})
export class TenantModule {}
