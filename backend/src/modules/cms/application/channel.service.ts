import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from '../domain/channel.entity';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

export interface CreateChannelDto {
  code: string;
  name: string;
  channelType?: string;
  commissionRate?: number;
}

@Injectable()
export class ChannelService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateChannelDto): Promise<Channel> {
    const { hotelId } = this.tenantContext;
    const channel = this.channelRepo.create({ hotelId, ...dto, syncStatus: 'DISCONNECTED' });
    return this.channelRepo.save(channel);
  }

  async findAll(): Promise<Channel[]> {
    const { hotelId } = this.tenantContext;
    return this.channelRepo.find({ where: { hotelId }, order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Channel> {
    const { hotelId } = this.tenantContext;
    const channel = await this.channelRepo.findOne({ where: { id, hotelId } });
    if (!channel) throw new NotFoundException(`Channel ${id} not found`);
    return channel;
  }

  async updateSyncStatus(id: string, syncStatus: string): Promise<void> {
    const { hotelId } = this.tenantContext;
    await this.channelRepo.update({ id, hotelId }, {
      syncStatus,
      ...(syncStatus === 'CONNECTED' ? { lastPushAt: new Date() } : {}),
    });
  }

  async deactivate(id: string): Promise<void> {
    const { hotelId } = this.tenantContext;
    await this.channelRepo.update({ id, hotelId }, { isActive: false, syncStatus: 'DISCONNECTED' });
  }
}
