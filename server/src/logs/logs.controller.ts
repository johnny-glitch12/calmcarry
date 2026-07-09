import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';
import { CreateLogDto } from './dto/create-log.dto';
import { LogsService } from './logs.service';

// Session logs are write-only from the app: it POSTs a "played this" record for
// §15 activation analytics. No GET — a log-history/sleep-tracking screen was cut
// (task #39), so nothing consumed it; stored logs are read only via the admin
// funnel aggregate and the retention purge.
@UseGuards(JwtAuthGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLogDto) {
    return this.logsService.create(user.sub, dto.contentId ?? null, dto.deviceId ?? null);
  }
}
