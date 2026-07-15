import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Unique, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Batch } from './batch.entity';
import { User } from '../../users/entities/user.entity';
import { AttendanceRecord } from './attendance-record.entity';

@Entity('attendance')
@Unique(['batchId', 'date'])
export class Attendance {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'batch_id' })
  batchId: number;

  @ManyToOne(() => Batch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch: Batch;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'bigint', name: 'taken_by_user_id', nullable: true })
  takenByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'taken_by_user_id' })
  takenByUser: User | null;

  @OneToMany(() => AttendanceRecord, (record: AttendanceRecord) => record.attendance)
  records: AttendanceRecord[];

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
