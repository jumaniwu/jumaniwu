import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CaptainOrder } from '../domain/captain-order.entity';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/events/event-bus.interface';
import { TenantContext } from '@shared/kernel/tenant/tenant.context';
import { CaptainOrderSentToKitchenEvent } from '../domain/pos.events';

export interface CreateCaptainOrderDto {
  posOutletId: string;
  posTableId?: string;
  guestId?: string;
  orderType?: string;
  roomNumber?: string;
  covers?: number;
}

export interface AddOrderItemDto {
  posItemId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  modifiersApplied?: Record<string, unknown>;
}

export interface VoidOrderItemDto {
  voidReason: string;
}

@Injectable()
export class CaptainOrderService {
  constructor(
    @InjectRepository(CaptainOrder)
    private readonly orderRepo: Repository<CaptainOrder>,
    private readonly dataSource: DataSource,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly tenantContext: TenantContext,
  ) {}

  async createOrder(dto: CreateCaptainOrderDto): Promise<CaptainOrder> {
    const { hotelId, userId } = this.tenantContext;
    const orderNumber = await this.generateOrderNumber(hotelId);
    const order = this.orderRepo.create({
      hotelId,
      posOutletId: dto.posOutletId,
      posTableId: dto.posTableId,
      guestId: dto.guestId,
      orderNumber,
      status: 'OPEN',
      orderType: dto.orderType ?? 'DINE_IN',
      roomNumber: dto.roomNumber,
      covers: dto.covers ?? 1,
      servedBy: userId,
      createdBy: userId,
      orderedAt: new Date(),
    });
    return this.orderRepo.save(order);
  }

  async addItem(orderId: string, dto: AddOrderItemDto): Promise<void> {
    const { hotelId } = this.tenantContext;
    const order = await this.findOrderOrFail(orderId, hotelId);
    if (order.status !== 'OPEN') throw new BadRequestException('Order is not open');

    const lineTotal = dto.unitPrice * dto.quantity;
    await this.dataSource.query(
      `INSERT INTO captain_order_items
         (captain_order_id, pos_item_id, item_name, unit_price, quantity, line_total,
          kitchen_status, notes, modifiers_applied)
       SELECT $1, pi.id, pi.name, $3, $4, $5, 'PENDING', $6, $7
       FROM pos_items pi
       WHERE pi.id = $2`,
      [orderId, dto.posItemId, dto.unitPrice, dto.quantity, lineTotal,
       dto.notes ?? null, dto.modifiersApplied ? JSON.stringify(dto.modifiersApplied) : null],
    );
  }

  async sendToKitchen(orderId: string): Promise<CaptainOrder> {
    const { hotelId } = this.tenantContext;
    const order = await this.findOrderOrFail(orderId, hotelId);
    if (order.status !== 'OPEN') throw new BadRequestException('Order is not open');

    await this.dataSource.query(
      `UPDATE captain_order_items
       SET kitchen_status = 'SENT', sent_to_kitchen_at = NOW()
       WHERE captain_order_id = $1 AND kitchen_status = 'PENDING' AND is_void = false`,
      [orderId],
    );

    const itemCount = await this.dataSource.query<Array<{ count: string }>>(
      `SELECT COUNT(*) FROM captain_order_items WHERE captain_order_id = $1 AND is_void = false`,
      [orderId],
    );

    await this.eventBus.publish(
      new CaptainOrderSentToKitchenEvent(
        hotelId, orderId, order.posOutletId,
        parseInt(itemCount[0]?.count ?? '0', 10),
      ),
    );

    return order;
  }

  async voidItem(orderItemId: string): Promise<void> {
    const { hotelId, userId } = this.tenantContext;
    await this.dataSource.query(
      `UPDATE captain_order_items SET is_void = true WHERE id = $1
       AND captain_order_id IN (SELECT id FROM captain_orders WHERE hotel_id = $2)`,
      [orderItemId, hotelId],
    );
  }

  async completeOrder(orderId: string): Promise<CaptainOrder> {
    const { hotelId } = this.tenantContext;
    const order = await this.findOrderOrFail(orderId, hotelId);
    await this.orderRepo.update(orderId, { status: 'COMPLETED', completedAt: new Date() });
    order.status = 'COMPLETED';
    return order;
  }

  async findById(orderId: string): Promise<CaptainOrder> {
    const { hotelId } = this.tenantContext;
    return this.findOrderOrFail(orderId, hotelId);
  }

  async getOrderWithItems(orderId: string) {
    const { hotelId } = this.tenantContext;
    const order = await this.findOrderOrFail(orderId, hotelId);
    const items = await this.dataSource.query(
      `SELECT coi.*, pi.name AS item_name_current
       FROM captain_order_items coi
       LEFT JOIN pos_items pi ON pi.id = coi.pos_item_id
       WHERE coi.captain_order_id = $1
       ORDER BY coi.created_at ASC`,
      [orderId],
    );
    return { order, items };
  }

  async findByOutlet(outletId: string, status?: string): Promise<CaptainOrder[]> {
    const { hotelId } = this.tenantContext;
    const qb = this.orderRepo.createQueryBuilder('co')
      .where('co.hotel_id = :hotelId', { hotelId })
      .andWhere('co.pos_outlet_id = :outletId', { outletId })
      .orderBy('co.ordered_at', 'DESC');
    if (status) qb.andWhere('co.status = :status', { status });
    return qb.getMany();
  }

  private async findOrderOrFail(id: string, hotelId: string): Promise<CaptainOrder> {
    const order = await this.orderRepo.findOne({ where: { id, hotelId } });
    if (!order) throw new NotFoundException(`CaptainOrder ${id} not found`);
    return order;
  }

  private async generateOrderNumber(hotelId: string): Promise<string> {
    const today = new Date();
    const prefix = `CO${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await this.orderRepo
      .createQueryBuilder('co')
      .where('co.hotel_id = :hotelId', { hotelId })
      .andWhere('co.order_number LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}
