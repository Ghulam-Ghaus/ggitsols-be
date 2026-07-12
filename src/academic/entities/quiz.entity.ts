import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Batch } from './batch.entity';

@Entity('quizzes')
export class Quiz {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'varchar', length: 150 })
  topic: string;

  @Column({ type: 'varchar', length: 20 })
  difficulty: string; // 'simple' | 'moderate' | 'advance'

  @Column({ type: 'integer', name: 'num_questions', default: 20 })
  numQuestions: number;

  @Column({ type: 'integer', name: 'duration_days', default: 3 })
  durationDays: number;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'integer', name: 'time_limit_mins', default: 30 })
  timeLimitMins: number;

  @Column({ type: 'integer', name: 'allowed_attempts', default: 1 })
  allowedAttempts: number;

  @Column({ type: 'bigint', name: 'batch_id' })
  batchId: number;

  @ManyToOne(() => Batch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch: Batch;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
