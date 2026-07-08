import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ForgotPasswordDto, RefreshDto, ResetPasswordDto, VerifyEmailDto } from './dto/account-security.dto';
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

  // Password reset: request an emailed 6-digit code (always 200 — no account
  // enumeration), then trade code + new password for a fresh session.
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('auth/password/forgot')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Throttle(CREDENTIAL_THROTTLE)
  @Post('auth/password/reset')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  // Rotating refresh: trade a live refresh token for a fresh access+refresh pair.
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('auth/refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // Server-side logout — revokes the refresh token (idempotent).
  @Post('auth/logout')
  @HttpCode(200)
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // Email verification (soft gate) — send / confirm the 6-digit code.
  @UseGuards(JwtAuthGuard)
  @Post('auth/email/send-verification')
  @HttpCode(200)
  sendVerification(@CurrentUser() user: JwtPayload) {
    return this.authService.sendEmailVerification(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('auth/email/verify')
  @HttpCode(200)
  verifyEmail(@CurrentUser() user: JwtPayload, @Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(user.sub, dto.code);
  }

  // Sign in with Apple / Google (one-tap, no password)
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('auth/social')
  social(@Body() dto: SocialLoginDto) {
    return this.authService.socialLogin(dto.provider, dto.idToken, dto.authorizationCode);
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
      user: { id: owner.id, email: owner.email, name: owner.name, emailVerified: owner.emailVerified },
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
    await this.authService.deleteAccount(user.sub);
    return { ok: true, deleted: true };
  }

  // Data-access export (GDPR Art.15 / UK-GDPR / AU APP 12) — the caller's own data.
  @UseGuards(JwtAuthGuard)
  @Get('me/export')
  exportMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.exportAccount(user.sub);
  }

  // Cross-device preference sync (allow-listed keys; mood/feeling is never accepted).
  @UseGuards(JwtAuthGuard)
  @Get('me/prefs')
  getPrefs(@CurrentUser() user: JwtPayload) {
    return this.usersService.getPrefs(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/prefs')
  async putPrefs(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.usersService.setPrefs(user.sub, body ?? {});
  }
}
