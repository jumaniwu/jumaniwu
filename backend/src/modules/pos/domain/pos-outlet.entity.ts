import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

@Entity('pos_outlets')
export class PosOutlet extends TenantEntity {
  @Column({ name: 'sub_department_id', type: 'uuid', nullable: true })
  subDepartmentId: string;

  @Column({ name: 'gl_revenue_account_id', type: 'uuid', nullable: true })
  glRevenueAccountId: string;

  @Column({ length: 20 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'outlet_type', length: 30, default: 'RESTAURANT' })
  outletType: string;

  @Column({ name: 'allow_route_to_room', default: true })
  allowRouteToRoom: boolean;

  @Column({ name: 'has_table_view', default: false })
  hasTableView: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
