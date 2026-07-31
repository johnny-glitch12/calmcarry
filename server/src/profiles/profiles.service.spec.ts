import { NotFoundException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

/**
 * profiles.id is a uuid column, but the app used to mint ids locally as
 * `p-adult-<timestamp>` and send that shape to PATCH/DELETE /profiles/:id. Postgres
 * rejects a non-uuid with a type error, so renaming or removing a profile returned a
 * logged 500 (and a Sentry report) and silently did nothing - while dev SQLite
 * accepted any string and hid the bug completely.
 *
 * The client now adopts the server's uuid, and the service refuses to take a
 * malformed id to the database at all: it cannot match a real row either way, so
 * "not found" is both correct and safe.
 */
describe('ProfilesService id validation', () => {
  const makeService = () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const repo = { findOne, save: jest.fn(), remove: jest.fn(), create: jest.fn(), find: jest.fn() };
    const ownerRepo = { findOne: jest.fn(), save: jest.fn() };
    const household = { resolveOwnerId: jest.fn().mockResolvedValue('owner-1') };
    const svc = new ProfilesService(repo as never, ownerRepo as never, household as never);
    return { svc, findOne, household };
  };

  const BAD_IDS = ['p-adult-1785123456789', 'p-kids-1785123456789', '', 'not-a-uuid', '123', "'; DROP TABLE profiles;--"];

  it.each(BAD_IDS)('update(%p) is NotFound and never reaches the database', async (bad) => {
    const { svc, findOne, household } = makeService();
    await expect(svc.update('owner-1', bad, { name: 'Ada' })).rejects.toThrow(NotFoundException);
    expect(findOne).not.toHaveBeenCalled();
    // it must bail BEFORE any work, including the household lookup
    expect(household.resolveOwnerId).not.toHaveBeenCalled();
  });

  it.each(BAD_IDS)('remove(%p) is NotFound and never reaches the database', async (bad) => {
    const { svc, findOne } = makeService();
    await expect(svc.remove('owner-1', bad)).rejects.toThrow(NotFoundException);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('a well-formed uuid IS taken to the database (proves the guard is not blocking everything)', async () => {
    const { svc, findOne } = makeService();
    const good = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    // findOne resolves null, so this still ends in NotFound - but from the LOOKUP,
    // not from the guard, which is the distinction that matters.
    await expect(svc.update('owner-1', good, { name: 'Ada' })).rejects.toThrow(NotFoundException);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({ where: { id: good, ownerId: 'owner-1' } });
  });
});
