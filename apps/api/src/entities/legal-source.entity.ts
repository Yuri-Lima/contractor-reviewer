import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Embedding } from './embedding.entity';

export enum SourceType {
  LAW = 'law',
  REGULATION = 'regulation',
  GUIDANCE = 'guidance',
  CASE_LAW = 'case_law',
  OTHER = 'other',
}

@Entity('legal_sources')
export class LegalSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  country: string; // ISO 3166-1 alpha-2 (e.g., "US", "BR")

  @Column({ nullable: true })
  jurisdiction: string; // e.g., "CA", "SP"

  @Column({ type: 'enum', enum: SourceType })
  sourceType: SourceType;

  @Column()
  sourceName: string; // Name of the law/regulation

  @Column({ nullable: true })
  section: string; // Article, section reference

  @Column()
  language: string; // ISO 639-1 code

  @Column({ type: 'text', nullable: true })
  content: string; // Full text or excerpt

  @Column({ nullable: true })
  url: string;

  @Column({ type: 'date', nullable: true })
  lastUpdated: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Embedding, (embedding) => embedding.legalSource)
  embeddings: Embedding[];
}
