import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Student } from './student.entity';

@Entity('lab_submissions')
export class LabSubmission {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'student_id' })
  studentId: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'varchar', length: 20, default: 'SUBMITTED' })
  status: string; // 'SUBMITTED' | 'GRADED' | 'COMPLETED'

  @Column({ type: 'varchar', length: 250, name: 'submission_url', nullable: true })
  submissionUrl: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  grade: string;

  @Column({ type: 'integer', name: 'obtained_marks', default: 0 })
  obtainedMarks: number;

  @Column({ type: 'integer', name: 'max_marks', default: 100 })
  maxMarks: number;

  @Column({ type: 'date', name: 'submission_date' })
  submissionDate: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;
}
