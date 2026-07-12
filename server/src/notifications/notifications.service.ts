import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushToken, PushPlatform } from '../entities';
import { PushService } from '../integrations/push.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(PushToken) private readonly repo: Repository<PushToken>,
    private readonly push: PushService,
  ) {}

  async register(ownerId: string, token: string, platform: PushPlatform): Promise<{ ok: true }> {
    const existing = await this.repo.findOne({ where: { token } });
    if (existing) {
      existing.ownerId = ownerId;
      existing.platform = platform;
      existing.enabled = true;
      await this.repo.save(existing);
    } else {
      await this.repo.save(this.repo.create({ ownerId, token, platform, enabled: true }));
    }
    return { ok: true };
  }

  /** Opt-out: disable this device's token so no remote push ever targets it again.
   *  Idempotent, and scoped to the caller's own account (can't disable others'). */
  async unregister(ownerId: string, token: string): Promise<{ ok: true }> {
    await this.repo.update({ ownerId, token }, { enabled: false });
    return { ok: true };
  }

  async sendTest(ownerId: string): Promise<{ sent: number; tokens: number }> {
    const tokens = await this.repo.find({ where: { ownerId, enabled: true } });
    const results = await Promise.all(
      tokens.map((t) =>
        this.push.send(t.token, t.platform, { title: 'CalmCarry', body: 'A gentle nudge. Time to wind down.' }),
      ),
    );
    return { sent: results.filter((r) => r.sent).length, tokens: tokens.length };
  }
}
