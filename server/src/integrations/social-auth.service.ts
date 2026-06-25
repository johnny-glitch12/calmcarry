import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
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
 * attacker-controllable (account takeover) — so this is the real gate, not a decode.
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
}
