import { CommunityService } from './community.service';
import type { CommunityPost } from '../entities';

// Report behaviour (App Store UGC 1.2): reports quietly re-hold and then reject a
// post, the endpoint never reveals whether a post exists, and - critically - a
// threshold means N DISTINCT members objected. Before per-reporter dedupe, one
// account could report every post four times and empty the whole wall.

function makeService(seed: Partial<CommunityPost>[]) {
  const rows = seed.map(
    (p, i) =>
      ({
        id: `post-${i + 1}`,
        ownerId: 'author',
        handle: 'A CalmCarry parent',
        text: 'First calm night in a while.',
        status: 'approved',
        mix: null,
        reportsCount: 0,
        createdAt: new Date('2026-01-01'),
        ...p,
      }) as CommunityPost,
  );
  const repo = {
    findOne: async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null,
    save: async (p: CommunityPost) => p,
  };

  // Stands in for the unique (postId, ownerId) index: a duplicate insert throws.
  const reportRows: { postId: string; ownerId: string }[] = [];
  const reports = {
    insert: async (r: { postId: string; ownerId: string }) => {
      if (reportRows.some((x) => x.postId === r.postId && x.ownerId === r.ownerId)) {
        throw new Error('duplicate key value violates unique constraint "uq_community_report"');
      }
      reportRows.push(r);
      return { identifiers: [] };
    },
    count: async ({ where }: { where: { postId: string } }) =>
      reportRows.filter((x) => x.postId === where.postId).length,
  };

  return { svc: new CommunityService(repo as never, reports as never), rows, reportRows };
}

describe('CommunityService.report', () => {
  it('one reporter keeps the post live; a SECOND distinct reporter re-holds it', async () => {
    const { svc, rows } = makeService([{}]);
    await expect(svc.report('post-1', 'member-1')).resolves.toEqual({ ok: true });
    expect(rows[0].status).toBe('approved');
    await svc.report('post-1', 'member-2');
    expect(rows[0].reportsCount).toBe(2);
    expect(rows[0].status).toBe('pending');
  });

  it('four distinct reporters reject the post outright', async () => {
    const { svc, rows } = makeService([{}]);
    for (const m of ['m1', 'm2', 'm3', 'm4']) await svc.report('post-1', m);
    expect(rows[0].reportsCount).toBe(4);
    expect(rows[0].status).toBe('rejected');
  });

  it('THE WIPE ATTACK: one account reporting repeatedly counts once and cannot remove a post', async () => {
    const { svc, rows, reportRows } = makeService([{}]);
    for (let i = 0; i < 25; i++) {
      await expect(svc.report('post-1', 'attacker')).resolves.toEqual({ ok: true });
    }
    expect(reportRows).toHaveLength(1); // deduped by (postId, ownerId)
    expect(rows[0].reportsCount).toBe(1); // their first report counts, the other 24 do not
    expect(rows[0].status).toBe('approved'); // one member is not a threshold - still visible
  });

  it('a member cannot report their own post into moderation', async () => {
    const { svc, rows, reportRows } = makeService([{ ownerId: 'author' }]);
    await expect(svc.report('post-1', 'author')).resolves.toEqual({ ok: true });
    expect(reportRows).toHaveLength(0);
    expect(rows[0].status).toBe('approved');
  });

  it('reporting an unknown post still resolves ok (nothing to reveal)', async () => {
    const { svc } = makeService([]);
    await expect(svc.report('no-such-post', 'member-1')).resolves.toEqual({ ok: true });
  });
});
