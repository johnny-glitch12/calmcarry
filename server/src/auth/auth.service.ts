import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt, randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { config } from '../config';
import { AuthCode, AuthCodePurpose, Owner, RefreshToken } from '../entities';
import { MailService } from '../integrations/mail.service';
import { SocialAuthService, SocialProvider } from '../integrations/social-auth.service';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './jwt-auth.guard';

export interface AuthResult {
  token: string;
  /** opaque rotating token for /auth/refresh; stored securely client-side */
  refreshToken: string;
  user: { id: string; email: string; name: string };
}

const CODE_TTL_MS = 15 * 60_000; // reset/verify codes live 15 minutes
const CODE_MAX_ATTEMPTS = 5;
const REFRESH_TTL_MS = 60 * 24 * 60 * 60_000; // 60 days

/** SHA-256 hex of an opaque high-entropy token (fast + indexable — bcrypt is for
 *  low-entropy secrets like passwords and 6-digit codes, not 256-bit tokens). */
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly social: SocialAuthService,
    private readonly mail: MailService,
    @InjectRepository(AuthCode) private readonly codes: Repository<AuthCode>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  /** Sign in with Apple / Google — verifies the identity token, then finds or creates the household. */
  async socialLogin(provider: SocialProvider, idToken: string, authorizationCode?: string): Promise<AuthResult> {
    const id = await this.social.verify(provider, idToken);
    let owner = await this.usersService.findByEmail(id.email);
    if (!owner) {
      const passwordHash = await bcrypt.hash(randomUUID(), 12); // no password — social only
      owner = await this.usersService.createOwner(id.email, passwordHash, id.name);
      await this.usersService.grantEntitlement(owner.id, 'free');
      // the provider already verified this address before issuing the token
      if (id.emailVerified) await this.usersService.setEmailVerified(owner.id);
    } else if (!id.emailVerified) {
      // An account with this email already exists. Logging into it from a social
      // token whose email is UNVERIFIED would let an attacker hijack that account
      // by claiming its address. Require a provider-verified email to merge.
      throw new UnauthorizedException('Email not verified by the provider');
    }
    // Sign in with Apple: capture a refresh token so we can revoke the user's Apple
    // tokens if they later delete their account (Apple App Store requirement).
    if (provider === 'apple' && authorizationCode && this.social.appleRevokeConfigured()) {
      const refresh = await this.social.appleExchangeCode(authorizationCode);
      if (refresh) await this.usersService.setAppleRefreshToken(owner.id, refresh);
    }
    return this.buildAuthResult(owner);
  }

  /** Account deletion: revoke Sign in with Apple tokens FIRST (Apple requirement),
   *  then erase all data. Revoke is best-effort and never blocks the deletion. */
  async deleteAccount(ownerId: string): Promise<void> {
    const owner = await this.usersService.findById(ownerId);
    if (owner?.appleRefreshToken) await this.social.appleRevoke(owner.appleRefreshToken);
    await this.usersService.deleteAccount(ownerId);
  }

  // A fixed bcrypt hash so the "unknown email" path still performs a comparison —
  // equalizes response time and avoids leaking which emails exist (enumeration).
  private static readonly DUMMY_HASH =
    '$2a$12$ifr9753A0wdd1/dqPgH7sOtNk8bnLdvU4DTYTltcLD3gZujh37BwK';

  async login(email: string, password: string): Promise<AuthResult> {
    const owner = await this.usersService.findByEmail(email);
    const hash = owner?.passwordHash ?? AuthService.DUMMY_HASH;
    const valid = await bcrypt.compare(password, hash);
    if (!owner || !valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResult(owner);
  }

  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const owner = await this.usersService.createOwner(
      email,
      passwordHash,
      name,
    );

    // every new owner starts on the free tier
    await this.usersService.grantEntitlement(owner.id, 'free');
    // soft verification: send a code in the background — never block signup on it
    this.issueCode(owner, 'verify').catch(() => {});

    return this.buildAuthResult(owner);
  }

  // ---- password reset (6-digit emailed code; no account enumeration) ----

  /** Always resolves ok — whether or not the email exists (no enumeration). */
  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    const owner = await this.usersService.findByEmail(email);
    if (owner) await this.issueCode(owner, 'reset');
    return { ok: true };
  }

  /** Verify the emailed code, set the new password, and sign the user in.
   *  Consumes the code and revokes ALL refresh tokens — a password reset must
   *  end every existing session. */
  async resetPassword(email: string, code: string, newPassword: string): Promise<AuthResult> {
    const owner = await this.usersService.findByEmail(email);
    if (!owner) throw new UnauthorizedException('Invalid code');
    await this.consumeCode(owner.id, 'reset', code);
    await this.usersService.setPassword(owner.id, await bcrypt.hash(newPassword, 10));
    await this.refreshTokens.delete({ ownerId: owner.id });
    return this.buildAuthResult(owner);
  }

  // ---- email verification (soft gate: nothing is hard-blocked on it) ----

  async sendEmailVerification(ownerId: string): Promise<{ ok: true }> {
    const owner = await this.usersService.findById(ownerId);
    if (owner && !owner.emailVerified) await this.issueCode(owner, 'verify');
    return { ok: true };
  }

  async verifyEmail(ownerId: string, code: string): Promise<{ ok: true; emailVerified: true }> {
    await this.consumeCode(ownerId, 'verify', code);
    await this.usersService.setEmailVerified(ownerId);
    return { ok: true, emailVerified: true };
  }

  // ---- refresh-token rotation + server-side logout ----

  /** Rotate: validate the presented token, revoke it, issue a fresh pair. A
   *  replayed (already-rotated) token fails here — by design. */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const row = await this.refreshTokens.findOne({ where: { tokenHash: sha256(refreshToken) } });
    if (!row || row.revokedAt || new Date(row.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const owner = await this.usersService.findById(row.ownerId);
    if (!owner) throw new UnauthorizedException('Invalid refresh token');
    row.revokedAt = new Date();
    await this.refreshTokens.save(row);
    return this.buildAuthResult(owner);
  }

  /** Server-side logout: revoke the presented refresh token. Idempotent, always ok. */
  async logout(refreshToken: string): Promise<{ ok: true }> {
    await this.refreshTokens.update({ tokenHash: sha256(refreshToken) }, { revokedAt: new Date() });
    return { ok: true };
  }

  // ---- internals ----

  private async issueCode(owner: Owner, purpose: AuthCodePurpose): Promise<void> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.codes.delete({ ownerId: owner.id, purpose }); // one live code per purpose
    await this.codes.save(
      this.codes.create({
        ownerId: owner.id,
        purpose,
        codeHash: await bcrypt.hash(code, 8), // 10^6 space is guarded by attempts + TTL
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        attempts: 0,
      }),
    );
    const subject = purpose === 'reset' ? 'Your CalmCarry password reset code' : 'Verify your CalmCarry email';
    await this.mail.send({
      to: owner.email,
      subject,
      text:
        `Hi ${owner.name},\n\nYour code is: ${code}\n\nIt expires in 15 minutes. ` +
        `If you didn't request this, you can safely ignore this email.\n\nSleep well,\nCalmCarry`,
    });
  }

  private async consumeCode(ownerId: string, purpose: AuthCodePurpose, code: string): Promise<void> {
    const row = await this.codes.findOne({ where: { ownerId, purpose } });
    if (!row || new Date(row.expiresAt).getTime() < Date.now() || row.attempts >= CODE_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Invalid code');
    }
    const ok = await bcrypt.compare(code, row.codeHash);
    if (!ok) {
      row.attempts += 1;
      await this.codes.save(row);
      throw new UnauthorizedException('Invalid code');
    }
    await this.codes.delete({ id: row.id });
  }

  private async buildAuthResult(owner: Owner): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: owner.id,
      email: owner.email,
      name: owner.name,
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: config.jwtSecret,
      expiresIn: config.jwtExpiresIn,
    });

    const refreshToken = randomBytes(32).toString('hex');
    await this.refreshTokens.save(
      this.refreshTokens.create({
        ownerId: owner.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        revokedAt: null,
      }),
    );

    return {
      token,
      refreshToken,
      user: { id: owner.id, email: owner.email, name: owner.name },
    };
  }
}
