import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { Owner } from '../entities';
import { SocialAuthService, SocialProvider } from '../integrations/social-auth.service';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './jwt-auth.guard';

export interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly social: SocialAuthService,
  ) {}

  /** Sign in with Apple / Google — verifies the identity token, then finds or creates the household. */
  async socialLogin(provider: SocialProvider, idToken: string): Promise<AuthResult> {
    const id = await this.social.verify(provider, idToken);
    let owner = await this.usersService.findByEmail(id.email);
    if (!owner) {
      const passwordHash = await bcrypt.hash(randomUUID(), 12); // no password — social only
      owner = await this.usersService.createOwner(id.email, passwordHash, id.name);
      await this.usersService.grantEntitlement(owner.id, 'free');
    } else if (!id.emailVerified) {
      // An account with this email already exists. Logging into it from a social
      // token whose email is UNVERIFIED would let an attacker hijack that account
      // by claiming its address. Require a provider-verified email to merge.
      throw new UnauthorizedException('Email not verified by the provider');
    }
    return this.buildAuthResult(owner);
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

    return this.buildAuthResult(owner);
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

    return {
      token,
      user: { id: owner.id, email: owner.email, name: owner.name },
    };
  }
}
