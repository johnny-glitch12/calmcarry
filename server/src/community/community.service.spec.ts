import { CommunityService } from './community.service';
import type { CommunityPost } from '../entities';

// Report-threshold behaviour (App Store UGC 1.2): reports quietly re-hold and
// then reject a post — and the endpoint never reveals whether a post exists.

function makeService(seed: Partial<CommunityPost>[]) {
  const rows = seed.map(
    (p, i) =>
      ({
        id: `post-${i + 1}`,
        ownerId: 'o1',
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
  return { svc: new CommunityService(repo as never), rows };
}

describe('CommunityService.report', () => {
  it('one report keeps the post live; the second re-holds it for review', async () => {
    const { svc, rows } = makeService([{}]);
    await expect(svc.report('post-1')).resolves.toEqual({ ok: true });
    expect(rows[0].status).toBe('approved');
    await svc.report('post-1');
    expect(rows[0].reportsCount).toBe(2);
    expect(rows[0].status).toBe('pending');
  });

  it('four reports reject the post outright', async () => {
    const { svc, rows } = makeService([{ reportsCount: 3, status: 'pending' }]);
    await svc.report('post-1');
    expect(rows[0].status).toBe('rejected');
  });

  it('reporting an unknown post still resolves ok (nothing to reveal)', async () => {
    const { svc } = makeService([]);
    await expect(svc.report('no-such-post')).resolves.toEqual({ ok: true });
  });
});
