import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import type { AssetContext } from '@contractai-review/shared';

@Entity('image_assets')
@Index(['context', 'ownerId'], { unique: true })
export class ImageAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  context: AssetContext;

  @Column()
  ownerId: string;

  @Column()
  storageKey: string;

  @Column({ type: 'jsonb', nullable: true })
  variantKeys: { thumb?: string; medium?: string } | null;

  @Column()
  mimeType: string;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column('bigint')
  sizeBytes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
