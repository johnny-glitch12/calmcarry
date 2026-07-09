import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';
import { PushPlatform } from '../entities';
import { NotificationsService } from './notifications.service';

class RegisterTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @IsIn(['ios', 'android', 'web'])
  platform: PushPlatform;
}

class UnregisterTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('register')
  register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterTokenDto) {
    return this.notifications.register(user.sub, dto.token, dto.platform);
  }

  // Opt-OUT parity: the toggle-off must reach the server, or the token stays
  // enabled and the user keeps receiving pushes they turned off.
  @Post('unregister')
  unregister(@CurrentUser() user: JwtPayload, @Body() dto: UnregisterTokenDto) {
    return this.notifications.unregister(user.sub, dto.token);
  }

  @Post('test')
  test(@CurrentUser() user: JwtPayload) {
    return this.notifications.sendTest(user.sub);
  }
}
