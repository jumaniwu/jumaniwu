import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from '../domain/hotel/hotel.entity';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

export interface UpdateHotelSettingsDto {
  name?: string;
  addressLine1?: string;
  city?: string;
  countryCode?: string;
  timezone?: string;
  currencyCode?: string;
  taxId?: string;
  settings?: Record<string, unknown>;
}

@Injectable()
export class HotelService {
  constructor(
    @InjectRepository(Hotel)
    private readonly hotelRepo: Repository<Hotel>,
    private readonly tenantContext: TenantContext,
  ) {}

  async getMyHotel(): Promise<Hotel> {
    const { hotelId } = this.tenantContext;
    const hotel = await this.hotelRepo.findOne({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    return hotel;
  }

  async updateSettings(dto: UpdateHotelSettingsDto): Promise<Hotel> {
    const { hotelId } = this.tenantContext;
    await this.hotelRepo.update(hotelId, dto);
    return this.getMyHotel();
  }
}
