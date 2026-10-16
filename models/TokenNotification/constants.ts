export const PUSH_PLATFORM = {
  IOS: "ios",
  ANDROID: "android",
} as const;

export type PushPlatform = (typeof PUSH_PLATFORM)[keyof typeof PUSH_PLATFORM];

export const PUSH_PLATFORM_OPTIONS = [
  { label: "iOS", value: PUSH_PLATFORM.IOS },
  { label: "Android", value: PUSH_PLATFORM.ANDROID },
];
