import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) throw new UnauthorizedException();

    try {
      const payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
      (req as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
