import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AnalyticsEvent, SessionLog } from '../entities';

// Data-retention limit (build plan §13; amended COPPA prohibits indefinite retention;
// UK Children's Code + AU APP 11.2 require destruction when no longer needed). We keep
// session logs + anonymous analytics for ~13 months, then purge.
const RETENTION_DAYS = 400;
const DAY_MS = 86_400_000;

@Injectable()
export class RetentionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Retention');
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(SessionLog) private readonly logs: Repository<SessionLog>,
    @InjectRepository(AnalyticsEvent) private readonly events: Repository<AnalyticsEvent>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.purge();
    // run once a day; unref so the timer never holds the process open
    this.timer = setInterval(() => void this.purge(), DAY_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Delete session logs + anonymous analytics older than the retention window.
   *  Returns the number of records purged (for cron/endpoint observability). */
  async purge(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS);
    try {
      const a = await this.logs.delete({ startedAt: LessThan(cutoff) });
      const b = await this.events.delete({ createdAt: LessThan(cutoff) });
      const n = (a.affected ?? 0) + (b.affected ?? 0);
      if (n) this.logger.log(`Purged ${n} record(s) older than ${RETENTION_DAYS}d (retention limit).`);
      return n;
    } catch (e) {
      this.logger.warn(`Retention purge skipped: ${String(e)}`);
      return 0;
    }
  }
}
