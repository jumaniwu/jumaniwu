import {
  PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

export abstract class TenantEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'hotel_id' })
  hotelId: string;
}
