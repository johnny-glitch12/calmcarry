import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';
import { CaregiversService } from './caregivers.service';

class RedeemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;
}

@Controller('caregivers')
@UseGuards(JwtAuthGuard)
export class CaregiversController {
  constructor(private readonly caregivers: CaregiversService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.caregivers.list(user.sub);
  }

  @Post('invite')
  invite(@CurrentUser() user: JwtPayload) {
    return this.caregivers.createInvite(user.sub);
  }

  @Post('redeem')
  redeem(@CurrentUser() user: JwtPayload, @Body() dto: RedeemDto) {
    return this.caregivers.redeem(user.sub, dto.code);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.caregivers.remove(user.sub, id);
  }
}
