import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { config } from '../config';

export type SocialProvider = 'apple' | 'google';
export interface SocialIdentity {
  email: string;
  name: string;
  sub: string;
  emailVerified: boolean;
  provider: SocialProvider;
}

/**
 * Resolves a Sign in with Apple / Google identity token to a trusted identity by
 * VERIFYING it against the provider's published JWKS (RS256 signature) and checking
 * issuer + audience + expiry. Without that, the token's email/sub claims are
 * attacker-controllable (account takeover) - so this is the real gate, not a decode.
 *
 * Fails CLOSED when the provider's client id isn't configured (we can't bind the
 * token's `aud` without it), so an unconfigured environment refuses social sign-in
 * rather than trusting an unaudienced token.
 */
const PROVIDERS: Record<
  SocialProvider,
  { jwks: ReturnType<typeof createRemoteJWKSet>; issuer: string | string[]; audience: () => string }
> = {
  apple: {
    jwks: createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),
    issuer: 'https://appleid.apple.com',
    audience: () => config.apple.signInClientId, // native: the app's bundle id
  },
  google: {
    jwks: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: () => config.google.signInClientId, // the OAuth web client id
  },
};

@Injectable()
export class SocialAuthService {
  async verify(provider: SocialProvider, idToken: string): Promise<SocialIdentity> {
    const p = PROVIDERS[provider];
    if (!p) throw new BadRequestException('Unknown provider');

    const audience = p.audience();
    if (!audience) {
      throw new ServiceUnavailableException(
        `${provider} sign-in is not configured (missing client id).`,
      );
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(idToken, p.jwks, { issuer: p.issuer, audience }));
    } catch {
      // bad signature / wrong aud or iss / expired → never trust it
      throw new UnauthorizedException('Identity token failed verification.');
    }
    if (!payload.sub) throw new UnauthorizedException('Identity token missing subject.');

    const ev = (payload as { email_verified?: unknown }).email_verified;
    const emailVerified = ev === true || ev === 'true';
    const rawEmail = (payload as { email?: unknown }).email;
    const email =
      typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : `${provider}-${payload.sub}@users.calmcarry`;
    const rawName = (payload as { name?: unknown }).name;
    const name = typeof rawName === 'string' && rawName ? rawName : email.split('@')[0];
    return { email, name, sub: String(payload.sub), emailVerified, provider };
  }

  // ---------- Sign in with Apple revoke (account-deletion requirement) ----------
  /** True once the Services-ID + team id + key id + .p8 are configured. */
  appleRevokeConfigured(): boolean {
    return !!(
      config.apple.signInClientId &&
      config.apple.signInTeamId &&
      config.apple.signInKeyId &&
      config.apple.signInKeyP8
    );
  }

  /** The short-lived ES256 client_secret JWT Apple requires for token/revoke calls. */
  private async appleClientSecret(): Promise<string> {
    const key = await importPKCS8(config.apple.signInKeyP8, 'ES256');
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: config.apple.signInKeyId })
      .setIssuer(config.apple.signInTeamId)
      .setSubject(config.apple.signInClientId)
      .setAudience('https://appleid.apple.com')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
  }

  /** Exchange an authorization code for a refresh token (stored to revoke on deletion).
   *  Returns null when unconfigured or on any failure - never throws. */
  async appleExchangeCode(code: string): Promise<string | null> {
    if (!this.appleRevokeConfigured() || !code) return null;
    try {
      const secret = await this.appleClientSecret();
      const res = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.apple.signInClientId,
          client_secret: secret,
          grant_type: 'authorization_code',
          code,
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { refresh_token?: string };
      return json.refresh_token ?? null;
    } catch {
      return null;
    }
  }

  /** Revoke the user's Apple tokens (best-effort; required on account deletion). */
  async appleRevoke(refreshToken: string): Promise<void> {
    if (!this.appleRevokeConfigured() || !refreshToken) return;
    try {
      const secret = await this.appleClientSecret();
      await fetch('https://appleid.apple.com/auth/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.apple.signInClientId,
          client_secret: secret,
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }),
      });
    } catch {
      /* best-effort - never block deletion on a revoke failure */
    }
  }
}
