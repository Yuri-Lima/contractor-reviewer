import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_onboarding_state')
export class UserOnboarding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  userId: string;

  @Column({ type: 'int', default: 1 })
  onboardingVersion: number;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ type: 'boolean', default: false })
  dismissed: boolean;

  @Column({ type: 'jsonb', default: {} })
  checklist: Record<string, boolean>;

  @Column({ type: 'jsonb', default: {} })
  tour: Record<string, { completed: boolean; dismissed: boolean; lastStepId: string | null }>;

  @Column({ type: 'jsonb', default: {} })
  visitedRoutes: Record<string, boolean>;

  @Column({ type: 'timestamptz', nullable: true })
  lastResetAt: Date | null;

  @Column({ type: 'int', default: 0 })
  resetCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
