import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Application } from './application.entity';

@Entity('application_documents')
export class ApplicationDocument {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'application_id' })
  applicationId: number;

  @ManyToOne(() => Application, (app: Application) => app.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @Column({ type: 'varchar', length: 100, name: 'document_name' })
  documentName: string;

  @Column({ type: 'text', name: 'file_url' })
  fileUrl: string;
}
