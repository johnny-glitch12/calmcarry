import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Owner } from '../entities';

// Behavioural test of the whole account-security surface (register/login/reset/
// verify/refresh/logout) against in-memory fakes - no DB, no DI container. The
// mail fake captures outbound codes so the tests exercise the REAL emailed-code
// path (bcrypt-hashed, TTL'd, attempt-limited) instead of peeking at internals.

type Row = Record<string, unknown> & { id?: string };

function memRepo() {
  const rows: Row[] = [];
  let seq = 0;
  const matches = (row: Row, criteria: Record<string, unknown>) =>
    Object.entries(criteria).every(([k, v]) => row[k] === v);
  return {
    rows,
    create: (o: Row) => ({ ...o }),
    save: async (o: Row) => {
      if (!o.id) {
        o.id = `row-${++seq}`;
        rows.push(o);
      } else if (!rows.includes(o)) {
        const i = rows.findIndex((r) => r.id === o.id);
        if (i >= 0) rows[i] = o;
        else rows.push(o);
      }
      return o;
    },
    findOne: async ({ where }: { where: Record<string, unknown> }) =>
      rows.find((r) => matches(r, where)) ?? null,
    delete: async (criteria: Record<string, unknown>) => {
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], criteria)) rows.splice(i, 1);
    },
    update: async (criteria: Record<string, unknown>, patch: Record<string, unknown>) => {
      for (const r of rows) if (matches(r, criteria)) Object.assign(r, patch);
    },
  };
}

function makeFixture() {
  const owners = new Map<string, Owner>();
  let ownerSeq = 0;
  const users = {
    findByEmail: async (email: string) =>
      [...owners.values()].find((o) => o.email === email.toLowerCase()) ?? null,
    findById: async (id: string) => owners.get(id) ?? null,
    createOwner: async (email: string, passwordHash: string, name: string) => {
      const owner = {
        id: `owner-${++ownerSeq}`,
        email: email.toLowerCase(),
        name,
        passwordHash,
        emailVerified: false,
      } as Owner;
      owners.set(owner.id, owner);
      return owner;
    },
    grantEntitlement: async () => undefined,
    setPassword: async (id: string, passwordHash: string) => {
      const o = owners.get(id);
      if (o) o.passwordHash = passwordHash;
    },
    setEmailVerified: async (id: string) => {
      const o = owners.get(id);
      if (o) o.emailVerified = true;
    },
  };
  const sent: { to: string; subject: string; text: string }[] = [];
  const mail = { send: async (m: { to: string; subject: string; text: string }) => (sent.push(m), { sent: true }) };
  const jwt = { signAsync: async () => 'signed.jwt.token' };
  const codes = memRepo();
  const refreshTokens = memRepo();
  const svc = new AuthService(
    users as never,
    jwt as never,
    null as never, // social - not exercised here
    mail as never,
    codes as never,
    refreshTokens as never,
  );
  // the code is only ever visible in the email body - read it back like a user would
  const lastCode = () => /Your code is: (\d{6})/.exec(sent[sent.length - 1]?.text ?? '')?.[1] ?? '';
  // register's verify mail is fire-and-forget (bcrypt hashes the code across
  // macrotasks), so wait for it rather than flushing a single tick
  const waitForMail = async (count = 1) => {
    for (let i = 0; i < 400 && sent.length < count; i++) await new Promise((r) => setTimeout(r, 5));
  };
  return { svc, owners, sent, lastCode, waitForMail, codes, refreshTokens };
}

describe('AuthService account security', () => {
  it('register issues a session + refresh token and emails a verification code', async () => {
    const { svc, sent, lastCode, waitForMail } = makeFixture();
    const r = await svc.register('mum@example.com', 'sleepy-nights-8', 'Ada');
    expect(r.token).toBe('signed.jwt.token');
    expect(r.refreshToken).toHaveLength(64); // 32 random bytes, hex
    expect(r.user.email).toBe('mum@example.com');
    await waitForMail();
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('Verify');
    expect(lastCode()).toMatch(/^\d{6}$/);
    await expect(svc.register('mum@example.com', 'other-pass-123', 'Ada')).rejects.toThrow(ConflictException);
  });

  it('login accepts the right password and rejects the wrong one (same error as unknown email)', async () => {
    const { svc } = makeFixture();
    await svc.register('mum@example.com', 'sleepy-nights-8', 'Ada');
    const r = await svc.login('mum@example.com', 'sleepy-nights-8');
    expect(r.user.name).toBe('Ada');
    await expect(svc.login('mum@example.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    await expect(svc.login('nobody@example.com', 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('password reset: emailed code sets the new password and revokes every old session', async () => {
    const { svc, lastCode, waitForMail } = makeFixture();
    const first = await svc.register('mum@example.com', 'old-password-1', 'Ada');
    await waitForMail(1); // let the async verify mail land first, so lastCode() below is the RESET code

    await svc.requestPasswordReset('mum@example.com');
    await waitForMail(2);
    const code = lastCode();
    await expect(svc.resetPassword('mum@example.com', '000000', 'new-password-1')).rejects.toThrow(
      UnauthorizedException,
    );
    const reset = await svc.resetPassword('mum@example.com', code, 'new-password-1');
    expect(reset.token).toBeTruthy();

    await expect(svc.login('mum@example.com', 'old-password-1')).rejects.toThrow(UnauthorizedException);
    await expect(svc.login('mum@example.com', 'new-password-1')).resolves.toBeTruthy();
    // a reset must end existing sessions - the pre-reset refresh token is dead
    await expect(svc.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException);
    // and the code was consumed - it cannot be replayed
    await expect(svc.resetPassword('mum@example.com', code, 'again-password-1')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('reset request for an unknown email resolves ok and sends nothing (no enumeration)', async () => {
    const { svc, sent } = makeFixture();
    await expect(svc.requestPasswordReset('ghost@example.com')).resolves.toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it('a code stops working after 5 wrong attempts, even if the 6th guess is right', async () => {
    const { svc, lastCode, waitForMail } = makeFixture();
    await svc.register('mum@example.com', 'sleepy-nights-8', 'Ada');
    await waitForMail(1);
    await svc.requestPasswordReset('mum@example.com');
    await waitForMail(2);
    const code = lastCode();
    for (let i = 0; i < 5; i++) {
      await expect(svc.resetPassword('mum@example.com', '999999', 'brute-force-1')).rejects.toThrow(
        UnauthorizedException,
      );
    }
    await expect(svc.resetPassword('mum@example.com', code, 'brute-force-1')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('email verification: the emailed code flips emailVerified', async () => {
    const { svc, owners, lastCode, waitForMail } = makeFixture();
    const r = await svc.register('mum@example.com', 'sleepy-nights-8', 'Ada');
    await waitForMail();
    const ownerId = [...owners.keys()][0];
    expect(owners.get(ownerId)?.emailVerified).toBe(false);
    await svc.verifyEmail(ownerId, lastCode());
    expect(owners.get(ownerId)?.emailVerified).toBe(true);
    expect(r.user.id).toBe(ownerId);
  });

  it('refresh rotates: the new token works once, the old one is rejected on replay', async () => {
    const { svc } = makeFixture();
    const first = await svc.register('mum@example.com', 'sleepy-nights-8', 'Ada');
    const second = await svc.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    // replaying the rotated (revoked) token must fail - stolen-token detection
    await expect(svc.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException);
    await expect(svc.refresh(second.refreshToken)).resolves.toBeTruthy();
    await expect(svc.refresh('a'.repeat(64))).rejects.toThrow(UnauthorizedException);
  });

  it('change-password verifies the current password and ends every other session', async () => {
    const { svc, owners } = makeFixture();
    const first = await svc.register('mum@example.com', 'old-password-1', 'Ada');
    const ownerId = [...owners.keys()][0];
    await expect(svc.changePassword(ownerId, 'wrong-guess', 'new-password-1')).rejects.toThrow(
      UnauthorizedException,
    );
    const changed = await svc.changePassword(ownerId, 'old-password-1', 'new-password-1');
    expect(changed.refreshToken).toHaveLength(64);
    await expect(svc.login('mum@example.com', 'new-password-1')).resolves.toBeTruthy();
    await expect(svc.login('mum@example.com', 'old-password-1')).rejects.toThrow(UnauthorizedException);
    // the pre-change session is dead; the fresh pair from the change works
    await expect(svc.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException);
    await expect(svc.refresh(changed.refreshToken)).resolves.toBeTruthy();
  });

  it('logout revokes the refresh token and stays idempotent', async () => {
    const { svc } = makeFixture();
    const r = await svc.register('mum@example.com', 'sleepy-nights-8', 'Ada');
    await expect(svc.logout(r.refreshToken)).resolves.toEqual({ ok: true });
    await expect(svc.refresh(r.refreshToken)).rejects.toThrow(UnauthorizedException);
    await expect(svc.logout(r.refreshToken)).resolves.toEqual({ ok: true });
  });
});
