import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SalaryStatus {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  CHEQUE = 'CHEQUE',
  OTHER = 'OTHER',
}

@Entity('salary_slips')
export class SalarySlip {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  month: string; // e.g. "2026-07"

  @Column({ type: 'decimal', name: 'base_salary', precision: 10, scale: 2 })
  baseSalary: number;

  @Column({ type: 'decimal', name: 'allowances', precision: 10, scale: 2, default: 0 })
  allowances: number;

  @Column({ type: 'decimal', name: 'deductions', precision: 10, scale: 2, default: 0 })
  deductions: number;

  @Column({ type: 'decimal', name: 'net_salary', precision: 10, scale: 2 })
  netSalary: number;

  @Column({ type: 'enum', enum: SalaryStatus, default: SalaryStatus.SUBMITTED })
  status: SalaryStatus;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.BANK_TRANSFER })
  paymentMethod: PaymentMethod;

  @Column({ type: 'timestamp', name: 'submitted_at', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt: Date;

  @Column({ type: 'timestamp', name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'timestamp', name: 'paid_at', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
