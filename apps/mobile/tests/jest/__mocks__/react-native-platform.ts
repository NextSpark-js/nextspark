/**
 * Helper to change Platform.OS for testing
 * Usage:
 *   import { setPlatformOS } from './__mocks__/react-native-platform';
 *   setPlatformOS('web');
 */

type PlatformOS = 'ios' | 'android' | 'web';

let currentOS: PlatformOS = 'ios';

export const setPlatformOS = (os: PlatformOS) => {
  currentOS = os;

  jest.doMock('react-native/Libraries/Utilities/Platform', () => ({
    OS: os,
    select: jest.fn((obj: Record<string, unknown>) => obj[os] ?? obj.default),
  }));
};

export const resetPlatformOS = () => {
  currentOS = 'ios';
  jest.resetModules();
};

export const getCurrentPlatformOS = () => currentOS;
