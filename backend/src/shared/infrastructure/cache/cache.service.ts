import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.module';

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }

  async setex(key: string, ttl: number, value: unknown): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  // Folio RTR helpers
  async setActiveFolio(hotelId: string, roomNumber: string, data: unknown, ttlSeconds: number) {
    await this.setex(`folio:active:${hotelId}:${roomNumber}`, ttlSeconds, data);
  }

  async getActiveFolio<T>(hotelId: string, roomNumber: string): Promise<T | null> {
    return this.get<T>(`folio:active:${hotelId}:${roomNumber}`);
  }

  async delActiveFolio(hotelId: string, roomNumber: string) {
    await this.del(`folio:active:${hotelId}:${roomNumber}`);
  }

  // Idempotency key
  async setIdempotencyKey(key: string, ttlSeconds = 86400): Promise<boolean> {
    const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }
}
