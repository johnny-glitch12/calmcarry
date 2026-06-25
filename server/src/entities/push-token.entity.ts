import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PushPlatform = 'ios' | 'android' | 'web';

/** A registered device push token for gentle, opt-in reminders (build plan §8). */
@Entity('push_tokens')
export class PushToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @Column({ unique: true })
  token: string;

  @Column({ type: 'text', default: 'ios' })
  platform: PushPlatform;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
