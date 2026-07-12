import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  fee: number;

  @Column({ type: 'numeric', name: 'monthly_fee', precision: 10, scale: 2, default: 0 })
  monthlyFee: number;

  @Column({ type: 'numeric', name: 'full_payment_discount', precision: 5, scale: 2, default: 0 })
  fullPaymentDiscount: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  duration: string;

  @Column({ type: 'integer', name: 'sort_no', default: 0 })
  sortNo: number;
}
