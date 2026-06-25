import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';
import { DevicesService } from './devices.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';

@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.devicesService.listForOwner(user.sub);
  }

  @Post()
  register(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devicesService.registerDevice(user.sub, dto.serial);
  }

  @Post(':id/claims')
  createClaim(
    @CurrentUser() user: JwtPayload,
    @Param('id') deviceId: string,
    @Body() dto: CreateClaimDto,
  ) {
    return this.devicesService.createClaim(
      user.sub,
      deviceId,
      dto.type,
      dto.description ?? null,
    );
  }
}
