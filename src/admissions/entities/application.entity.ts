import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Course } from '../../academic/entities/course.entity';
import { ApplicationDocument } from './application-document.entity';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'course_id', nullable: true })
  courseId: number;

  @ManyToOne(() => Course, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column({ type: 'varchar', length: 150, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 150, name: 'guardian_name', nullable: true })
  guardianName: string;

  @Column({ type: 'varchar', length: 50, name: 'guardian_relation', nullable: true })
  guardianRelation: string;

  @Column({ type: 'varchar', length: 30, name: 'guardian_phone', nullable: true })
  guardianPhone: string;

  @Column({ type: 'varchar', length: 150, name: 'guardian_email', nullable: true })
  guardianEmail: string;

  @Column({ type: 'varchar', length: 150, name: 'guardian2_name', nullable: true })
  guardian2Name: string;

  @Column({ type: 'varchar', length: 50, name: 'guardian2_relation', nullable: true })
  guardian2Relation: string;

  @Column({ type: 'varchar', length: 30, name: 'guardian2_phone', nullable: true })
  guardian2Phone: string;

  @Column({ type: 'varchar', length: 150, name: 'guardian2_email', nullable: true })
  guardian2Email: string;

  @Column({ type: 'boolean', name: 'has_sibling', default: false })
  hasSibling: boolean;

  @Column({ type: 'varchar', length: 150, name: 'sibling_name', nullable: true })
  siblingName: string;

  @Column({ type: 'varchar', length: 50, name: 'sibling_registration_no', nullable: true })
  siblingRegistrationNo: string;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column({ type: 'varchar', length: 50, name: 'payment_option', default: 'FULL_PAYMENT' })
  paymentOption: 'FULL_PAYMENT' | 'INSTALLMENT';

  @Column({ type: 'boolean', name: 'claim_free_freelancing', default: false })
  claimFreeFreelancing: boolean;

  // Education details
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

  @Column({ type: 'varchar', length: 255, name: 'password_hash', nullable: true })
  passwordHash: string;

  @OneToMany(() => ApplicationDocument, (doc: ApplicationDocument) => doc.application, { cascade: true, nullable: true })
  documents: ApplicationDocument[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
