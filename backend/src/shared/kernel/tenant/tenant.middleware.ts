import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantContext } from './tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tenantContext: TenantContext,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    try {
      const token = authHeader.slice(7);
      const payload = this.jwt.verify(token, {
        secret: this.config.get('JWT_SECRET'),
      }) as { hotelId: string; sub: string; role: string };

      this.tenantContext.setTenant(payload.hotelId, payload.sub, payload.role);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    next();
  }
}
