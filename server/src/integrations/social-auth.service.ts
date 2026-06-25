import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

export type SocialProvider = 'apple' | 'google';
export interface SocialIdentity {
  email: string;
  name: string;
  sub: string;
  emailVerified: boolean;
  provider: SocialProvider;
}

/**
 * Flip to true ONLY once verify() cryptographically validates the identity token
 * against the provider's JWKS and checks aud/iss/exp/nonce. Until then we cannot
 * trust the token, so production fails closed (no unverified-token logins ever).
 */
const SIGNATURE_VERIFICATION_IMPLEMENTED = false;

/**
 * Resolves a Sign in with Apple / Google identity token to {email, name, sub}.
 *
 * CRITICAL: a social identity token is only trustworthy AFTER its signature is
 * verified against the provider's JWKS (and aud === your client id). That is NOT
 * implemented yet — merely having a client-id env var does NOT mean the token was
 * verified. So this service decodes the token for DEV ONLY and REFUSES in prod.
 *
 * PLACEHOLDER: implement JWKS verification (e.g. `jose` / google-auth-library),
 * then set SIGNATURE_VERIFICATION_IMPLEMENTED = true.
 */
@Injectable()
export class SocialAuthService {
  async verify(provider: SocialProvider, idToken: string): Promise<SocialIdentity> {
    if (!SIGNATURE_VERIFICATION_IMPLEMENTED) {
      // The token's signature is NOT verified, so its email/sub claims are
      // unauthenticated — trusting them would be account takeover. FAIL CLOSED in
      // EVERY environment (not just prod): a missing/unset NODE_ENV must never open
      // this. Social sign-in stays unavailable until JWKS verification ships below.
      throw new ServiceUnavailableException(
        'Social sign-in is unavailable (token signature verification not configured).',
      );
    }

    // --- reached only once SIGNATURE_VERIFICATION_IMPLEMENTED is true ---
    const payload = this.decode(idToken);
    if (!payload?.sub) throw new BadRequestException('Malformed identity token');
    const emailVerified =
      payload.email_verified === true || payload.email_verified === 'true';
    const email = payload.email ?? `${provider}-${payload.sub}@users.calmcarry`;
    const name = payload.name ?? (payload.email ? String(payload.email).split('@')[0] : 'Sleeper');
    return { email, name, sub: String(payload.sub), emailVerified, provider };
  }

  private decode(jwt: string): any {
    try {
      const part = jwt.split('.')[1];
      return JSON.parse(Buffer.from(part, 'base64').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid identity token');
    }
  }
}
