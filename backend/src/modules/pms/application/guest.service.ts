import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guest } from '../domain/guest/guest.entity';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

export interface CreateGuestDto {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  title?: string;
  dateOfBirth?: string;
  guestType?: string;
  notes?: string;
}

export interface UpdateGuestDto extends Partial<CreateGuestDto> {}

@Injectable()
export class GuestService {
  constructor(
    @InjectRepository(Guest)
    private readonly guestRepo: Repository<Guest>,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateGuestDto): Promise<Guest> {
    const { hotelId } = this.tenantContext;
    const guest = this.guestRepo.create({
      hotelId,
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });
    return this.guestRepo.save(guest);
  }

  async findById(id: string): Promise<Guest> {
    const { hotelId } = this.tenantContext;
    const guest = await this.guestRepo.findOne({ where: { id, hotelId } });
    if (!guest) throw new NotFoundException(`Guest ${id} not found`);
    return guest;
  }

  async search(query: string, page = 1, limit = 20): Promise<{ data: Guest[]; total: number }> {
    const { hotelId } = this.tenantContext;
    const qb = this.guestRepo
      .createQueryBuilder('g')
      .where('g.hotel_id = :hotelId', { hotelId })
      .andWhere(
        '(LOWER(g.first_name) LIKE :q OR LOWER(g.last_name) LIKE :q OR g.email LIKE :q OR g.phone LIKE :q)',
        { q: `%${query.toLowerCase()}%` },
      )
      .orderBy('g.last_name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async update(id: string, dto: UpdateGuestDto): Promise<Guest> {
    const { hotelId } = this.tenantContext;
    const guest = await this.guestRepo.findOne({ where: { id, hotelId } });
    if (!guest) throw new NotFoundException(`Guest ${id} not found`);
    await this.guestRepo.update(id, {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });
    return { ...guest, ...dto };
  }
}
