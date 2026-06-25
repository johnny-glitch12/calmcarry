import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';
import { CreateLogDto } from './dto/create-log.dto';
import { LogsService } from './logs.service';

@UseGuards(JwtAuthGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLogDto) {
    return this.logsService.create(user.sub, dto.contentId ?? null, dto.deviceId ?? null);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.logsService.listForOwner(user.sub);
  }
}
