// In-memory AsyncStorage so lib tests exercise real persistence logic.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
