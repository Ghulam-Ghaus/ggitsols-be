import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Student } from './student.entity';

@Entity('meeting_reviews')
export class MeetingReview {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'student_id' })
  studentId: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 50, name: 'meeting_type' })
  meetingType: string; // 'PARENT_TEACHER' | 'ONE_ON_ONE' | 'LAB_VIVA'

  @Column({ type: 'varchar', length: 250 })
  attendees: string;

  @Column({ type: 'text' })
  discussion: string;

  @Column({ type: 'text' })
  feedback: string;

  @Column({ type: 'varchar', length: 20, default: 'COMPLETED' })
  status: string; // 'COMPLETED' | 'SCHEDULED'
}
