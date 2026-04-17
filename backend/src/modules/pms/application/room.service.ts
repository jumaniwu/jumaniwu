import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, HousekeepingStatus } from '../domain/room/room.entity';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(filters?: {
    floor?: string;
    hkStatus?: string;
    occupancyStatus?: string;
  }): Promise<Room[]> {
    const { hotelId } = this.tenantContext;
    const qb = this.roomRepo
      .createQueryBuilder('r')
      .where('r.hotel_id = :hotelId', { hotelId })
      .andWhere('r.is_active = true')
      .orderBy('r.room_number', 'ASC');

    if (filters?.floor) qb.andWhere('r.floor = :floor', { floor: parseInt(filters.floor, 10) });
    if (filters?.hkStatus) qb.andWhere('r.hk_status = :hkStatus', { hkStatus: filters.hkStatus });
    if (filters?.occupancyStatus)
      qb.andWhere('r.occupancy_status = :os', { os: filters.occupancyStatus });

    return qb.getMany();
  }

  async findById(id: string): Promise<Room> {
    const { hotelId } = this.tenantContext;
    const room = await this.roomRepo.findOne({ where: { id, hotelId } });
    if (!room) throw new NotFoundException(`Room ${id} not found`);
    return room;
  }

  async getFloorPlan(): Promise<Room[]> {
    const { hotelId } = this.tenantContext;
    return this.roomRepo.find({
      where: { hotelId, isActive: true },
      select: ['id', 'roomNumber', 'floor', 'building', 'posX', 'posY', 'hkStatus', 'occupancyStatus'],
    });
  }

  async updateHkStatus(id: string, hkStatus: string): Promise<Room> {
    const { hotelId } = this.tenantContext;
    const room = await this.roomRepo.findOne({ where: { id, hotelId } });
    if (!room) throw new NotFoundException(`Room ${id} not found`);

    const validStatuses = Object.values(HousekeepingStatus);
    if (!validStatuses.includes(hkStatus as HousekeepingStatus)) {
      throw new NotFoundException(`Invalid HK status: ${hkStatus}`);
    }

    await this.roomRepo.update(id, {
      hkStatus: hkStatus as HousekeepingStatus,
      ...(hkStatus === HousekeepingStatus.CLEAN ? { lastCleanedAt: new Date() } : {}),
    });
    room.hkStatus = hkStatus as HousekeepingStatus;
    return room;
  }
}
