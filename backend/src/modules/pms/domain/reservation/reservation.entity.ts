import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@shared/infrastructure/database/base.entity';

export enum ReservationStatus {
  TENTATIVE = 'TENTATIVE',
  CONFIRMED = 'CONFIRMED',
  WAITLIST = 'WAITLIST',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  FULLY_PAID = 'FULLY_PAID',
  REFUNDED = 'REFUNDED',
}

@Entity('reservations')
export class Reservation extends TenantEntity {
  @Column({ name: 'guest_id', type: 'uuid' })
  guestId: string;

  @Column({ name: 'guest_group_id', type: 'uuid', nullable: true })
  guestGroupId: string;

  @Column({ name: 'channel_id', type: 'uuid', nullable: true })
  channelId: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string;

  @Column({ name: 'voucher_id', type: 'uuid', nullable: true })
  voucherId: string;

  @Column({ name: 'confirmation_no', length: 30, unique: true })
  confirmationNo: string;

  @Column({ name: 'ota_booking_ref', length: 100, nullable: true })
  otaBookingRef: string;

  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.TENTATIVE })
  status: ReservationStatus;

  @Column({ name: 'arrival_date', type: 'date' })
  arrivalDate: Date;

  @Column({ name: 'departure_date', type: 'date' })
  departureDate: Date;

  @Column({ type: 'int', default: 1 })
  adults: number;

  @Column({ type: 'int', default: 0 })
  children: number;

  @Column({ length: 30, default: 'DIRECT' })
  source: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'deposit_paid', type: 'decimal', precision: 15, scale: 2, default: 0 })
  depositPaid: number;

  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column({ name: 'special_requests', type: 'text', nullable: true })
  specialRequests: string;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;
}
