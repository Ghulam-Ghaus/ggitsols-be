import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Student } from '../../academic/entities/student.entity';

export enum FeeStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

@Entity('fee_collections')
export class FeeCollection {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 50, name: 'invoice_number', unique: true })
  invoiceNumber: string;

  @Column({ type: 'bigint', name: 'student_id' })
  studentId: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', length: 50, name: 'academic_term' })
  academicTerm: string;

  @Column({ type: 'decimal', name: 'total_amount', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', name: 'paid_amount', precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: 'date', name: 'due_date' })
  dueDate: string;

  @Column({ type: 'enum', enum: FeeStatus, default: FeeStatus.PENDING })
  status: FeeStatus;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ type: 'decimal', name: 'original_amount', precision: 10, scale: 2, default: 0.00 })
  originalAmount: number;

  @Column({ type: 'decimal', name: 'discount_amount', precision: 10, scale: 2, default: 0.00 })
  discountAmount: number;

  @Column({ type: 'decimal', name: 'student_dashboard_fee', precision: 10, scale: 2, default: 0.00 })
  studentDashboardFee: number;

  @Column({ type: 'decimal', name: 'actual_fee', precision: 10, scale: 2, default: 0.00 })
  actualFee: number;


  @Column({ type: 'timestamp', name: 'invoiced_at', default: () => 'CURRENT_TIMESTAMP' })
  invoicedAt: Date;

  @Column({ type: 'timestamp', name: 'paid_at', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
