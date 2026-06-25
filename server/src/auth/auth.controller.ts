import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { JwtAuthGuard, JwtPayload } from './jwt-auth.guard';

// Tight per-IP limit on credential endpoints — blunts brute force / credential
// stuffing (10 attempts/minute) on top of the global 120/min limit.
const CREDENTIAL_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Throttle(CREDENTIAL_THROTTLE)
  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Throttle(CREDENTIAL_THROTTLE)
  @Post('auth/register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  // Sign in with Apple / Google (one-tap, no password)
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('auth/social')
  social(@Body() dto: SocialLoginDto) {
    return this.authService.socialLogin(dto.provider, dto.idToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const owner = await this.usersService.findById(user.sub);
    if (!owner) {
      throw new NotFoundException('User not found');
    }

    const entitlement = await this.usersService.getEffectiveEntitlement(
      owner.id,
    );
    // Report tier through the SAME expiry-aware gate the paywall uses, so a lapsed
    // (active-but-expired) calm_plan reads as 'free' — never as live premium.
    const isPremium = this.usersService.isPremiumEntitlement(entitlement);

    return {
      user: { id: owner.id, email: owner.email, name: owner.name },
      entitlement: isPremium
        ? { tier: 'calm_plan', status: 'active' }
        : { tier: 'free', status: 'active' },
    };
  }

  // Permanent account + data deletion (Apple 5.1.1(v); COPPA/GDPR). Irreversible.
  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(200)
  async deleteMe(@CurrentUser() user: JwtPayload) {
    await this.usersService.deleteAccount(user.sub);
    return { ok: true, deleted: true };
  }
}
