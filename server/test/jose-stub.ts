// Jest stand-in for 'jose' (ESM-only, which ts-jest's CJS transform can't load).
// Specs never verify real tokens through it — services that do (social auth, APNs)
// are stubbed or credential-gated in tests — so no-op shapes are enough.
export const createRemoteJWKSet = () => () => {
  throw new Error('jose stub: not available in unit tests');
};
export const jwtVerify = async () => {
  throw new Error('jose stub: not available in unit tests');
};
export const importPKCS8 = async () => {
  throw new Error('jose stub: not available in unit tests');
};
export class SignJWT {
  setProtectedHeader() {
    return this;
  }
  setIssuer() {
    return this;
  }
  setIssuedAt() {
    return this;
  }
  setSubject() {
    return this;
  }
  setAudience() {
    return this;
  }
  setExpirationTime() {
    return this;
  }
  async sign(): Promise<string> {
    throw new Error('jose stub: not available in unit tests');
  }
}
export type JWTPayload = Record<string, unknown>;
