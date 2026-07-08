module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // jose is ESM-only; unit tests never verify real tokens through it
    '^jose$': '<rootDir>/test/jose-stub.ts',
  },
};
