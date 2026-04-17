import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PosOutlet } from '../domain/pos-outlet.entity';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

export interface CreateOutletDto {
  code: string;
  name: string;
  outletType?: string;
  subDepartmentId?: string;
  glRevenueAccountId?: string;
  allowRouteToRoom?: boolean;
  hasTableView?: boolean;
}

export interface MenuItemDto {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName: string;
  isAvailable: boolean;
}

@Injectable()
export class PosOutletService {
  constructor(
    @InjectRepository(PosOutlet)
    private readonly outletRepo: Repository<PosOutlet>,
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateOutletDto): Promise<PosOutlet> {
    const { hotelId } = this.tenantContext;
    const outlet = this.outletRepo.create({ hotelId, ...dto });
    return this.outletRepo.save(outlet);
  }

  async findAll(): Promise<PosOutlet[]> {
    const { hotelId } = this.tenantContext;
    return this.outletRepo.find({ where: { hotelId, isActive: true }, order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<PosOutlet> {
    const { hotelId } = this.tenantContext;
    const outlet = await this.outletRepo.findOne({ where: { id, hotelId } });
    if (!outlet) throw new NotFoundException(`PosOutlet ${id} not found`);
    return outlet;
  }

  async getMenuItems(outletId: string): Promise<MenuItemDto[]> {
    const { hotelId } = this.tenantContext;
    const rows = await this.dataSource.query<MenuItemDto[]>(
      `SELECT pi.id, pi.name, pi.price, pi.is_available AS "isAvailable",
              pc.id AS "categoryId", pc.name AS "categoryName"
       FROM pos_items pi
       JOIN pos_categories pc ON pc.id = pi.pos_category_id
       WHERE pi.hotel_id = $1
         AND pc.pos_outlet_id = $2
         AND pi.is_available = true
       ORDER BY pc.sort_order ASC, pi.name ASC`,
      [hotelId, outletId],
    );
    return rows;
  }
}
