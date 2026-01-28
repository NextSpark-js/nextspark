/**
 * Manual mock for react-native Platform
 */
export default {
  OS: 'ios' as const,
  select: jest.fn(<T>(obj: { ios?: T; android?: T; default?: T }): T | undefined =>
    obj.ios ?? obj.default
  ),
  Version: 14,
  isPad: false,
  isTVOS: false,
  isTV: false,
  constants: {
    reactNativeVersion: { major: 0, minor: 81, patch: 5 },
  },
};

export const OS = 'ios';
export const select = jest.fn(<T>(obj: { ios?: T; android?: T; default?: T }): T | undefined =>
  obj.ios ?? obj.default
);
export const Version = 14;
export const isPad = false;
export const isTVOS = false;
export const isTV = false;
export const constants = {
  reactNativeVersion: { major: 0, minor: 81, patch: 5 },
};
