import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { config } from '../config';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  /** Session generation. Must match owners.tokenVersion or the token is dead.
   *  Optional so tokens issued before this shipped keep working until their owner
   *  next changes a password (no forced sign-out on deploy). */
  tv?: number;
}

/**
 * Validates the `Authorization: Bearer <token>` header and attaches the
 * decoded payload to `request.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: config.jwtSecret,
        algorithms: ['HS256'], // pin algorithm - reject alg:none / confusion attacks
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // A valid SIGNATURE is not the same as a live SESSION. Confirm the account still
    // exists and that this token belongs to the current session generation, so a
    // password change/reset (which bumps tokenVersion) immediately kills tokens
    // already in an attacker's hands instead of leaving them usable for up to 7 days.
    // Tokens minted before `tv` existed carry undefined and are accepted until their
    // owner next changes a password, so shipping this does not sign everyone out.
    const owner = await this.users.findById(payload.sub);
    if (!owner) throw new UnauthorizedException('Account no longer exists');
    if (payload.tv !== undefined && payload.tv !== owner.tokenVersion) {
      throw new UnauthorizedException('Session ended - please sign in again');
    }

    (request as Request & { user: JwtPayload }).user = payload;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
