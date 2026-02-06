import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';

export enum FileStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  AVAILABLE = 'available',
  QUARANTINED = 'quarantined',
  ERROR = 'error',
}

@Entity('document_files')
export class DocumentFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  documentId: string;

  @Column()
  fileName: string;

  @Column()
  mimeType: string;

  @Column('bigint')
  sizeBytes: number;

  @Column()
  storageKey: string; // S3/R2 key or local path

  @Column({ type: 'enum', enum: FileStatus, default: FileStatus.UPLOADING })
  status: FileStatus;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  ocrText: string; // Only if OCR was performed

  @Column({ type: 'int', nullable: true })
  pageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Document, (document) => document.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;
}
