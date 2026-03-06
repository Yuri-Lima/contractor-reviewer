import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type MemoryScopeType = 'thread' | 'document' | 'workspace';

@Entity('memories')
@Index('IDX_memories_scope', ['scopeType', 'scopeId'], { unique: true })
@Index('IDX_memories_workspaceId', ['workspaceId'])
export class Memory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  scopeType: MemoryScopeType;

  @Column('uuid')
  scopeId: string; // threadId, documentId, or workspaceId

  @Column('uuid')
  workspaceId: string;

  @Column('text')
  content: string; // .md body, YAML front matter optional

  @Column('int', { default: 1 })
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
