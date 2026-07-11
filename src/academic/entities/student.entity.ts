import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, ManyToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Parent } from './parent.entity';

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

  @ManyToMany(() => Parent, (parent) => parent.students)
  parents: Parent[];
}
