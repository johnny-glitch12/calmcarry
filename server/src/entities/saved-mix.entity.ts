import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** A named sound-machine mix (build plan §9 SavedMix). */
@Entity('saved_mixes')
export class SavedMix {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  profileId: string;

  @Column()
  name: string;

  /** [{ key: 'rain', level: 2 }, ...] — per-sound volume levels */
  @Column({ type: 'simple-json' })
  sounds: { key: string; level: number }[];

  @CreateDateColumn()
  createdAt: Date;
}
