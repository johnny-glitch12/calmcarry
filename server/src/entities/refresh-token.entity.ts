import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TIMESTAMP_TYPE } from './column-types';

/**
 * Rotating refresh tokens. The client holds an opaque high-entropy token; we
 * store only its SHA-256 (high entropy → a fast hash is safe, and it lets us
 * look the row up directly by hash). Every /auth/refresh ROTATES: the old row
 * is revoked and a new one issued, so a stolen-and-used token invalidates
 * itself. Logout revokes; account deletion removes all rows.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'text' })
  ownerId: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  tokenHash: string;

  @Column({ type: TIMESTAMP_TYPE })
  expiresAt: Date;

  @Column({ type: TIMESTAMP_TYPE, nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
