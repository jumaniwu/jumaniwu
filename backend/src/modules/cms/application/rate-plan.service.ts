import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RatePlan } from '../domain/rate-plan.entity';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';

export interface CreateRatePlanDto {
  roomTypeId: string;
  code: string;
  name: string;
  mealPlan?: string;
  cancelPolicy?: string;
  minStay?: number;
  maxStay?: number;
  isRefundable?: boolean;
}

export interface UpsertDailyRateDto {
  ratePlanId: string;
  rateDate: string;
  rateSingle: number;
  rateDouble: number;
  rateExtraAdult?: number;
  rateExtraChild?: number;
  stopSell?: boolean;
  minStayOverride?: number;
}

@Injectable()
export class RatePlanService {
  constructor(
    @InjectRepository(RatePlan)
    private readonly ratePlanRepo: Repository<RatePlan>,
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateRatePlanDto): Promise<RatePlan> {
    const { hotelId } = this.tenantContext;
    const plan = this.ratePlanRepo.create({ hotelId, ...dto });
    return this.ratePlanRepo.save(plan);
  }

  async findAll(roomTypeId?: string): Promise<RatePlan[]> {
    const { hotelId } = this.tenantContext;
    const where: any = { hotelId, isActive: true };
    if (roomTypeId) where.roomTypeId = roomTypeId;
    return this.ratePlanRepo.find({ where, order: { code: 'ASC' } });
  }

  async findById(id: string): Promise<RatePlan> {
    const { hotelId } = this.tenantContext;
    const plan = await this.ratePlanRepo.findOne({ where: { id, hotelId } });
    if (!plan) throw new NotFoundException(`RatePlan ${id} not found`);
    return plan;
  }

  async upsertDailyRates(rates: UpsertDailyRateDto[]): Promise<void> {
    const { hotelId } = this.tenantContext;
    for (const r of rates) {
      await this.dataSource.query(
        `INSERT INTO rate_plan_rates
           (hotel_id, rate_plan_id, rate_date, rate_single, rate_double,
            rate_extra_adult, rate_extra_child, stop_sell, min_stay_override)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (rate_plan_id, rate_date)
         DO UPDATE SET
           rate_single = EXCLUDED.rate_single,
           rate_double = EXCLUDED.rate_double,
           rate_extra_adult = EXCLUDED.rate_extra_adult,
           rate_extra_child = EXCLUDED.rate_extra_child,
           stop_sell = EXCLUDED.stop_sell,
           min_stay_override = EXCLUDED.min_stay_override,
           updated_at = NOW()`,
        [
          hotelId, r.ratePlanId, r.rateDate,
          r.rateSingle, r.rateDouble,
          r.rateExtraAdult ?? 0, r.rateExtraChild ?? 0,
          r.stopSell ?? false, r.minStayOverride ?? null,
        ],
      );
    }
  }

  async getDailyRates(ratePlanId: string, startDate: string, endDate: string) {
    const { hotelId } = this.tenantContext;
    return this.dataSource.query(
      `SELECT * FROM rate_plan_rates
       WHERE hotel_id = $1 AND rate_plan_id = $2
         AND rate_date BETWEEN $3 AND $4
       ORDER BY rate_date ASC`,
      [hotelId, ratePlanId, startDate, endDate],
    );
  }

  async update(id: string, dto: Partial<CreateRatePlanDto>): Promise<RatePlan> {
    const { hotelId } = this.tenantContext;
    const plan = await this.ratePlanRepo.findOne({ where: { id, hotelId } });
    if (!plan) throw new NotFoundException(`RatePlan ${id} not found`);
    await this.ratePlanRepo.update(id, dto);
    return { ...plan, ...dto };
  }

  async deactivate(id: string): Promise<void> {
    const { hotelId } = this.tenantContext;
    await this.ratePlanRepo.update({ id, hotelId }, { isActive: false });
  }
}
