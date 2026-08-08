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

  // Whether THIS user set their own password. A social-only account (Apple/Google)
  // holds a random password it can never enter, so account-password checks always fail
  // for it - which is why the parent-gate "Forgot PIN?" recovery must not be offered to
  // one (it would dead-end). Defaults true; set false when a social account is created,
  // and back to true if a social user later sets a real password.
  @Column({ default: true })
  hasPassword: boolean;

  @Column()
  name: string;

  // email-verification state (soft gate: verified accounts get the badge/banner
  // cleared; nothing is hard-blocked on it for a sleep app)
  @Column({ default: false })
  emailVerified: boolean;

  // Sign in with Apple refresh token - kept ONLY so we can call Apple's /auth/revoke
  // when this account is deleted (Apple's account-deletion requirement). Never exported.
  @Column({ type: 'text', nullable: true })
  appleRefreshToken: string | null;

  /**
   * Bumped whenever every existing session must stop working: a password change or a
   * password reset. The value is baked into each access token as `tv`, and
   * JwtAuthGuard rejects any token whose `tv` no longer matches.
   *
   * Without this, changing a password revoked only REFRESH tokens, so an
   * already-issued access token kept full access for the remainder of its 7-day life
   * - including data export and account deletion. That is precisely backwards for
   * the case the feature exists to serve: "someone else is in my account".
   */
  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

  // Cross-device preference sync (allow-listed keys only, enforced in UsersService).
  // NEVER holds mood/feeling - the nightly check-in must not become a stored mood
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
