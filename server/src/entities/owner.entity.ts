import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Entitlement } from './entitlement.entity';
import { Device } from './device.entity';
import { SessionLog } from './session-log.entity';

@Entity('owners')
export class Owner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  // email-verification state (soft gate: verified accounts get the badge/banner
  // cleared; nothing is hard-blocked on it for a sleep app)
  @Column({ default: false })
  emailVerified: boolean;

  // Sign in with Apple refresh token — kept ONLY so we can call Apple's /auth/revoke
  // when this account is deleted (Apple's account-deletion requirement). Never exported.
  @Column({ type: 'text', nullable: true })
  appleRefreshToken: string | null;

  // Cross-device preference sync (allow-listed keys only, enforced in UsersService).
  // NEVER holds mood/feeling — the nightly check-in must not become a stored mood
  // log anywhere, server included (build plan §3/§14).
  @Column({ type: 'simple-json', nullable: true })
  prefs: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Entitlement, (entitlement) => entitlement.owner)
  entitlements: Entitlement[];

  @OneToMany(() => Device, (device) => device.owner)
  devices: Device[];

  @OneToMany(() => SessionLog, (log) => log.owner)
  logs: SessionLog[];
}
