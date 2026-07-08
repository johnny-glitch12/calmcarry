import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TIMESTAMP_TYPE } from './column-types';

export type AuthCodePurpose = 'reset' | 'verify';

/**
 * Short-lived 6-digit codes for password reset + email verification. One live
 * code per (owner, purpose) — issuing a new one replaces the old. The code
 * itself is bcrypt-hashed (never stored or logged in the clear) and guarded by
 * an attempt counter + expiry, so 10^6 space is fine.
 */
@Entity('auth_codes')
export class AuthCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'text' })
  ownerId: string;

  @Column({ type: 'text' })
  purpose: AuthCodePurpose;

  @Column({ type: 'text' })
  codeHash: string;

  @Column({ type: TIMESTAMP_TYPE })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @CreateDateColumn()
  createdAt: Date;
}
