import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Student } from './student.entity';
import { Quiz } from './quiz.entity';

@Entity('quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'student_id' })
  studentId: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'bigint', name: 'quiz_id' })
  quizId: number;

  @ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @Column({ type: 'jsonb' })
  questions: any[]; // The dynamically generated MCQs: [{ question, options, correctAnswer }]

  @Column({ type: 'jsonb', nullable: true })
  answers: any; // Key-value responses: { [questionIndex]: selectedOption }

  @Column({ type: 'integer', name: 'obtained_marks', default: 0 })
  obtainedMarks: number;

  @Column({ type: 'integer', name: 'max_marks', default: 0 })
  maxMarks: number;

  @Column({ type: 'timestamp', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamp', name: 'submitted_at', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'IN_PROGRESS' })
  status: string; // 'IN_PROGRESS' | 'SUBMITTED'
}
