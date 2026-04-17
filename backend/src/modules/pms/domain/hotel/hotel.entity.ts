import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@shared/infrastructure/database/base.entity';

@Entity('hotels')
export class Hotel extends BaseEntity {
  @Column({ length: 200 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({ name: 'address_line1', length: 300, nullable: true })
  addressLine1: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ name: 'country_code', length: 3, default: 'IDN' })
  countryCode: string;

  @Column({ length: 50, default: 'Asia/Jakarta' })
  timezone: string;

  @Column({ name: 'currency_code', length: 3, default: 'IDR' })
  currencyCode: string;

  @Column({ name: 'tax_id', length: 30, nullable: true })
  taxId: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, unknown>;
}
