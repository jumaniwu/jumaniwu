import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AvailabilityBlock } from '../domain/availability-block.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

const AVAIL_CACHE_TTL = 900;

export interface AvailabilityResult {
  roomTypeId: string;
  date: string;
  availableRooms: number;
  stopSell: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

export interface BulkUpdateAvailabilityDto {
  roomTypeId: string;
  date: string;
  totalRooms?: number;
  availableRooms?: number;
  stopSell?: boolean;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
}

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(AvailabilityBlock)
    private readonly blockRepo: Repository<AvailabilityBlock>,
    private readonly cacheService: CacheService,
    private readonly tenantContext: TenantContext,
  ) {}

  async checkAvailability(
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<{ available: boolean; minAvailable: number; dates: AvailabilityResult[] }> {
    const { hotelId } = this.tenantContext;
    const dates = this.getDatesInRange(checkIn, checkOut);
    const results: AvailabilityResult[] = [];

    for (const date of dates) {
      const block = await this.getOrLoadBlock(hotelId, roomTypeId, date);
      results.push({
        roomTypeId, date,
        availableRooms: block?.availableRooms ?? 0,
        stopSell: block?.stopSell ?? true,
        closedToArrival: block?.closedToArrival ?? false,
        closedToDeparture: block?.closedToDeparture ?? false,
      });
    }

    const minAvailable = results.reduce((min, r) => !r.stopSell ? Math.min(min, r.availableRooms) : 0, 999);
    const available = minAvailable > 0 && results.every((r) => !r.stopSell);
    return { available, minAvailable: available ? minAvailable : 0, dates: results };
  }

  async decrementAvailability(roomTypeId: string, checkIn: string, checkOut: string, rooms = 1): Promise<void> {
    const { hotelId } = this.tenantContext;
    for (const date of this.getDatesInRange(checkIn, checkOut)) {
      await this.blockRepo.manager.transaction(async (mgr) => {
        const block = await mgr.findOne(AvailabilityBlock, {
          where: { hotelId, roomTypeId, date: date as unknown as Date },
        });
        if (block) {
          await mgr.update(AvailabilityBlock, block.id, {
            availableRooms: Math.max(0, block.availableRooms - rooms),
            bookedRooms: block.bookedRooms + rooms,
          });
          await this.cacheService.del(`availability:${hotelId}:${roomTypeId}:${date}`);
        }
      });
    }
  }

  async incrementAvailability(roomTypeId: string, checkIn: string, checkOut: string, rooms = 1): Promise<void> {
    const { hotelId } = this.tenantContext;
    for (const date of this.getDatesInRange(checkIn, checkOut)) {
      await this.blockRepo.manager.transaction(async (mgr) => {
        const block = await mgr.findOne(AvailabilityBlock, {
          where: { hotelId, roomTypeId, date: date as unknown as Date },
        });
        if (block) {
          await mgr.update(AvailabilityBlock, block.id, {
            availableRooms: Math.min(block.totalRooms, block.availableRooms + rooms),
            bookedRooms: Math.max(0, block.bookedRooms - rooms),
          });
          await this.cacheService.del(`availability:${hotelId}:${roomTypeId}:${date}`);
        }
      });
    }
  }

  async bulkUpdate(updates: BulkUpdateAvailabilityDto[]): Promise<void> {
    const { hotelId } = this.tenantContext;
    for (const u of updates) {
      const existing = await this.blockRepo.findOne({
        where: { hotelId, roomTypeId: u.roomTypeId, date: u.date as unknown as Date },
      });
      if (existing) {
        await this.blockRepo.update(existing.id, {
          ...(u.totalRooms !== undefined && { totalRooms: u.totalRooms }),
          ...(u.availableRooms !== undefined && { availableRooms: u.availableRooms }),
          ...(u.stopSell !== undefined && { stopSell: u.stopSell }),
          ...(u.closedToArrival !== undefined && { closedToArrival: u.closedToArrival }),
          ...(u.closedToDeparture !== undefined && { closedToDeparture: u.closedToDeparture }),
        });
      } else {
        await this.blockRepo.save(this.blockRepo.create({
          hotelId, roomTypeId: u.roomTypeId, date: new Date(u.date),
          totalRooms: u.totalRooms ?? 0,
          availableRooms: u.availableRooms ?? u.totalRooms ?? 0,
          stopSell: u.stopSell ?? false,
          closedToArrival: u.closedToArrival ?? false,
          closedToDeparture: u.closedToDeparture ?? false,
        }));
      }
      await this.cacheService.del(`availability:${hotelId}:${u.roomTypeId}:${u.date}`);
    }
  }

  async getAvailabilityGrid(roomTypeId: string, startDate: string, endDate: string): Promise<AvailabilityBlock[]> {
    const { hotelId } = this.tenantContext;
    return this.blockRepo.find({
      where: { hotelId, roomTypeId, date: Between(new Date(startDate), new Date(endDate)) as unknown as Date },
      order: { date: 'ASC' },
    });
  }

  private async getOrLoadBlock(hotelId: string, roomTypeId: string, date: string): Promise<AvailabilityBlock | null> {
    const cacheKey = `availability:${hotelId}:${roomTypeId}:${date}`;
    const cached = await this.cacheService.get<AvailabilityBlock>(cacheKey);
    if (cached) return cached;
    const block = await this.blockRepo.findOne({ where: { hotelId, roomTypeId, date: date as unknown as Date } });
    if (block) await this.cacheService.set(cacheKey, block, AVAIL_CACHE_TTL);
    return block ?? null;
  }

  private getDatesInRange(checkIn: string, checkOut: string): string[] {
    const dates: string[] = [];
    const cur = new Date(checkIn);
    const end = new Date(checkOut);
    while (cur < end) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }
    return dates;
  }
}
