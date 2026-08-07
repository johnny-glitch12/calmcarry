import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * A store transaction that must never grant premium again.
 *
 * This exists because a StoreKit 2 JWS is immutable and stays cryptographically valid
 * forever. Verifying its signature proves only "Apple issued this once", never "this
 * is still a live purchase". The buyer's own app posts that JWS in plaintext, so the
 * replay is trivial: buy, capture your own receipt, ask Apple for a refund, then
 * re-post the identical body onto a fresh account. The signature still checks out and
 * expiresDate is still a year away.
 *
 * Reading `revocationDate` off the transaction does NOT close this. The captured JWS
 * was signed BEFORE the refund, so it does not carry a revocation stamp and never
 * will - that check only catches a receipt refunded before it first reached us.
 *
 * So the revocation has to be remembered on OUR side, and it has to outlive the
 * account. Deleting an account used to destroy the entitlement row carrying
 * `status='revoked'` and the unique `transactionRef`, which handed the attacker a
 * clean slate: register again, replay, granted.
 *
 * Deliberately holds NO personal data - a store transaction id detached from any
 * account is not personal information, so this survives an erasure request intact.
 */
@Entity('revoked_transactions')
export class RevokedTransaction {
  /** Apple originalTransactionId / Google purchaseToken. */
  @PrimaryColumn({ type: 'text' })
  transactionRef: string;

  /** 'refund' | 'revoked' | 'account_deleted' - why we will never honour it again. */
  @Column({ type: 'text' })
  reason: string;

  @CreateDateColumn()
  recordedAt: Date;
}
