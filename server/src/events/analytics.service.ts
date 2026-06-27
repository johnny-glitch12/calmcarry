import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from '../entities';

// Keep the anonymous analytics blob small so it can't be used for storage-exhaustion writes.
export const MAX_PROPS_BYTES = 2048;

function safeProps(props?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!props) return null;
  return JSON.stringify(props).length <= MAX_PROPS_BYTES ? props : null;
}

/**
 * First-party analytics store (build plan §15). Anonymous, no PII. Writes are
 * fire-and-forget from callers; the funnel readout is admin-only.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent) private readonly repo: Repository<AnalyticsEvent>,
  ) {}

  /** Persist a single event. */
  async record(
    name: string,
    anonId: string | null,
    props?: Record<string, unknown> | null,
  ): Promise<void> {
    await this.repo.save(
      this.repo.create({ name: name.slice(0, 60), anonId: anonId ?? null, props: safeProps(props) }),
    );
  }

  /** Bulk-insert a client batch; returns how many rows were accepted. */
  async recordBatch(
    anonId: string | null,
    events: { name: string; props?: Record<string, unknown> }[],
  ): Promise<number> {
    const rows = (events ?? [])
      .filter((e) => e && typeof e.name === 'string')
      .map((e) =>
        this.repo.create({ name: e.name.slice(0, 60), anonId: anonId ?? null, props: safeProps(e.props) }),
      );
    if (rows.length) await this.repo.save(rows);
    return rows.length;
  }

  private static readonly STAGES = [
    'app_open',
    'sign_up',
    'sign_in',
    'check_in_shown',
    'session_start',
    'session_complete',
    'paywall_view',
    'subscribe_success',
    'subscription_cancelled',
  ];

  /** Per-window funnel: stage counts + completion rate + paywall conversion for
   *  all-time / last-30d / last-7d (§15). Uses createdAt range filters so it's
   *  portable across SQLite (dev) and Postgres (prod). */
  async funnel(): Promise<Record<string, unknown>> {
    const windows: { key: string; sinceMs: number | null }[] = [
      { key: 'allTime', sinceMs: null },
      { key: 'last30d', sinceMs: 30 * 86_400_000 },
      { key: 'last7d', sinceMs: 7 * 86_400_000 },
    ];
    const out: Record<string, unknown> = {};
    for (const w of windows) {
      const qb = this.repo
        .createQueryBuilder('e')
        .select('e.name', 'name')
        .addSelect('COUNT(*)', 'count')
        .groupBy('e.name');
      if (w.sinceMs) qb.where('e.createdAt >= :since', { since: new Date(Date.now() - w.sinceMs) });
      const rows = await qb.getRawMany<{ name: string; count: string }>();
      const counts: Record<string, number> = {};
      for (const s of AnalyticsService.STAGES) counts[s] = 0;
      for (const r of rows) counts[r.name] = Number(r.count);
      const starts = counts['session_start'] || 0;
      const completes = counts['session_complete'] || 0;
      const paywallViews = counts['paywall_view'] || 0;
      const subscribes = counts['subscribe_success'] || 0;
      out[w.key] = {
        ...counts,
        completionRate: starts ? Math.round((completes / starts) * 100) / 100 : 0,
        paywallConversion: paywallViews ? Math.round((subscribes / paywallViews) * 100) / 100 : 0,
      };
    }
    return out;
  }
}
