import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, ManyToMany, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Parent } from './parent.entity';
import { Batch } from './batch.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'user_id', unique: true })
  userId: string; // TypeORM maps pg BIGINT to string to prevent float precision loss

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 50, name: 'registration_no', unique: true, nullable: true })
  registrationNo: string;

  @Column({ type: 'date', name: 'admission_date', nullable: true })
  admissionDate: string;

  @Column({ type: 'bigint', name: 'batch_id', nullable: true })
  batchId: number | null;

  @ManyToOne(() => Batch, (batch) => batch.students, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch: Batch;

  @ManyToMany(() => Parent, (parent) => parent.students)
  parents: Parent[];

  // Education Details
  @Column({ type: 'varchar', length: 100, name: 'highest_qualification', nullable: true })
  highestQualification: string;

  @Column({ type: 'varchar', length: 150, name: 'institution_name', nullable: true })
  institutionName: string;

  @Column({ type: 'varchar', length: 150, name: 'board_university', nullable: true })
  boardUniversity: string;

  @Column({ type: 'integer', name: 'completion_year', nullable: true })
  completionYear: number;

  @Column({ type: 'varchar', length: 20, name: 'obtained_gpa', nullable: true })
  obtainedGpa: string;

  @Column({ type: 'varchar', length: 50, name: 'payment_option', default: 'INSTALLMENT' })
  paymentOption: 'FULL_PAYMENT' | 'INSTALLMENT';

  @Column({ type: 'decimal', name: 'discount_percentage', precision: 5, scale: 2, default: 0.00 })
  discountPercentage: number;

  @Column({ type: 'decimal', name: 'discount_flat', precision: 10, scale: 2, default: 0.00 })
  discountFlat: number;
}
