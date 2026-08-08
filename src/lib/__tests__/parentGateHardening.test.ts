import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The parent gate is the only thing standing between a child and leaving Kids Mode,
 * buying a subscription, or deleting the account. A security review found four ways
 * through it, and every one looked fine in review because the code READ correctly -
 * the defects were in what the OS does by default, and in treating two different
 * credentials as equivalent.
 *
 * These are source-level invariants because the behaviours live in native modules
 * (LocalAuthentication) and in a screen that needs a full router+provider tree to
 * mount. A source assertion that pins the exact clause is worth more here than a
 * behavioural test that mocks the very thing being asserted.
 */
const src = (p: string) =>
  readFileSync(join(__dirname, '..', '..', p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('parent gate hardening', () => {
  it('biometrics never fall back to the DEVICE PASSCODE', () => {
    // Without this, iOS uses LAPolicyDeviceOwnerAuthentication and offers the phone's
    // unlock code when a face fails - so the gate was satisfied by a code any child
    // who has watched it being typed already knows.
    const lib = src('lib/parentGate.ts');
    expect(lib).toMatch(/disableDeviceFallback:\s*true/);
    // and no OS fallback button either - our own keypad is the fallback
    expect(lib).toMatch(/fallbackLabel:\s*''/);
  });

  it('leaving Kids Mode is high-consequence, so no biometric can satisfy it', () => {
    // a face prompt cannot tell a parent from a child on a shared device, and exiting
    // Kids Mode is precisely what the child wants
    const gate = src('features/parentgate/ParentGate.tsx');
    // the declaration may wrap across lines, so read from the keyword to the semicolon
    const start = gate.indexOf('const highConsequence');
    expect(start).toBeGreaterThan(-1);
    const decl = gate.slice(start, gate.indexOf(';', start));
    expect(decl).toContain("'exitKids'");
    expect(decl).toContain("'purchase'");
    expect(decl).toContain("'deleteAccount'");
  });

  it('biometrics are never fired automatically on mount', () => {
    // an auto-prompt points the camera at whoever is holding the phone
    const gate = src('features/parentgate/ParentGate.tsx');
    expect(gate).not.toMatch(/useEffect\([\s\S]{0,400}?tryBiometric\(\)/);
  });

  it('a NEWLY CREATED pin cannot release Kids Mode', () => {
    // choosing a fresh secret proves nothing about who you are; the old code released
    // on either an entered or a created PIN
    const gate = src('features/parentgate/ParentGate.tsx');
    const i = gate.indexOf("if (intent === 'exitKids')");
    expect(i).toBeGreaterThan(-1);
    const branch = gate.slice(i, i + 700);
    expect(branch).toMatch(/credentialRef\.current === 'created'/);
    // and it must bail rather than fall through to setMode('adult')
    expect(branch.indexOf("credentialRef.current === 'created'")).toBeLessThan(branch.indexOf("setMode('adult')"));
  });

  it('verifying an existing pin marks the credential as entered', () => {
    // POSITIVE CONTROL: if this never happens, no parent could ever leave Kids Mode
    // and the assertions above would be passing for the wrong reason.
    const gate = src('features/parentgate/ParentGate.tsx');
    const i = gate.indexOf('await checkParentPin(pin)');
    expect(i).toBeGreaterThan(-1);
    expect(gate.slice(i, i + 300)).toMatch(/credentialRef\.current = 'entered'/);
  });

  it('account-password recovery also counts as entered', () => {
    // otherwise a parent who genuinely forgot their PIN could never get out
    const gate = src('features/parentgate/ParentGate.tsx');
    const i = gate.indexOf('await api.login(user.email, recoverPassword)');
    expect(i).toBeGreaterThan(-1);
    expect(gate.slice(i, i + 400)).toMatch(/credentialRef\.current = 'entered'/);
  });
});
