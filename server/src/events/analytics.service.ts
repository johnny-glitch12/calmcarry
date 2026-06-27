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

  /** Aggregate funnel counts per event name + the session completion rate (§15). */
  async funnel(): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.name', 'name')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.name')
      .getRawMany<{ name: string; count: string }>();
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.name] = Number(r.count);
    const starts = counts['session_start'] ?? 0;
    const completes = counts['session_complete'] ?? 0;
    return {
      ...counts,
      completionRate: starts ? Math.round((completes / starts) * 100) / 100 : 0,
    };
  }
}
