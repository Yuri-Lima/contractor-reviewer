import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('prompts')
export class Prompt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 100 })
  key: string; // e.g. 'chat.system', 'chat.user', 'redline.playbook.balanced'

  @Column('varchar', { length: 50, default: 'default' })
  variant: string; // For A/B testing: 'default', 'v1', 'v2', etc.

  @Column('uuid', { nullable: true })
  workspaceId: string | null; // null = global; non-null = workspace-specific override

  @Column('text')
  content: string; // Prompt or template with {{variable}} placeholders

  @Column('jsonb', { nullable: true })
  metadata: {
    description?: string;
    requiredVariables?: string[];
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
